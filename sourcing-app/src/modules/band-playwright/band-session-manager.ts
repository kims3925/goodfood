/**
 * Band 세션 관리
 * DB에서 세션 조회/저장, 세션 유효성 확인, 자동 재로그인
 *
 * ── invalidateSession 보수화 (2026-05-17) ──
 * 일시적 네트워크 오류 / Band 일시 장애로 1-2회 실패하는 케이스에도 즉시 NULL 처리하면
 * 사용자가 멀쩡한 세션을 다시 저장해야 하는 사고. 따라서:
 *  - in-memory 카운터 Map<channelId, {count, firstFailAt}>
 *  - 호출 시 count++. force=true 또는 count >= INVALIDATE_THRESHOLD 일 때만 실제 NULL
 *  - 1시간 (CONSEC_WINDOW_MS) 안에 추가 실패가 없으면 카운터 자동 리셋
 *  - 발행 성공 시 resetSessionFailureCount(channelId) 명시 호출로 카운터 0 으로
 */

import prisma from '@bandauto/db'
import { browserPool } from './band-browser-pool'
import { BandSession, BandPlaywrightError, BandPlaywrightErrorCode } from './types'

// 보수화 파라미터
const INVALIDATE_THRESHOLD = 3        // 연속 N회 실패 시 NULL 처리
const CONSEC_WINDOW_MS = 60 * 60 * 1000  // 1시간 — 이 안에 추가 실패 없으면 카운터 리셋
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000 // 30분 — 사전 알림 dedupe

interface FailureEntry {
  count: number
  firstFailAt: number  // epoch ms
  lastFailAt: number
  lastNotifyAt: number // 마지막 사전 알림 시각 (0 = 미발송)
}
const failureCounters = new Map<number, FailureEntry>()

/**
 * 발행 성공 시 호출 — 누적 실패 카운터 초기화.
 * 일시 오류로 1-2회 쌓인 카운터를 신호리세트해서 더 보수적으로.
 */
export function resetSessionFailureCount(channelId: number): void {
  if (failureCounters.has(channelId)) {
    failureCounters.delete(channelId)
    console.log(`[BandSessionManager] 채널 ${channelId} 세션 실패 카운터 리셋 (발행 성공)`)
  }
}

/**
 * 현재 카운터 상태 조회 (디버그/모니터링).
 */
export function getSessionFailureCount(channelId: number): number {
  const entry = failureCounters.get(channelId)
  if (!entry) return 0
  // 1시간 지난 카운터는 무시 (다음 호출 시 리셋됨)
  if (Date.now() - entry.lastFailAt > CONSEC_WINDOW_MS) return 0
  return entry.count
}

export class BandSessionManager {
  /**
   * 유효한 세션 가져오기 (DB에서 쿠키 조회)
   */
  async getValidSession(channelId: number): Promise<BandSession | null> {
    // DB에서 채널의 세션 정보 조회
    const channel = await prisma.channel.findFirst({
      where: { id: channelId },
      select: {
        bandSessionCookie: true,
        sessionExpiresAt: true,
      },
    })

    if (!channel) {
      console.error(`[BandSessionManager] Channel ${channelId} not found`)
      return null
    }

    // 기존 세션 유효성 확인
    // sessionExpiresAt이 null이면 만료일 없는 세션 쿠키 → 유효로 처리
    // sessionExpiresAt이 있으면 만료 여부 확인
    if (channel.bandSessionCookie) {
      const now = new Date()

      if (channel.sessionExpiresAt) {
        const expiresAt = new Date(channel.sessionExpiresAt)
        if (expiresAt <= now) {
          console.error(`[BandSessionManager] Session expired for channel ${channelId} (expired at ${expiresAt.toISOString()})`)
          throw new BandPlaywrightError(
            '세션이 만료되었습니다. 채널 설정에서 쿠키를 다시 등록해주세요.',
            BandPlaywrightErrorCode.SESSION_EXPIRED
          )
        }
      }

      console.log(`[BandSessionManager] Using existing session for channel ${channelId}`)
      return {
        cookies: channel.bandSessionCookie,
        expiresAt: channel.sessionExpiresAt ? new Date(channel.sessionExpiresAt) : null,
        isValid: true,
      }
    }

    // 세션 없음
    console.error(`[BandSessionManager] No session cookie for channel ${channelId}`)
    throw new BandPlaywrightError(
      '세션이 없습니다. 채널 설정에서 쿠키를 등록해주세요.',
      BandPlaywrightErrorCode.SESSION_EXPIRED
    )
  }

