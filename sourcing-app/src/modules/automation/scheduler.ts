/**
 * Automation Scheduler
 * node-cron을 사용한 자동화 스케줄러
 */

import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { executeFullPipeline } from './executor'

const prisma = new PrismaClient()

// 활성 스케줄러 저장
const activeSchedulers: Map<number, cron.ScheduledTask> = new Map()

/**
 * 스케줄러 초기화
 * 애플리케이션 시작 시 호출
 */
export async function initializeScheduler(): Promise<void> {
  console.log('[Scheduler] Initializing automation scheduler...')

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

    console.log(`[Scheduler] Found ${configs.length} active automation configs`)

    // 각 설정에 대해 스케줄러 등록
    for (const config of configs) {
      if (config.cronExpression) {
        registerScheduler(config.user.id, config.cronExpression)
      }
    }

    console.log('[Scheduler] Initialization complete')
  } catch (error) {
    console.error('[Scheduler] Initialization failed:', error)
  }
}

/**
 * 스케줄러 등록
 */
export function registerScheduler(userId: number, cronExpression: string): void {
  // 기존 스케줄러가 있으면 제거
  unregisterScheduler(userId)

  // cron 표현식 유효성 검사
  if (!cron.validate(cronExpression)) {
    console.error(`[Scheduler] Invalid cron expression for user ${userId}: ${cronExpression}`)
    return
  }

  console.log(`[Scheduler] Registering scheduler for user ${userId}: ${cronExpression}`)

  const task = cron.schedule(cronExpression, async () => {
    console.log(`[Scheduler] Running scheduled task for user ${userId}`)
    try {
      const result = await executeFullPipeline(userId)
      console.log(`[Scheduler] Task completed for user ${userId}: ${result.overallStatus}`)
    } catch (error) {
      console.error(`[Scheduler] Task failed for user ${userId}:`, error)
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Seoul',
  })

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
