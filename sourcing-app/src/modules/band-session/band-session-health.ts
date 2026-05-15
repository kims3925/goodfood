/**
 * Band 세션 헬스 평가 — SaaS-grade 예방책 Phase 1
 *
 * 사용자의 활성 RETAIL 채널 각각에 대해 다음을 점검:
 *  - bandSessionCookie 의 길이 (NULL/임계값 미달)
 *  - sessionExpiresAt 만료 여부 + 임박 여부
 *  - 최근 24시간 발행 시도/성공 카운트 (성공률 워치독)
 *
 * 결과는 channel별 severity (HEALTHY/WARNING/CRITICAL) 와 전체 요약 severity.
 *
 * 사용처:
 *  1) Phase 1 — 대시보드 배너 (GET /api/admin/band-session/health)
 *  2) Phase 3 — pre-flight 검증 (publish 워크플로우 생성 직전 차단)
 *
 * 임계값 (상수):
 *  - HEALTHY_COOKIE_LEN_MIN = 1000   // 정상 cookie 는 보통 6000+. 1000 미만은 절단/잘못 저장 의심
 *  - SOON_EXPIRY_HOURS      = 72     // 3일 이내 만료면 WARNING
 *  - PUBLISH_FAIL_RATE_MAX  = 0.7    // 최근 24h 실패율 70%+ 면 WARNING
 */

import prisma, { ChannelKind } from '@bandauto/db'

export const HEALTHY_COOKIE_LEN_MIN = 1000
export const SOON_EXPIRY_HOURS = 72
export const PUBLISH_FAIL_RATE_MAX = 0.7
export const PUBLISH_WINDOW_HOURS = 24

export type ChannelHealthSeverity = 'HEALTHY' | 'WARNING' | 'CRITICAL'

export interface ChannelHealth {
  channelId: number
  channelName: string
  severity: ChannelHealthSeverity
  cookieLen: number | null
  sessionExpiresAt: string | null
  hoursUntilExpiry: number | null
  /** 최근 24h 발행 성공 카운트 (ChannelProduct.publishedAt 기준) */
  recentSuccessCount: number
  /** 최근 24h workflow_step_log 의 publish 실패 카운트 */
  recentFailedCount: number
  /** 메시지 한 줄 — UI 에 그대로 표시 */
  message: string
  /** 가장 시급한 reason 코드 — 다국어/i18n 가능하도록 */
  reasonCode:
    | 'OK'
    | 'COOKIE_MISSING'
    | 'COOKIE_TOO_SHORT'
    | 'SESSION_EXPIRED'
    | 'SESSION_EXPIRING_SOON'
    | 'HIGH_FAIL_RATE'
    | 'NO_RECENT_PUBLISH'
}

export interface SessionHealthSummary {
  /** 전체 채널 중 가장 나쁜 severity */
  overallSeverity: ChannelHealthSeverity
  /** 채널 개수 */
  totalChannels: number
  healthyCount: number
  warningCount: number
  criticalCount: number
  /** CRITICAL/WARNING 채널 목록 (위쪽이 더 시급) */
  channels: ChannelHealth[]
  /** 다음 액션 안내 (가장 시급한 1개) */
  recommendation: string | null
  /** 세션 재저장 가이드 URL (UI 버튼 링크) */
  guideUrl: string
}

const GUIDE_URL = '/sourcing/guide/band-session'

/** 두 severity 중 더 나쁜 것 반환 */
function worseSeverity(a: ChannelHealthSeverity, b: ChannelHealthSeverity): ChannelHealthSeverity {
  if (a === 'CRITICAL' || b === 'CRITICAL') return 'CRITICAL'
  if (a === 'WARNING' || b === 'WARNING') return 'WARNING'
  return 'HEALTHY'
}

/**
 * 사용자의 활성 RETAIL 채널 헬스 평가.
 *
 * 1) 채널 + 세션 정보 조회 (deletedAt IS NULL, isActive=true, RETAIL)
 * 2) 각 채널별로 cookie / expiry / 최근 발행 통계 평가
 * 3) channel별 severity + overall 요약 반환
 */
