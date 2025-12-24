/**
 * Automation Scheduler
 * node-cron을 사용한 자동화 스케줄러
 */

import * as cron from 'node-cron'
import prisma, { TriggerType, WorkflowType } from '@bandauto/db'
import { executeFullPipelineWithLock } from './executor'
import { acquireExecutionLock, getRunningWorkflow } from './workflow-service'

// 활성 스케줄러 저장
const activeSchedulers: Map<number, cron.ScheduledTask> = new Map()

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
 * 스케줄러 등록 (내부용, 로그 없음)
 */
function registerSchedulerSilent(userId: number, cronExpression: string): void {
  // 기존 스케줄러가 있으면 제거
  const existing = activeSchedulers.get(userId)
  if (existing) {
    existing.stop()
    activeSchedulers.delete(userId)
  }

  // cron 표현식 유효성 검사
  if (!cron.validate(cronExpression)) {
    return
  }

  const task = cron.schedule(cronExpression, async () => {
    console.log(`[Scheduler] 자동화 실행 시작 (user: ${userId})`)

    try {
      // 자동화 설정 조회하여 pipelineSteps 가져오기
      const config = await prisma.automationConfig.findUnique({
        where: { userId },
      })

      // pipelineSteps를 skip options로 변환
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

      // Lock 기반 실행 (중복 실행 자동 방지)
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

  activeSchedulers.set(userId, task)
}

/**
 * 스케줄러 등록 (외부 호출용)
 */
export function registerScheduler(userId: number, cronExpression: string): void {
  // 기존 스케줄러가 있으면 제거
  unregisterScheduler(userId)

  // cron 표현식 유효성 검사
  if (!cron.validate(cronExpression)) {
    console.error(`[Scheduler] 잘못된 cron 표현식: ${cronExpression}`)
    return
  }

  console.log(`[Scheduler] 스케줄러 등록 (user: ${userId})`)

  const task = cron.schedule(cronExpression, async () => {
    console.log(`[Scheduler] 자동화 실행 시작 (user: ${userId})`)

    try {
      // 자동화 설정 조회하여 pipelineSteps 가져오기
      const config = await prisma.automationConfig.findUnique({
        where: { userId },
      })

      // pipelineSteps를 skip options로 변환
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

      // Lock 기반 실행 (중복 실행 자동 방지)
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

  activeSchedulers.set(userId, task)
}

/**
 * 스케줄러 해제
 */
export function unregisterScheduler(userId: number): void {
  const existing = activeSchedulers.get(userId)
  if (existing) {
    existing.stop()
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
  for (const [userId, task] of activeSchedulers) {
    task.stop()
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
