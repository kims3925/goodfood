/**
 * WatcherAgent — 시스템 감시 에이전트
 *
 * 역할:
 *  1. 핵심 API 엔드포인트 응답 시간 측정
 *  2. Bull 큐 대기/실패 건수 확인
 *  3. 전체 에이전트 상태 모니터링
 *  4. DB 연결 상태 확인
 *
 * 구독 이벤트:
 *  - schedule.system.watch  : 5분 주기 전체 시스템 점검
 *  - agent.health.check     : 개별 에이전트 헬스체크 요청
 *
 * 발행 이벤트:
 *  - system.alert.queue_overflow  : Bull 큐 적체 100건 초과
 *  - system.alert.api_slow        : API 응답 5초 초과
 *  - system.alert.agent_down      : 에이전트 INACTIVE 상태 감지
 *  - system.healthy               : 전체 시스템 정상
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'
import { TaskQueue } from '../TaskQueue'
import {
  evaluatePublishHealth,
  listActiveAutomationUserIds,
  disableAutomationForUser,
  type PublishHealth,
} from '@/modules/publish-watchdog/publish-watchdog.service'
import { createErrorNotification } from '@/services/notification.service'

// ─── 임계값 상수 ───
const API_TIMEOUT_MS = 5000
const QUEUE_OVERFLOW_THRESHOLD = 100
const API_ENDPOINTS = [
  { name: 'channel', url: 'http://localhost:3001/api/channel?kind=RETAIL&limit=1' },
  { name: 'shop-publish', url: 'http://localhost:3001/api/shop/publish' },
]

// ─── 검사 결과 타입 ───

interface ApiCheckResult {
  endpoint: string
  status: 'ok' | 'slow' | 'error'
  responseMs: number
  error?: string
}

interface QueueCheckResult {
  waiting: number
  failed: number
  active: number
  overflow: boolean
}

interface AgentStatusCheckResult {
  totalAgents: number
  errorAgents: string[]
  inactiveAgents: string[]
}

interface PublishWatchdogCheckResult {
  evaluatedUsers: number
  criticalUsers: number
  autoDisabledUsers: number
  details: PublishHealth[]
}

interface SystemCheckResult {
  apiChecks: ApiCheckResult[]
  queueCheck: QueueCheckResult | null
  agentCheck: AgentStatusCheckResult
  dbConnected: boolean
  publishWatchdog: PublishWatchdogCheckResult | null
  allHealthy: boolean
  alertsFired: number
}

export class WatcherAgent extends AgentBase {
  readonly name = 'watcher-agent'
  readonly layer = AgentLayer.INFRA

  getSubscribedEvents(): string[] {
    return [
      'schedule.system.watch',
      'agent.health.check',
      'publish.watchdog.evaluate',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      const result = await this.runAllChecks()

      return {
        success: true,
        data: result as unknown as Record<string, unknown>,
        duration: Date.now() - start,
      }
    } catch (error: any) {
      await this.log('ERROR', `시스템 점검 중 오류: ${error.message}`)
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  async onSchedule(): Promise<void> {
    await this.log('INFO', '정기 시스템 점검 시작')
    await this.runAllChecks()
  }

  // ══════════════════════════════════════════════════
  //  통합 점검 실행
  // ══════════════════════════════════════════════════

  private async runAllChecks(): Promise<SystemCheckResult> {
    let alertsFired = 0

    // 1. API 헬스 체크
    const apiChecks = await this.checkApiHealth()
    for (const check of apiChecks) {
      if (check.status === 'slow' || check.status === 'error') {
        await this.sendAlert('system.alert.api_slow', {
          endpoint: check.endpoint,
          status: check.status,
          responseMs: check.responseMs,
          error: check.error,
        })
        alertsFired++
      }
    }

    // 2. 큐 상태 체크
    const queueCheck = await this.checkQueueStatus()
    if (queueCheck && queueCheck.overflow) {
      await this.sendAlert('system.alert.queue_overflow', {
        waiting: queueCheck.waiting,
        failed: queueCheck.failed,
        active: queueCheck.active,
      })
      alertsFired++
    }

    // 3. 에이전트 상태 체크
    const agentCheck = await this.checkAgentStatuses()
    if (agentCheck.errorAgents.length > 0 || agentCheck.inactiveAgents.length > 0) {
      const downAgents = [...agentCheck.errorAgents, ...agentCheck.inactiveAgents]
      await this.sendAlert('system.alert.agent_down', {
        errorAgents: agentCheck.errorAgents,
        inactiveAgents: agentCheck.inactiveAgents,
        downCount: downAgents.length,
      })
      alertsFired++
    }

    // 4. DB 연결 체크
    const dbConnected = await this.checkDbConnection()
    if (!dbConnected) {
      await this.sendAlert('system.alert.api_slow', {
        endpoint: 'database',
        status: 'error',
        error: 'DB 연결 실패',
      })
      alertsFired++
    }

    // 5. 발행 헬스 워치독 (Phase 2)
    let publishWatchdog: PublishWatchdogCheckResult | null = null
    try {
      publishWatchdog = await this.checkPublishWatchdog()
      alertsFired += publishWatchdog.criticalUsers
    } catch (error: any) {
      await this.log('ERROR', `발행 워치독 평가 실패: ${error.message}`)
    }

    // KPI 기록
    await this.recordKpi('checks_performed', 5) // API, Queue, Agent, DB, PublishWatchdog
    await this.recordKpi('alerts_fired', alertsFired)
    if (publishWatchdog) {
      await this.recordKpi('publish_watchdog_critical', publishWatchdog.criticalUsers)
      await this.recordKpi('publish_watchdog_auto_off', publishWatchdog.autoDisabledUsers)
    }

    // 평균 API 응답 시간 기록
    const avgResponseMs = apiChecks.length > 0
      ? Math.round(apiChecks.reduce((sum, c) => sum + c.responseMs, 0) / apiChecks.length)
      : 0
    await this.recordKpi('api_response_ms', avgResponseMs)

    const allHealthy =
      alertsFired === 0 &&
      dbConnected &&
      apiChecks.every((c) => c.status === 'ok') &&
      (!queueCheck || !queueCheck.overflow) &&
      agentCheck.errorAgents.length === 0 &&
      agentCheck.inactiveAgents.length === 0 &&
      (!publishWatchdog || publishWatchdog.criticalUsers === 0)

    if (allHealthy) {
      await this.emitEvent('system.healthy', {
        checkedAt: new Date().toISOString(),
        apiEndpoints: apiChecks.length,
        totalAgents: agentCheck.totalAgents,
      })
      await this.log('INFO', '전체 시스템 정상')
    } else {
      await this.log('WARN', `시스템 이상 감지: ${alertsFired}건 알림 발생`, {
        alertsFired,
        dbConnected,
      })
    }

    return {
      apiChecks,
      queueCheck,
      agentCheck,
      dbConnected,
      publishWatchdog,
      allHealthy,
      alertsFired,
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 6: 발행 워치독 (Phase 2)
  // ══════════════════════════════════════════════════

  /**
   * 활성 자동화 사용자별로 최근 1시간 발행 실패율을 평가.
   *
   * - CRITICAL 이면 알림 생성 (사용자 단위)
   * - shouldAutoDisable (시도 ≥ 20 AND 실패율 ≥ 0.9) 이면 AutomationConfig.isEnabled=false
   *
   * 사용자 한 명의 실패가 다른 사용자에게 영향 없도록 try/catch 로 격리.
   */
  async checkPublishWatchdog(): Promise<PublishWatchdogCheckResult> {
    const result: PublishWatchdogCheckResult = {
      evaluatedUsers: 0,
      criticalUsers: 0,
      autoDisabledUsers: 0,
      details: [],
    }

    let userIds: number[] = []
    try {
      userIds = await listActiveAutomationUserIds()
    } catch (error: any) {
      await this.log('ERROR', `활성 자동화 사용자 조회 실패: ${error.message}`)
      return result
    }

    for (const userId of userIds) {
      try {
        const health = await evaluatePublishHealth(userId)
        result.evaluatedUsers++
        result.details.push(health)

        if (health.severity !== 'CRITICAL') continue

        result.criticalUsers++

        // 자동 OFF 평가 (보수적 조건 — 시도 ≥ 20, 실패율 ≥ 0.9)
        let autoDisabled = false
        if (health.shouldAutoDisable) {
          autoDisabled = await disableAutomationForUser(
            userId,
            `최근 ${health.windowHours}시간 발행 실패율 ${Math.round(health.failRate * 100)}%`,
          )
          if (autoDisabled) result.autoDisabledUsers++
        }

        const pct = Math.round(health.failRate * 100)
        const notificationMessage = autoDisabled
          ? `최근 ${health.windowHours}시간 발행 실패율 ${pct}% — 자동 비활성화됨. 세션 점검 후 수동 재활성화 필요`
          : `최근 ${health.windowHours}시간 발행 실패율 ${pct}% (${health.totalAttempts}건 중 ${health.failedCount}건 실패) — 세션/네트워크 점검 권장`

        try {
          await createErrorNotification(userId, {
            errorType: 'PUBLISH_WATCHDOG',
            errorMessage: notificationMessage,
          })
        } catch (notifyErr: any) {
          await this.log('WARN', `워치독 알림 생성 실패 (userId=${userId}): ${notifyErr.message}`)
        }

        await this.sendAlert('publish.watchdog.critical', {
          userId,
          windowHours: health.windowHours,
          totalAttempts: health.totalAttempts,
          failedCount: health.failedCount,
          failRate: health.failRate,
          autoDisabled,
        })

        await this.log(
          autoDisabled ? 'ERROR' : 'WARN',
          `발행 워치독 CRITICAL (userId=${userId}): ${notificationMessage}`,
          {
            userId,
            totalAttempts: health.totalAttempts,
            failRate: health.failRate,
            autoDisabled,
          },
        )
      } catch (error: any) {
        await this.log(
          'ERROR',
          `사용자 ${userId} 발행 헬스 평가 실패: ${error.message}`,
        )
      }
    }

    return result
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: API 헬스 체크
  // ══════════════════════════════════════════════════

  /**
   * 핵심 API 엔드포인트 응답 시간 측정
   */
  async checkApiHealth(): Promise<ApiCheckResult[]> {
    const results: ApiCheckResult[] = []

    for (const endpoint of API_ENDPOINTS) {
      const startTime = Date.now()
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

        const response = await fetch(endpoint.url, {
          method: 'GET',
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const responseMs = Date.now() - startTime

        if (responseMs > API_TIMEOUT_MS) {
          results.push({
            endpoint: endpoint.name,
            status: 'slow',
            responseMs,
          })
        } else if (!response.ok) {
          results.push({
            endpoint: endpoint.name,
            status: 'error',
            responseMs,
            error: `HTTP ${response.status}`,
          })
        } else {
          results.push({
            endpoint: endpoint.name,
            status: 'ok',
            responseMs,
          })
        }
      } catch (error: any) {
        const responseMs = Date.now() - startTime
        const isTimeout = error.name === 'AbortError'

        results.push({
          endpoint: endpoint.name,
          status: isTimeout ? 'slow' : 'error',
          responseMs,
          error: isTimeout ? `타임아웃 (${API_TIMEOUT_MS}ms 초과)` : error.message,
        })
      }
    }

    return results
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 큐 상태 확인
  // ══════════════════════════════════════════════════

  /**
   * Bull 큐 대기/실패 건수 확인
   */
  async checkQueueStatus(): Promise<QueueCheckResult | null> {
    try {
      const taskQueue = TaskQueue.getInstance()
      const stats = await taskQueue.getQueueStats()

      const overflow = stats.waiting > QUEUE_OVERFLOW_THRESHOLD

      if (overflow) {
        await this.log('WARN', `큐 적체 감지: 대기 ${stats.waiting}건`, {
          waiting: stats.waiting,
          failed: stats.failed,
        })
      }

      return {
        waiting: stats.waiting,
        failed: stats.failed,
        active: stats.active,
        overflow,
      }
    } catch (error: any) {
      await this.log('ERROR', `큐 상태 확인 실패: ${error.message}`)
      return null
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 에이전트 상태 확인
  // ══════════════════════════════════════════════════

  /**
   * 모든 에이전트 상태 확인 (DB 기반)
   */
  async checkAgentStatuses(): Promise<AgentStatusCheckResult> {
    try {
      const agents = await prisma.agentDefinition.findMany({
        where: {
          deletedAt: null,
          status: { in: ['ERROR', 'INACTIVE'] },
        },
        select: {
          name: true,
          status: true,
        },
      })

      const errorAgents = agents
        .filter((a) => a.status === 'ERROR')
        .map((a) => a.name)
      const inactiveAgents = agents
        .filter((a) => a.status === 'INACTIVE')
        .map((a) => a.name)

      const totalCount = await prisma.agentDefinition.count({
        where: { deletedAt: null },
      })

      if (errorAgents.length > 0) {
        await this.log('WARN', `ERROR 상태 에이전트: ${errorAgents.join(', ')}`)
      }
      if (inactiveAgents.length > 0) {
        await this.log('WARN', `INACTIVE 상태 에이전트: ${inactiveAgents.join(', ')}`)
      }

      return {
        totalAgents: totalCount,
        errorAgents,
        inactiveAgents,
      }
    } catch (error: any) {
      await this.log('ERROR', `에이전트 상태 확인 실패: ${error.message}`)
      return { totalAgents: 0, errorAgents: [], inactiveAgents: [] }
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 4: DB 연결 확인
  // ══════════════════════════════════════════════════

  /**
   * Prisma $queryRaw로 DB 연결 상태 확인
   */
  async checkDbConnection(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`
      return true
    } catch (error: any) {
      await this.log('ERROR', `DB 연결 실패: ${error.message}`)
      return false
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 5: 알림 발행
  // ══════════════════════════════════════════════════

  /**
   * 이상 감지 시 이벤트 발행
   */
  async sendAlert(type: string, details: Record<string, unknown>): Promise<void> {
    await this.log('WARN', `알림 발행: ${type}`, details)

    await this.emitEvent(type, {
      ...details,
      detectedAt: new Date().toISOString(),
      detectedBy: this.name,
    }, 'HIGH')
  }
}

export const watcherAgent = new WatcherAgent()
