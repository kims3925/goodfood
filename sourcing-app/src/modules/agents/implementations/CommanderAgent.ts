/**
 * CommanderAgent — 총괄 지휘 에이전트
 *
 * 역할:
 *  1. 모든 에이전트의 오류 이벤트를 수신하여 재시작 또는 에스컬레이션 처리
 *  2. 워크플로우 실행 요청을 받아 단계별 실행 조율
 *  3. 전체 에이전트 헬스 체크 수행 및 결과 DB 기록
 *
 * 구독 이벤트:
 *  - *.error                      : 모든 에이전트의 오류 이벤트 수신
 *  - workflow.execute.requested    : 워크플로우 실행 요청
 *  - agent.health.check           : 에이전트 헬스 체크 요청
 *  - schedule.commander.watch     : 5분 주기 전체 모니터링
 *
 * 발행 이벤트:
 *  - workflow.step.execute         : 워크플로우 단계 실행 지시
 *  - agent.restart.requested      : 오류 에이전트 재시작 요청
 *  - alert.escalated              : 심각 오류 에스컬레이션
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'
import { AgentRegistry } from '../AgentRegistry'
import { WorkflowEngine } from '../WorkflowEngine'

// ─── 에러 임계값 ───
const ERROR_THRESHOLD = 3
const ERROR_WINDOW_MS = 60 * 60 * 1000 // 1시간

export class CommanderAgent extends AgentBase {
  readonly name = 'commander'
  readonly layer = AgentLayer.COMMAND

  private workflowEngine: WorkflowEngine | null = null

  getSubscribedEvents(): string[] {
    return [
      '*.error',
      'workflow.execute.requested',
      'agent.health.check',
      'schedule.commander.watch',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      if (event.type.endsWith('.error')) {
        const result = await this.handleAgentError(event)
        return {
          success: true,
          data: result as unknown as Record<string, unknown>,
          duration: Date.now() - start,
        }
      }

      if (event.type === 'workflow.execute.requested') {
        const result = await this.executeWorkflow(event)
        return {
          success: true,
          data: result as unknown as Record<string, unknown>,
          duration: Date.now() - start,
        }
      }

      if (event.type === 'agent.health.check') {
        const result = await this.healthCheckAll()
        return {
          success: true,
          data: result as unknown as Record<string, unknown>,
          duration: Date.now() - start,
        }
      }

      // schedule.commander.watch 또는 기타 이벤트
      const result = await this.healthCheckAll()
      return {
        success: true,
        data: result as unknown as Record<string, unknown>,
        duration: Date.now() - start,
      }
    } catch (error: any) {
      await this.log('ERROR', `이벤트 처리 중 오류: ${error.message}`, {
        eventType: event.type,
      })
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  async onSchedule(): Promise<void> {
    await this.log('INFO', '정기 모니터링 시작')
    await this.healthCheckAll()
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: 이벤트 라우팅
  // ══════════════════════════════════════════════════

  /**
   * 이벤트 타입을 분석하여 담당 에이전트로 라우팅합니다.
   */
  async routeEvent(event: AgentEvent): Promise<{ routed: boolean; targetAgent?: string }> {
    const registry = AgentRegistry.getInstance()

    // 이벤트 타입의 첫 번째 세그먼트로 대상 에이전트 추론
    // 예: "product.audit.requested" → "product-manager"
    const agents = registry.getAll()
    for (const agent of agents) {
      const subscribedEvents = agent.getSubscribedEvents()
      if (subscribedEvents.includes(event.type)) {
        await this.log('INFO', `이벤트 라우팅: ${event.type} → ${agent.name}`)
        await agent.handleEvent(event)
        return { routed: true, targetAgent: agent.name }
      }
    }

    await this.log('WARN', `라우팅 대상 없음: ${event.type}`)
    return { routed: false }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 워크플로우 실행
  // ══════════════════════════════════════════════════

  /**
   * AgentWorkflow DB 레코드 기반 단계별 워크플로우 실행
   */
  async executeWorkflow(event: AgentEvent): Promise<{
    executed: boolean
    workflowCount: number
    results: Record<string, unknown>[]
  }> {
    const engine = this.getWorkflowEngine()

    await this.log('INFO', '워크플로우 실행 시작', {
      workflowId: event.data.workflowId,
    })

    try {
      const results = await engine.executeWorkflow(event)

      const workflowCount = results.length
      await this.recordKpi('workflows_executed', workflowCount)

      for (const result of results) {
        if (!result.success) {
          await this.log('WARN', `워크플로우 실패: ${result.workflowName}`, {
            error: result.error,
            workflowId: result.workflowId,
          })
        } else {
          // 각 단계에 대해 실행 완료 이벤트 발행
          for (const step of result.steps) {
            await this.emitEvent('workflow.step.execute', {
              workflowId: result.workflowId,
              workflowName: result.workflowName,
              stepId: step.stepId,
              agentName: step.agentName,
              success: step.success,
              duration: step.duration,
            })
          }
        }
      }

      await this.log('INFO', `워크플로우 실행 완료: ${workflowCount}건`)

      return {
        executed: true,
        workflowCount,
        results: results as unknown as Record<string, unknown>[],
      }
    } catch (error: any) {
      await this.log('ERROR', `워크플로우 실행 오류: ${error.message}`)
      await this.recordKpi('workflows_executed', 0)
      return { executed: false, workflowCount: 0, results: [] }
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 에이전트 오류 처리
  // ══════════════════════════════════════════════════

  /**
   * 에러 분류 → 재시도 횟수 확인 → 재시작 or 에스컬레이션
   */
  async handleAgentError(event: AgentEvent): Promise<{
    action: 'restart' | 'escalate' | 'ignored'
    agentName: string
    errorCount: number
  }> {
    const agentName = (event.data.agentName as string) || event.source || 'unknown'
    const errorMessage = (event.data.error as string) || '알 수 없는 오류'

    await this.log('WARN', `에이전트 오류 수신: ${agentName}`, {
      error: errorMessage,
    })

    try {
      // DB에서 해당 에이전트 정의 조회
      const agentDef = await prisma.agentDefinition.findUnique({
        where: { name: agentName },
      })

      if (!agentDef) {
        await this.log('WARN', `에이전트 정의 없음: ${agentName}`)
        return { action: 'ignored', agentName, errorCount: 0 }
      }

      // 최근 1시간 내 에러 로그 건수 조회
      const oneHourAgo = new Date(Date.now() - ERROR_WINDOW_MS)
      const errorCount = await prisma.agentLog.count({
        where: {
          agentId: agentDef.id,
          level: 'ERROR',
          createdAt: { gte: oneHourAgo },
        },
      })

      await this.recordKpi('errors_handled', 1)

      if (errorCount > ERROR_THRESHOLD) {
        // 임계값 초과 → 상태를 ERROR로 변경 후 에스컬레이션
        await prisma.agentDefinition.update({
          where: { id: agentDef.id },
          data: { status: 'ERROR' },
        })

        await this.escalate(agentName, errorMessage)
        return { action: 'escalate', agentName, errorCount }
      }

      // 재시작 요청 발행
      await this.emitEvent('agent.restart.requested', {
        agentName,
        reason: errorMessage,
        errorCount,
      }, 'HIGH')

      await this.log('INFO', `에이전트 재시작 요청: ${agentName}`, { errorCount })
      return { action: 'restart', agentName, errorCount }
    } catch (error: any) {
      await this.log('ERROR', `오류 처리 실패: ${error.message}`, { agentName })
      return { action: 'ignored', agentName, errorCount: 0 }
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 4: 에스컬레이션
  // ══════════════════════════════════════════════════

  /**
   * 심각 오류를 alert.escalated 이벤트로 발행
   */
  async escalate(agentName: string, error: string): Promise<void> {
    await this.log('CRITICAL', `에스컬레이션: ${agentName}`, { error })

    await this.emitEvent('alert.escalated', {
      agentName,
      error,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
    }, 'CRITICAL')

    await this.recordKpi('escalations', 1)
  }

  // ══════════════════════════════════════════════════
  //  SKILL 5: 전체 헬스 체크
  // ══════════════════════════════════════════════════

  /**
   * 전체 에이전트 healthCheck() 호출 → 결과 DB 기록
   */
  async healthCheckAll(): Promise<{
    total: number
    healthy: number
    unhealthy: number
    results: Record<string, { healthy: boolean; details?: Record<string, unknown> }>
  }> {
    const registry = AgentRegistry.getInstance()
    const agents = registry.getAll()

    const results: Record<string, { healthy: boolean; details?: Record<string, unknown> }> = {}
    let healthy = 0
    let unhealthy = 0

    for (const agent of agents) {
      try {
        const health = await agent.healthCheck()
        results[agent.name] = health

        if (health.healthy) {
          healthy++
        } else {
          unhealthy++
          await this.log('WARN', `에이전트 비정상: ${agent.name}`, {
            details: health.details,
          })
        }
      } catch (error: any) {
        unhealthy++
        results[agent.name] = { healthy: false, details: { error: error.message } }
        await this.log('ERROR', `헬스체크 실패: ${agent.name}`, {
          error: error.message,
        })
      }
    }

    await this.recordKpi('health_checks', agents.length)

    await this.log('INFO', `헬스체크 완료: ${healthy}/${agents.length} 정상`, {
      healthy,
      unhealthy,
      total: agents.length,
    })

    return {
      total: agents.length,
      healthy,
      unhealthy,
      results,
    }
  }

  // ─── 내부 헬퍼 ───

  private getWorkflowEngine(): WorkflowEngine {
    if (!this.workflowEngine) {
      this.workflowEngine = WorkflowEngine.getInstance()
    }
    return this.workflowEngine
  }
}

export const commanderAgent = new CommanderAgent()
