/**
 * 발행 헬스 워치독 — SaaS-grade 예방책 Phase 2
 *
 * 최근 1시간 슬라이딩 윈도우 기준으로 사용자의 PUBLISH 워크플로우 단계 실패율을 평가.
 *
 * 임계값:
 *  - WATCH_WINDOW_HOURS         = 1     // 슬라이딩 윈도우 길이
 *  - WATCH_MIN_TOTAL            = 5     // 최소 시도 횟수 (적은 표본은 평가 보류)
 *  - WATCH_CRITICAL_FAIL_RATE   = 0.7   // 70% 이상 실패 → CRITICAL
 *  - AUTO_OFF_MIN_TOTAL         = 20    // 자동 비활성화 최소 표본 (보수적)
 *  - AUTO_OFF_FAIL_RATE         = 0.9   // 90% 이상 실패 시 자동 OFF
 *
 * 사용처:
 *  1) WatcherAgent — 5분 cron 마다 사용자별 평가 → CRITICAL 알림 + (옵션) 자동 OFF
 *  2) GET /api/admin/publish-watchdog/status — 운영자 진단 화면
 *
 * 데이터 출처:
 *  - WorkflowStepLog (stepType=PUBLISH) 의 successCount / failedCount 합산
 *  - 사용자 단위 (workflow.userId)
 */

import prisma from '@bandauto/db'

export const WATCH_WINDOW_HOURS = 1
export const WATCH_MIN_TOTAL = 5
export const WATCH_CRITICAL_FAIL_RATE = 0.7
export const AUTO_OFF_MIN_TOTAL = 20
export const AUTO_OFF_FAIL_RATE = 0.9

export type PublishHealthSeverity = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'INSUFFICIENT_DATA'

export interface PublishHealth {
  userId: number
  windowHours: number
  totalAttempts: number
  successCount: number
  failedCount: number
  failRate: number
  severity: PublishHealthSeverity
  /** 자동 OFF 권고 (실제 OFF 처리는 호출자가 결정) */
  shouldAutoDisable: boolean
  /** UI/알림 메시지 한 줄 */
  message: string
  /** 평가 기준 시각 (since 이후 데이터 사용) */
  since: string
  /** 평가 시각 */
  evaluatedAt: string
}

function buildMessage(severity: PublishHealthSeverity, total: number, failRate: number): string {
  const pct = Math.round(failRate * 100)
  switch (severity) {
    case 'CRITICAL':
      return `최근 ${WATCH_WINDOW_HOURS}시간 발행 실패율 ${pct}% (${total}건 중 ${Math.round(total * failRate)}건 실패) — 세션/네트워크 점검 필요`
    case 'WARNING':
      return `최근 ${WATCH_WINDOW_HOURS}시간 발행 실패율 ${pct}% — 모니터링 권장`
    case 'INSUFFICIENT_DATA':
      return `최근 ${WATCH_WINDOW_HOURS}시간 발행 시도 ${total}건 — 표본 부족 (최소 ${WATCH_MIN_TOTAL}건 필요)`
    case 'HEALTHY':
    default:
      return `최근 ${WATCH_WINDOW_HOURS}시간 발행 정상 (${total}건 시도, 실패율 ${pct}%)`
  }
}

/**
 * 사용자의 최근 1시간 발행 헬스 평가.
 *
 * - WorkflowStepLog.stepType=PUBLISH 의 successCount/failedCount 합산
 * - startedAt >= now - 1h
 * - workflow.userId = userId
 *
 * @throws Prisma 에러는 호출자가 catch (워치독 cron 전체 실패 방지)
 */
export async function evaluatePublishHealth(userId: number): Promise<PublishHealth> {
  const now = new Date()
  const since = new Date(now.getTime() - WATCH_WINDOW_HOURS * 60 * 60 * 1000)

  const agg = await prisma.workflowStepLog.aggregate({
    where: {
      workflow: { userId },
      stepType: 'PUBLISH',
      startedAt: { gte: since },
    },
    _sum: { successCount: true, failedCount: true },
  })

  const successCount = agg._sum.successCount || 0
  const failedCount = agg._sum.failedCount || 0
  const total = successCount + failedCount
  const failRate = total > 0 ? failedCount / total : 0

  let severity: PublishHealthSeverity
  if (total < WATCH_MIN_TOTAL) {
    severity = 'INSUFFICIENT_DATA'
  } else if (failRate >= WATCH_CRITICAL_FAIL_RATE) {
    severity = 'CRITICAL'
  } else if (failRate >= 0.3) {
    severity = 'WARNING'
  } else {
    severity = 'HEALTHY'
  }

  const shouldAutoDisable =
    total >= AUTO_OFF_MIN_TOTAL && failRate >= AUTO_OFF_FAIL_RATE

  return {
    userId,
    windowHours: WATCH_WINDOW_HOURS,
    totalAttempts: total,
    successCount,
    failedCount,
    failRate: Math.round(failRate * 1000) / 1000,
    severity,
    shouldAutoDisable,
    message: buildMessage(severity, total, failRate),
    since: since.toISOString(),
    evaluatedAt: now.toISOString(),
  }
}

/**
 * 모든 활성 자동화 사용자 목록 조회.
 * WatcherAgent 가 cron 마다 호출해 사용자별 health 평가에 사용.
 */
export async function listActiveAutomationUserIds(): Promise<number[]> {
  const configs = await prisma.automationConfig.findMany({
    where: { isEnabled: true },
    select: { userId: true },
  })
  return configs.map((c) => c.userId)
}

/**
 * 사용자의 AutomationConfig.isEnabled 를 false 로 강제 비활성화.
 *
 * 매우 보수적으로 호출. WatcherAgent 에서 AUTO_OFF 조건 충족 시만 사용.
 */
export async function disableAutomationForUser(userId: number, reason: string): Promise<boolean> {
  try {
    const result = await prisma.automationConfig.updateMany({
      where: { userId, isEnabled: true },
      data: { isEnabled: false },
    })
    if (result.count > 0) {
      console.warn(
        `[PublishWatchdog] 사용자 ${userId} 자동화 자동 비활성화: ${reason}`,
      )
      return true
    }
    return false
  } catch (err) {
    console.error(`[PublishWatchdog] 자동 비활성화 실패 (userId=${userId}):`, err)
    return false
  }
}
