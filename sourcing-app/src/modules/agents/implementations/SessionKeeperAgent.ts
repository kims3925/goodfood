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
import { createErrorNotification, createInfoNotification } from '@/services/notification.service'

// ─── 시간 상수 (ms) ───
const HOUR_MS = 60 * 60 * 1000
const EXPIRY_WARNING_MS = 24 * HOUR_MS // D-1 (기존 호환)
const EXPIRY_D3_MS = 72 * HOUR_MS // D-3 (Phase 4)
const NOTIFICATION_THROTTLE_HOURS = 12 // 같은 channel+stage 중복 알림 차단 윈도우

/** 만료 알림 단계 — 가까운 순서대로 */
type ExpiryStage = 'EXPIRED' | 'D1' | 'D3'

/** 알림 metadata 식별자 (Notification.metadata.stage 로 저장 → 중복 차단) */
const SESSION_NOTIFICATION_KIND = 'BAND_SESSION_EXPIRY'

export class SessionKeeperAgent extends AgentBase {
  readonly name = 'session-keeper'
  readonly layer = AgentLayer.INFRA

  getSubscribedEvents(): string[] {
    return [
      'schedule.session.check',
      'session.expired',
      'band.action.failed',
      'schedule.session.expiry.predict',
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

        case 'schedule.session.expiry.predict': {
          // 만료 예측 알림만 별도 실행하고 싶을 때 (cron 외 강제 트리거)
          const result = await this.checkAllSessions()
          return {
            success: true,
            data: result as unknown as Record<string, unknown>,
            duration: Date.now() - start,
          }
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
  //  SKILL 3.1: 만료 예측 알림 (Phase 4) — D-3 / D-1 / EXPIRED
  // ══════════════════════════════════════════════════

  /**
   * 같은 채널/같은 stage 의 알림이 최근 12시간 안에 발송되었는지 확인.
   * Notification.metadata 에 { kind: SESSION_NOTIFICATION_KIND, channelId, stage } 저장.
   *
   * 주의: Prisma JSON 쿼리는 MariaDB JSON_EXTRACT 로 변환됨. 폴백으로 raw query 사용.
   */
  async wasRecentlyNotified(
    userId: number,
    channelId: number,
    stage: ExpiryStage,
  ): Promise<boolean> {
    const since = new Date(Date.now() - NOTIFICATION_THROTTLE_HOURS * HOUR_MS)
    try {
      // Prisma JSON path filter — MariaDB 호환
      const rows = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM notification
        WHERE user_id = ${userId}
          AND created_at >= ${since}
          AND JSON_EXTRACT(metadata, '$.kind') = ${SESSION_NOTIFICATION_KIND}
          AND JSON_EXTRACT(metadata, '$.channelId') = ${channelId}
          AND JSON_EXTRACT(metadata, '$.stage') = ${stage}
        LIMIT 1
      `
      return rows.length > 0
    } catch (error: any) {
      // metadata 검색 실패 시 안전하게 false 반환 — 중복 알림 risk 보다 누락 risk 회피
      await this.log('WARN', `중복 알림 검사 실패: ${error.message}`)
      return false
    }
  }

  /**
   * D-3 / D-1 / EXPIRED 단계 알림을 사용자에게 발송.
   * 같은 채널+stage 가 최근 12h 발송됐으면 스킵.
   *
   * stage = 'EXPIRED' → createErrorNotification (CRITICAL)
   * stage = 'D1'      → createErrorNotification (강한 알림)
   * stage = 'D3'      → createInfoNotification  (정보 알림)
   */
  async notifyChannelOwnerOfExpiry(
    userId: number,
    channelId: number,
    channelName: string,
    stage: ExpiryStage,
    hoursUntilExpiry: number,
  ): Promise<boolean> {
    const throttled = await this.wasRecentlyNotified(userId, channelId, stage)
    if (throttled) return false

    const stageLabel: Record<ExpiryStage, string> = {
      EXPIRED: '만료됨',
      D1: '24시간 이내 만료',
      D3: '72시간 이내 만료',
    }

    const title = `Band 세션 ${stageLabel[stage]}: ${channelName}`
    const messageBase =
      stage === 'EXPIRED'
        ? `소매밴드 "${channelName}" 세션이 만료되었습니다. Extension 으로 즉시 재저장 해주세요.`
        : `소매밴드 "${channelName}" 세션이 ${hoursUntilExpiry}시간 후 만료됩니다. ` +
          (stage === 'D1'
            ? '오늘 안에 Extension 으로 재저장 해주세요.'
            : '시간 여유 있을 때 미리 재저장 해두면 안전합니다.')

    // 메타데이터 - 중복 차단용. notification.service.ts 의 헬퍼는 metadata 미지원이라
    // 직접 prisma.notification.create 호출.
    try {
      await prisma.notification.create({
        data: {
          userId,
          section: 'sourcing',
          type: stage === 'D3' ? 'INFO' : 'ERROR',
          title,
          message: messageBase,
          link: '/sourcing/channel',
          metadata: {
            kind: SESSION_NOTIFICATION_KIND,
            channelId,
            channelName,
            stage,
            hoursUntilExpiry,
          },
        },
      })
      return true
    } catch (error: any) {
      // 폴백 — metadata 컬럼 문제 등으로 실패 시 일반 헬퍼 호출 (단, 중복 차단 약화)
      await this.log('WARN', `만료 알림 생성 실패 (raw), 폴백 사용: ${error.message}`)
      try {
        if (stage === 'D3') {
          await createInfoNotification(userId, title, messageBase, '/sourcing/channel')
        } else {
          await createErrorNotification(userId, {
            errorType: 'SESSION_EXPIRY',
            errorMessage: messageBase,
          })
        }
        return true
      } catch (fallbackErr: any) {
        await this.log('ERROR', `만료 알림 폴백도 실패: ${fallbackErr.message}`)
        return false
      }
    }
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
    notifiedD3: number
    notifiedD1: number
    notifiedExpired: number
  }> {
    const stats = {
      checked: 0,
      valid: 0,
      expired: 0,
      expiringSoon: 0,
      notifiedD3: 0,
      notifiedD1: 0,
      notifiedExpired: 0,
    }

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
        userId: true,
      },
    })

    for (const channel of channels) {
      stats.checked++

      try {
        // 만료 시간 기반 사전 체크
        const remainingMs = this.getSessionExpiryTime(channel.sessionExpiresAt ?? null)
        const hoursUntilExpiry =
          remainingMs !== null ? Math.max(0, Math.round(remainingMs / HOUR_MS)) : null

        // ── Phase 4 알림 단계 분기 ──
        // EXPIRED (remainingMs ≤ 0) > D1 (< 24h) > D3 (< 72h)
        if (remainingMs !== null && channel.userId) {
          if (remainingMs <= 0) {
            const sent = await this.notifyChannelOwnerOfExpiry(
              channel.userId,
              channel.id,
              channel.name,
              'EXPIRED',
              0,
            )
            if (sent) stats.notifiedExpired++
          } else if (remainingMs <= EXPIRY_WARNING_MS) {
            // D-1 (24시간 이내)
            const sent = await this.notifyChannelOwnerOfExpiry(
              channel.userId,
              channel.id,
              channel.name,
              'D1',
              hoursUntilExpiry ?? 0,
            )
            if (sent) stats.notifiedD1++
          } else if (remainingMs <= EXPIRY_D3_MS) {
            // D-3 (72시간 이내) — 정보 알림 (당일 1회 — 12h throttle)
            const sent = await this.notifyChannelOwnerOfExpiry(
              channel.userId,
              channel.id,
              channel.name,
              'D3',
              hoursUntilExpiry ?? 0,
            )
            if (sent) stats.notifiedD3++
          }
        }

        if (remainingMs !== null && remainingMs <= 0) {
          // 이미 만료됨 — 세션 무효화
          stats.expired++
          await this.log('ERROR', `세션 만료됨: 채널 ${channel.name}(${channel.id})`)
          await this.renewSession(channel.id)
          continue
        }

        if (remainingMs !== null && remainingMs <= EXPIRY_WARNING_MS) {
          // 24시간 이내 만료 예정 (기존 이벤트 발행 유지 — Commander 등이 구독)
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
        await this.log(
          'ERROR',
          `세션 점검 실패: 채널 ${channel.name}(${channel.id}) → ${error.message}`,
        )
      }
    }

    // KPI 기록
    await this.recordKpi('session_checked', stats.checked)
    await this.recordKpi('session_valid', stats.valid)
    await this.recordKpi('session_expired', stats.expired)
    await this.recordKpi('session_expiring_soon', stats.expiringSoon)
    await this.recordKpi('session_notified_d3', stats.notifiedD3)
    await this.recordKpi('session_notified_d1', stats.notifiedD1)
    await this.recordKpi('session_notified_expired', stats.notifiedExpired)

    await this.log('INFO', '세션 점검 완료', stats)

    return stats
  }
}

export const sessionKeeperAgent = new SessionKeeperAgent()
