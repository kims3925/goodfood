/**
 * Automation Scheduler
 * node-cron을 사용한 자동화 스케줄러
 */

import * as cron from 'node-cron'
import prisma, { TriggerType, WorkflowType } from '@bandauto/db'
import { executeFullPipelineWithLock } from './executor'
import { acquireExecutionLock, getRunningWorkflow } from './workflow-service'

// 활성 스케줄러 저장 (사용자당 여러 cron task 지원)
const activeSchedulers: Map<number, cron.ScheduledTask[]> = new Map()

/**
 * 스케줄러 초기화
 * 애플리케이션 시작 시 호출
 */
export async function initializeScheduler(): Promise<void> {
  try {
    // 활성화된 모든 자동화 설정 조회
    const configs = await prisma.automationConfig.findMany({
      where: { isEnabled: true },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    })

    // 각 설정에 대해 스케줄러 등록 (로그 없이)
    for (const config of configs) {
      if (config.cronExpression) {
        registerSchedulerSilent(config.user.id, config.cronExpression)
      }
    }

    // 활성 스케줄러가 있을 때만 로그 출력
    if (configs.length > 0) {
      console.log(`[Scheduler] ${configs.length}개의 자동화 스케줄러 시작됨`)
    }
  } catch (error) {
    console.error('[Scheduler] 초기화 실패:', error)
  }
}

/**
 * 파이프 구분 cron expression을 개별 cron 배열로 분리
 */
function parseCronExpressions(cronExpression: string): string[] {
  return cronExpression.split('|').map(c => c.trim()).filter(Boolean)
}

/**
 * 단일 cron task 생성 (공통 실행 로직)
 */
function createCronTask(userId: number, singleCron: string): cron.ScheduledTask | null {
  if (!cron.validate(singleCron)) return null

  return cron.schedule(singleCron, async () => {
    try {
      const config = await prisma.automationConfig.findUnique({
        where: { userId },
      })

      if (!config?.isEnabled) {
        console.log(`[Scheduler] 자동화 비활성화 상태 - 실행 건너뜀 (user: ${userId})`)
        unregisterScheduler(userId)
        return
      }

      console.log(`[Scheduler] 자동화 실행 시작 (user: ${userId})`)

      let options: {
        skipCollection?: boolean
        skipTransform?: boolean
        skipProductCreate?: boolean
        skipPublish?: boolean
      } | undefined = undefined

      if (config?.pipelineSteps) {
        try {
          const pipelineSteps = JSON.parse(config.pipelineSteps)
          options = {
            skipCollection: !pipelineSteps.collection,
            skipTransform: !pipelineSteps.transform,
            skipProductCreate: !pipelineSteps.productCreate,
            skipPublish: !pipelineSteps.publish,
          }
        } catch (e) {
          console.error(`[Scheduler] pipelineSteps 파싱 실패:`, e)
        }
      }

      const result = await executeFullPipelineWithLock(userId, options, TriggerType.SCHEDULED)

      if (result) {
        console.log(`[Scheduler] 자동화 완료: ${result.overallStatus}`)
      } else {
        console.log(`[Scheduler] Lock 획득 실패 - 이미 실행 중인 작업이 있음`)
      }
    } catch (error) {
      console.error(`[Scheduler] 자동화 실패:`, error)
    }
  }, {
    timezone: 'Asia/Seoul',
  } as any)
}

/**
 * 스케줄러 등록 (내부용, 로그 없음)
 */
function registerSchedulerSilent(userId: number, cronExpression: string): void {
  unregisterScheduler(userId)

  const cronExpressions = parseCronExpressions(cronExpression)
  const tasks: cron.ScheduledTask[] = []

  for (const singleCron of cronExpressions) {
    const task = createCronTask(userId, singleCron)
    if (task) tasks.push(task)
  }

  if (tasks.length > 0) {
    activeSchedulers.set(userId, tasks)
  }
}

/**
 * 스케줄러 등록 (외부 호출용)
 * 파이프(|) 구분 다중 cron expression 지원
 */
export function registerScheduler(userId: number, cronExpression: string): void {
  unregisterScheduler(userId)

  const cronExpressions = parseCronExpressions(cronExpression)
  const tasks: cron.ScheduledTask[] = []

  for (const singleCron of cronExpressions) {
    if (!cron.validate(singleCron)) {
      console.error(`[Scheduler] 잘못된 cron 표현식: ${singleCron}`)
      continue
    }
    const task = createCronTask(userId, singleCron)
    if (task) tasks.push(task)
  }

  if (tasks.length > 0) {
    activeSchedulers.set(userId, tasks)
    console.log(`[Scheduler] 스케줄러 등록 (user: ${userId}, cron ${tasks.length}개)`)
  }
}

/**
 * 스케줄러 해제
 */
export function unregisterScheduler(userId: number): void {
  const existing = activeSchedulers.get(userId)
  if (existing) {
    for (const task of existing) {
      task.stop()
    }
    activeSchedulers.delete(userId)
    console.log(`[Scheduler] Unregistered scheduler for user ${userId}`)
  }
}

/**
 * 스케줄러 업데이트 (설정 변경 시 호출)
 */
export async function updateScheduler(userId: number): Promise<void> {
  const config = await prisma.automationConfig.findUnique({
    where: { userId },
  })

  if (!config || !config.isEnabled || !config.cronExpression) {
    unregisterScheduler(userId)
    return
  }

  registerScheduler(userId, config.cronExpression)
}

/**
 * 모든 스케줄러 중지
 */
export function stopAllSchedulers(): void {
  console.log('[Scheduler] Stopping all schedulers...')
  for (const [userId, tasks] of activeSchedulers) {
    for (const task of tasks) {
      task.stop()
    }
    console.log(`[Scheduler] Stopped scheduler for user ${userId}`)
  }
  activeSchedulers.clear()
}

/**
 * 활성 스케줄러 목록 조회
 */
export function getActiveSchedulers(): number[] {
  return Array.from(activeSchedulers.keys())
}

// 프로세스 종료 시 스케줄러 정리
process.on('SIGTERM', () => {
  console.log('[Scheduler] Received SIGTERM, stopping schedulers...')
  stopAllSchedulers()
})

process.on('SIGINT', () => {
  console.log('[Scheduler] Received SIGINT, stopping schedulers...')
  stopAllSchedulers()
})