  /**
   * 세션 무효화 — 옵션으로 보수화.
   *
   * @param opts.force true 면 카운터 무시하고 즉시 NULL (만료 확정 케이스).
   *   기본 false: 카운터 누적 후 임계값 도달 시에만 NULL.
   *
   * 카운터 < 임계값 — DB NULL 처리 안 함, 사용자 알림 가능 (옛 세션은 유지)
   * 카운터 >= 임계값 OR force=true — 실제 NULL + 카운터 리셋
   *
   * 호출자가 NULL 처리됐는지 알 수 있도록 boolean 반환.
   */
  async invalidateSession(channelId: number, opts?: { force?: boolean; reason?: string }): Promise<boolean> {
    const force = !!opts?.force
    const reason = opts?.reason || 'unknown'
    const now = Date.now()

    // 기존 카운터 가져오기 (1h 지났으면 fresh 시작)
    let entry = failureCounters.get(channelId)
    if (entry && now - entry.lastFailAt > CONSEC_WINDOW_MS) {
      entry = undefined
    }
    if (!entry) {
      entry = { count: 0, firstFailAt: now, lastFailAt: now, lastNotifyAt: 0 }
    }
    entry.count += 1
    entry.lastFailAt = now
    failureCounters.set(channelId, entry)

    const shouldInvalidate = force || entry.count >= INVALIDATE_THRESHOLD

    if (!shouldInvalidate) {
      console.warn(
        `[BandSessionManager] 채널 ${channelId} 세션 실패 ${entry.count}/${INVALIDATE_THRESHOLD} (${reason}) — NULL 처리 보류 (일시 오류 가능성)`,
      )
      // 사전 알림 — 30분 cooldown 으로 noise 방지
      if (now - entry.lastNotifyAt > NOTIFY_COOLDOWN_MS) {
        entry.lastNotifyAt = now
        await sendPreInvalidateNotification(channelId, entry.count, reason).catch((e) => {
          console.warn('[BandSessionManager] 사전 알림 실패 (무시)', e?.message)
        })
      }
      // 브라우저 컨텍스트만 정리 — 다음 시도 시 깨끗한 컨텍스트로 재접속
      await browserPool.closeContext(channelId).catch(() => null)
      return false
    }

    console.log(
      `[BandSessionManager] 채널 ${channelId} 세션 무효화 (${reason}, force=${force}, count=${entry.count})`,
    )

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        bandSessionCookie: null,
        sessionExpiresAt: null,
      },
    })

    // NULL 처리 시 즉시 알림 — 단, force=true 경로(SessionKeeperAgent 의 만료 확정)는
    // SessionKeeperAgent 가 별도 D-3/D-1/EXPIRED 알림을 보내므로 중복 회피.
    if (!force) {
      await sendInvalidateNotification(channelId, entry.count, reason).catch((e) => {
        console.warn('[BandSessionManager] CRITICAL 알림 실패 (무시)', e?.message)
      })
    }

    // 카운터 리셋 (이제 NULL 이라 더 누적할 필요 없음)
    failureCounters.delete(channelId)

    // 브라우저 컨텍스트도 정리
    await browserPool.closeContext(channelId).catch(() => null)
    return true
  }

  /**
   * 세션 저장
   */
  async saveSession(
    channelId: number,
    cookies: string,
    expiresAt: Date
  ): Promise<void> {
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        bandSessionCookie: cookies,
        sessionExpiresAt: expiresAt,
      },
    })

    console.log(`[BandSessionManager] Session saved for channel ${channelId}`)
  }

  /**
   * 세션 테스트 (실제로 로그인되어 있는지 확인)
   */
  async testSession(channelId: number): Promise<boolean> {
    try {
      const session = await this.getValidSession(channelId)
      if (!session) {
        return false
      }

      const context = await browserPool.getContext(channelId, session.cookies)
      const page = await context.newPage()

      try {
        await page.goto('https://band.us/home', { waitUntil: 'networkidle', timeout: 15000 })
        const currentUrl = page.url()
        const isValid = currentUrl.includes('band.us') && !currentUrl.includes('login')

        if (!isValid) {
          // testSession 실패 — 일시 네트워크 오류 가능성 → force=false (보수화)
          await this.invalidateSession(channelId, { reason: 'testSession: band.us redirect to login' })
        }
        return isValid
      } finally {
        await page.close()
        await browserPool.releaseContext(channelId)
      }
    } catch (error) {
      console.error(`[BandSessionManager] Session test failed for channel ${channelId}:`, error)
      return false
    }
  }
}

export const sessionManager = new BandSessionManager()

// ─── 사전/사후 알림 ─────────────────────────────────────────
/**
 * count < 임계값 일 때의 사전 알림 (실 NULL 처리 전).
 * "지금 세션은 살아있지만 곧 만료 의심" — 사용자가 미리 재저장하면 0% 실패 가능.
 */
async function sendPreInvalidateNotification(
  channelId: number,
  count: number,
  reason: string,
): Promise<void> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { userId: true, name: true },
  })
  if (!channel) return

  const { createInfoNotification } = await import('@/services/notification.service')
  const title = count === 1
    ? '⚠ 밴드 세션 일시 오류 감지'
    : `⚠⚠ 밴드 세션 오류 ${count}회 누적 — 곧 재저장 필요`
  const message =
    `채널 [${channel.name}] 발행 실패 ${count}/${INVALIDATE_THRESHOLD} (${reason}). ` +
    '일시적 네트워크 오류일 수 있지만, 미리 Chrome Extension 으로 세션을 재저장해두면 안전합니다.'
  await createInfoNotification(channel.userId, title, message, '/sourcing/guide/band-session')
}

/**
 * count >= 임계값 으로 실제 NULL 처리됐을 때 CRITICAL 알림.
 * SessionKeeperAgent 의 force=true 경로에서는 호출 안 함 (그쪽이 D-3/D-1/EXPIRED 알림 담당).
 */
async function sendInvalidateNotification(
  channelId: number,
  count: number,
  reason: string,
): Promise<void> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { userId: true, name: true },
  })
  if (!channel) return

  const { createErrorNotification } = await import('@/services/notification.service')
  await createErrorNotification(channel.userId, {
    errorType: '밴드 세션',
    errorMessage:
      `🔴 채널 [${channel.name}] 세션이 ${count}회 연속 실패 후 자동 무효화되었습니다. ` +
      `이유: ${reason}. Chrome Extension 에서 즉시 세션 재저장 필요.`,
  })
}