export async function evaluateSessionHealth(userId: number): Promise<SessionHealthSummary> {
  const channels = await prisma.channel.findMany({
    where: {
      userId,
      kind: ChannelKind.RETAIL,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      bandSessionCookie: true,
      sessionExpiresAt: true,
    },
  })

  if (channels.length === 0) {
    return {
      overallSeverity: 'HEALTHY',
      totalChannels: 0,
      healthyCount: 0,
      warningCount: 0,
      criticalCount: 0,
      channels: [],
      recommendation: null,
      guideUrl: GUIDE_URL,
    }
  }

  // 최근 24시간 발행 성공 카운트 (채널별)
  const since = new Date(Date.now() - PUBLISH_WINDOW_HOURS * 60 * 60 * 1000)
  const recentPublishes = await prisma.channelProduct
    .groupBy({
      by: ['channelId'],
      where: {
        userId,
        publishedAt: { gte: since },
        deletedAt: null,
      },
      _count: { _all: true },
    })
    .catch(() => [] as Array<{ channelId: number; _count: { _all: number } }>)
  const successByChannel = new Map<number, number>(
    recentPublishes.map((r) => [r.channelId, r._count._all]),
  )

  // 최근 24시간 workflow_step_log 의 publish 단계 실패 합계 (사용자 단위, 채널별 분리 불가)
  // → 사용자 단위 총 실패만 추정. 채널별 정밀 매핑은 추후 channel_product_publish_log 등이 필요.
  const recentFailedTotalAgg = await prisma.workflowStepLog
    .aggregate({
      where: {
        workflow: { userId },
        stepType: 'PUBLISH',
        startedAt: { gte: since },
      },
      _sum: { failedCount: true, successCount: true },
    })
    .catch(() => null)

  const userWideFailed = recentFailedTotalAgg?._sum.failedCount || 0
  const userWideSuccess = recentFailedTotalAgg?._sum.successCount || 0
  const userWideTotal = userWideFailed + userWideSuccess
  // 채널별로 분리할 수 없으므로 사용자 전체 실패율을 채널별 추가 신호로만 사용
  const userWideFailRate = userWideTotal > 0 ? userWideFailed / userWideTotal : 0

  const now = new Date()
  const out: ChannelHealth[] = channels.map((c) => {
    const cookieLen = c.bandSessionCookie ? c.bandSessionCookie.length : null
    const expiry = c.sessionExpiresAt ? new Date(c.sessionExpiresAt) : null
    const hoursUntilExpiry = expiry ? Math.floor((expiry.getTime() - now.getTime()) / (60 * 60 * 1000)) : null
    const recentSuccess = successByChannel.get(c.id) || 0

    let severity: ChannelHealthSeverity = 'HEALTHY'
    let reasonCode: ChannelHealth['reasonCode'] = 'OK'
    let message = '정상'

    // 1) Cookie 자체 검사 — 가장 시급
    if (cookieLen === null) {
      severity = 'CRITICAL'
      reasonCode = 'COOKIE_MISSING'
      message = '세션 쿠키 없음 — Extension 에서 재저장 필요'
    } else if (cookieLen < HEALTHY_COOKIE_LEN_MIN) {
      severity = 'CRITICAL'
      reasonCode = 'COOKIE_TOO_SHORT'
      message = `세션 쿠키가 너무 짧음 (${cookieLen}자, 정상 6000+) — 재저장 필요`
    }
    // 2) 만료
    else if (expiry && expiry.getTime() <= now.getTime()) {
      severity = 'CRITICAL'
      reasonCode = 'SESSION_EXPIRED'
      message = `세션 만료됨 (${expiry.toLocaleString('ko-KR')}) — 재저장 필요`
    } else if (expiry && hoursUntilExpiry !== null && hoursUntilExpiry < SOON_EXPIRY_HOURS) {
      severity = 'WARNING'
      reasonCode = 'SESSION_EXPIRING_SOON'
      message = `세션 만료 임박 (${hoursUntilExpiry}시간 후) — 미리 재저장 권장`
    }

    // 3) 사용자 전체 실패율 — 채널별 분리 불가하므로 보조 신호. cookie 정상인데 발행이 안 되는 경우.
    if (severity === 'HEALTHY' && userWideTotal >= 5 && userWideFailRate >= PUBLISH_FAIL_RATE_MAX) {
      severity = 'WARNING'
      reasonCode = 'HIGH_FAIL_RATE'
      message = `최근 24h 발행 실패율 ${Math.round(userWideFailRate * 100)}% — 세션/네트워크 점검 권장`
    }

    return {
      channelId: c.id,
      channelName: c.name,
      severity,
      cookieLen,
      sessionExpiresAt: expiry ? expiry.toISOString() : null,
      hoursUntilExpiry,
      recentSuccessCount: recentSuccess,
      recentFailedCount: 0, // 채널별 정밀 카운트는 추후 구현
      message,
      reasonCode,
    }
  })

  // 정렬: CRITICAL 먼저, WARNING, HEALTHY
  const order: Record<ChannelHealthSeverity, number> = { CRITICAL: 0, WARNING: 1, HEALTHY: 2 }
  out.sort((a, b) => order[a.severity] - order[b.severity] || a.channelName.localeCompare(b.channelName))

  const counts = { healthyCount: 0, warningCount: 0, criticalCount: 0 }
  let overall: ChannelHealthSeverity = 'HEALTHY'
  for (const ch of out) {
    overall = worseSeverity(overall, ch.severity)
    if (ch.severity === 'HEALTHY') counts.healthyCount += 1
    else if (ch.severity === 'WARNING') counts.warningCount += 1
    else counts.criticalCount += 1
  }

  // 권고 — 가장 시급한 케이스에 맞춘 한 줄
  let recommendation: string | null = null
  if (counts.criticalCount > 0) {
    recommendation =
      `${counts.criticalCount}개 소매밴드의 세션이 만료/누락 상태입니다. ` +
      `Chrome 일반창에서 band.us 로그인 (로그인 유지 체크) → Extension 으로 세션 재저장 해주세요.`
  } else if (counts.warningCount > 0) {
    recommendation =
      `${counts.warningCount}개 채널의 세션이 곧 만료되거나 발행 실패율이 높습니다. ` +
      `시간 여유 있을 때 Extension 으로 세션 재저장 해두면 안전합니다.`
  }

  return {
    overallSeverity: overall,
    totalChannels: out.length,
    ...counts,
    channels: out,
    recommendation,
    guideUrl: GUIDE_URL,
  }
}

/**
 * Phase 3 pre-flight — 발행 워크플로우 생성 직전 호출.
 *
 * 주어진 retailChannelIds 중 CRITICAL 인 게 있으면 throw.
 * (WARNING 은 통과 — 사용자에게 알림만)
 */
export class BandSessionUnhealthyError extends Error {
  readonly code = 'BAND_SESSION_UNHEALTHY' as const
  constructor(
    public criticalChannels: ChannelHealth[],
    public guideUrl: string,
  ) {
    super(
      `${criticalChannels.length}개 소매밴드의 세션이 만료/누락되어 발행할 수 없습니다: ` +
        criticalChannels.map((c) => `${c.channelName}(${c.message})`).join(', '),
    )
    this.name = 'BandSessionUnhealthyError'
  }
}

export async function assertRetailSessionsHealthy(
  userId: number,
  retailChannelIds: number[],
): Promise<void> {
  if (retailChannelIds.length === 0) return

  const summary = await evaluateSessionHealth(userId)
  const critical = summary.channels.filter(
    (c) => c.severity === 'CRITICAL' && retailChannelIds.includes(c.channelId),
  )

  if (critical.length > 0) {
    throw new BandSessionUnhealthyError(critical, summary.guideUrl)
  }
}
