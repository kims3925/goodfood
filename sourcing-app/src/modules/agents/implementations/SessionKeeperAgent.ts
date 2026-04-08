/**
 * SessionKeeperAgent — 세션 관리 에이전트
 *
 * 역할:
 *  1. 6시간 주기로 채널별 bandSessionCookie 유효성 확인
 *  2. 세션 만료 감지 시 즉시 무효화 + 관리자 알림
 *  3. 만료 임박(24시간 이내) 세션 경고
 *
 * 구독 이벤트:
 *  - schedule.session.check  : 6시간 주기 세션 유효성 확인
 *  - session.expired         : 세션 만료 감지 → 즉시 갱신 시도
 *  - band.action.failed      : Band 작업 실패 → 세션 문제 여부 확인
 *
 * 발행 이벤트:
 *  - band.session.renewed    : 세션 갱신 성공
 *  - band.session.failed     : 갱신 실패 → Commander 에스컬레이션
 *  - band.session.expiring.soon : 만료 임박(24시간 이내) 경고
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'
import { sessionManager } from '@/modules/band-playwright'

// ─── 24시간(ms) ───
const EXPIRY_WARNING_MS = 24 * 60 * 60 * 1000

export class SessionKeeperAgent extends AgentBase {
  readonly name = 'session-keeper'
  readonly layer = AgentLayer.INFRA

  getSubscribedEvents(): string[] {
    return [
      'schedule.session.check',
      'session.expired',
      'band.action.failed',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      switch (event.type) {
        case 'schedule.session.check': {
          const result = await this.checkAllSessions()
          return {
            success: true,
            data: result as unknown as Record<string, unknown>,
            duration: Date.now() - start,
          }
        }

        case 'session.expired': {
          const channelId = event.data.channelId as number
          await this.renewSession(channelId)
          return { success: true, duration: Date.now() - start }
        }

        case 'band.action.failed': {
          const channelId = event.data.channelId as number | undefined
          if (channelId) {
            const isValid = await this.checkSessionValidity(channelId)
            if (!isValid) {
              await this.renewSession(channelId)
            }
          }
          return { success: true, duration: Date.now() - start }
        }

        default:
          return { success: false, error: `알 수 없는 이벤트: ${event.type}`, duration: Date.now() - start }
      }
    } catch (error: any) {
      await this.log('ERROR', `세션 관리 중 오류 발생: ${error.message}`)
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  // ─── 스케줄 실행 (onSchedule 오버라이드) ───
  async onSchedule(): Promise<void> {
    await this.log('INFO', '정기 세션 점검 시작')
    await this.checkAllSessions()
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: 세션 유효성 확인
  // ══════════════════════════════════════════════════

  /**
   * 단일 채널의 bandSessionCookie 유효성을 확인합니다.
   * sessionManager.testSession()을 사용하여 실제 세션 유효 여부를 검증합니다.
   */
  async checkSessionValidity(channelId: number): Promise<boolean> {
    try {
      const isValid = await sessionManager.testSession(channelId)
      await this.log('INFO', `세션 유효성 확인: 채널 ${channelId} → ${isValid ? '유효' : '무효'}`)
      return isValid
    } catch (error: any) {
      await this.log('ERROR', `세션 테스트 실패: 채널 ${channelId} → ${error.message}`)
      return false
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 세션 갱신 (무효화 + 관리자 알림)
  // ══════════════════════════════════════════════════

  /**
   * Band 재로그인은 현재 자동화 불가이므로,
   * 세션을 무효화하고 관리자에게 알림을 발행합니다.
   */
  async renewSession(channelId: number): Promise<void> {
    try {
      // 세션 쿠키 무효화
      await prisma.channel.update({
        where: { id: channelId },
        data: {
          bandSessionCookie: null,
          sessionExpiresAt: null,
        },
      })

      await this.log('WARN', `세션 무효화 완료: 채널 ${channelId} — 수동 재로그인 필요`)

      // Commander 에스컬레이션 이벤트 발행
      await this.emitEvent(
        'band.session.failed',
        { channelId, reason: '세션 만료 또는 무효 — 수동 재로그인 필요' },
        'HIGH'
      )
    } catch (error: any) {
      await this.log('ERROR', `세션 갱신 처리 실패: 채널 ${channelId} → ${error.message}`)
      await this.emitEvent(
        'band.session.failed',
        { channelId, reason: `세션 갱신 처리 중 오류: ${error.message}` },
        'CRITICAL'
      )
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 만료 임박 알림
  // ══════════════════════════════════════════════════

  /**
   * 만료 임박 세션에 대해 관리자 알림 이벤트를 발행합니다.
   */
  async notifySessionExpiry(channelId: number, channelName: string, expiresAt: Date): Promise<void> {
    const remainingMs = expiresAt.getTime() - Date.now()
    const remainingHours = Math.round(remainingMs / (60 * 60 * 1000))

    await this.log('WARN', `세션 만료 임박: 채널 ${channelName}(${channelId}) — ${remainingHours}시간 후 만료`)

    await this.emitEvent(
      'band.session.expiring.soon',
      {
        channelId,
        channelName,
        expiresAt: expiresAt.toISOString(),
        remainingHours,
      },
      'HIGH'
    )
  }

  // ══════════════════════════════════════════════════
  //  SKILL 4: 만료 예측
  // ══════════════════════════════════════════════════

  /**
   * sessionExpiresAt 기반으로 만료까지 남은 시간(ms)을 반환합니다.
   * sessionExpiresAt가 없으면 null을 반환합니다.
   */
  getSessionExpiryTime(sessionExpiresAt: Date | null): number | null {
    if (!sessionExpiresAt) return null
    return sessionExpiresAt.getTime() - Date.now()
  }

  // ══════════════════════════════════════════════════
  //  전체 세션 점검
  // ══════════════════════════════════════════════════

  private async checkAllSessions(): Promise<{
    checked: number
    valid: number
    expired: number
    expiringSoon: number
  }> {
    const stats = { checked: 0, valid: 0, expired: 0, expiringSoon: 0 }

    // 활성 RETAIL 채널 중 세션이 있는 것만 조회
    const channels = await prisma.channel.findMany({
      where: {
        kind: 'RETAIL',
        deletedAt: null,
        isActive: true,
        bandSessionCookie: { not: null },
      },
      select: {
        id: true,
        name: true,
        sessionExpiresAt: true,
      },
    })

    for (const channel of channels) {
      stats.checked++

      try {
        // 만료 시간 기반 사전 체크
        const remainingMs = this.getSessionExpiryTime(channel.sessionExpiresAt ?? null)

        if (remainingMs !== null && remainingMs <= 0) {
          // 이미 만료됨
          stats.expired++
          await this.log('ERROR', `세션 만료됨: 채널 ${channel.name}(${channel.id})`)
          await this.renewSession(channel.id)
          continue
        }

        if (remainingMs !== null && remainingMs <= EXPIRY_WARNING_MS) {
          // 24시간 이내 만료 예정
          stats.expiringSoon++
          await this.notifySessionExpiry(channel.id, channel.name, channel.sessionExpiresAt!)
        }

        // 실제 세션 유효성 테스트
        const isValid = await this.checkSessionValidity(channel.id)
        if (isValid) {
          stats.valid++
        } else {
          stats.expired++
          await this.renewSession(channel.id)
        }
      } catch (error: any) {
        stats.expired++
        await this.log('ERROR', `세션 점검 실패: 채널 ${channel.name}(${channel.id}) → ${error.message}`)
      }
    }

    // KPI 기록
    await this.recordKpi('session_checked', stats.checked)
    await this.recordKpi('session_valid', stats.valid)
    await this.recordKpi('session_expired', stats.expired)
    await this.recordKpi('session_expiring_soon', stats.expiringSoon)

    await this.log('INFO', '세션 점검 완료', stats)

    return stats
  }
}

export const sessionKeeperAgent = new SessionKeeperAgent()
