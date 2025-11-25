/**
 * Workflow Service
 * WorkflowLog 생성/업데이트 및 통계 조회
 */

import { PrismaClient, WorkflowType, WorkflowStatus } from '@prisma/client'
import { WorkflowLogInput, WorkflowLogUpdate, AutomationStats } from './types'

const prisma = new PrismaClient()

// =============================================
// WORKFLOW LOG MANAGEMENT
// =============================================

/**
 * 워크플로우 로그 생성
 */
export async function createWorkflowLog(input: WorkflowLogInput): Promise<number> {
  const log = await prisma.workflowLog.create({
    data: {
      userId: input.userId,
      workflowType: input.workflowType,
      status: WorkflowStatus.RUNNING,
      startedAt: new Date(),
    }
  })
  return log.id
}

/**
 * 워크플로우 로그 업데이트
 */
export async function updateWorkflowLog(
  logId: number,
  update: WorkflowLogUpdate
): Promise<void> {
  await prisma.workflowLog.update({
    where: { id: logId },
    data: {
      ...update,
      details: update.details ? JSON.parse(JSON.stringify(update.details)) : undefined,
    }
  })
}

/**
 * 워크플로우 완료 처리
 */
export async function completeWorkflowLog(
  logId: number,
  success: boolean,
  totalItems: number,
  successCount: number,
  failedCount: number,
  details: Record<string, any>,
  errorMessage?: string
): Promise<void> {
  const status = failedCount === 0
    ? WorkflowStatus.COMPLETED
    : successCount > 0
      ? WorkflowStatus.PARTIAL_SUCCESS
      : WorkflowStatus.FAILED

  await updateWorkflowLog(logId, {
    status,
    completedAt: new Date(),
    totalItems,
    successCount,
    failedCount,
    details,
    errorMessage,
  })
}

/**
 * 워크플로우 실패 처리
 */
export async function failWorkflowLog(
  logId: number,
  errorMessage: string,
  details?: Record<string, any>
): Promise<void> {
  await updateWorkflowLog(logId, {
    status: WorkflowStatus.FAILED,
    completedAt: new Date(),
    errorMessage,
    details,
  })
}

// =============================================
// STATS QUERIES
// =============================================

/**
 * 자동화 통계 조회 (헤더용)
 */
export async function getAutomationStats(userId: number): Promise<AutomationStats> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 오늘 수집된 게시물 수
  const todayCollected = await prisma.post.count({
    where: {
      userId,
      createdAt: { gte: today }
    }
  })

  // AI 변환 대기 중인 게시물 수 (상품이 없는 게시물)
  const pendingTransform = await prisma.post.count({
    where: {
      userId,
      product: null
    }
  })

  // 발행 준비된 상품 수 (DRAFT 상태)
  const readyToPublish = await prisma.product.count({
    where: {
      userId,
      status: 'DRAFT'
    }
  })

  // 오늘 발행된 상품 수
  const todayPublished = await prisma.publishHistory.count({
    where: {
      userId,
      status: 'SUCCESS',
      publishedAt: { gte: today }
    }
  })

  return {
    todayCollected,
    pendingTransform,
    readyToPublish,
    todayPublished,
  }
}

/**
 * 최근 워크플로우 로그 조회
 */
export async function getRecentWorkflowLogs(
  userId: number,
  limit: number = 10
) {
  return prisma.workflowLog.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
}

/**
 * 특정 타입 워크플로우 로그 조회
 */
export async function getWorkflowLogsByType(
  userId: number,
  workflowType: WorkflowType,
  limit: number = 10
) {
  return prisma.workflowLog.findMany({
    where: {
      userId,
      workflowType,
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
}

/**
 * 실행 중인 워크플로우 확인
 */
export async function getRunningWorkflow(userId: number) {
  return prisma.workflowLog.findFirst({
    where: {
      userId,
      status: WorkflowStatus.RUNNING,
    },
    orderBy: { startedAt: 'desc' },
  })
}

/**
 * 워크플로우 통계 (일별)
 */
export async function getDailyWorkflowStats(userId: number, days: number = 7) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const logs = await prisma.workflowLog.findMany({
    where: {
      userId,
      startedAt: { gte: startDate },
    },
    orderBy: { startedAt: 'asc' },
  })

  // 날짜별 그룹화
  const dailyStats: Record<string, {
    date: string
    collect: { total: number, success: number, failed: number }
    transform: { total: number, success: number, failed: number }
    publish: { total: number, success: number, failed: number }
  }> = {}

  for (const log of logs) {
    const dateKey = log.startedAt.toISOString().split('T')[0]

    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = {
        date: dateKey,
        collect: { total: 0, success: 0, failed: 0 },
        transform: { total: 0, success: 0, failed: 0 },
        publish: { total: 0, success: 0, failed: 0 },
      }
    }

    const typeKey = log.workflowType.toLowerCase() as 'collect' | 'transform' | 'publish'
    if (typeKey in dailyStats[dateKey]) {
      dailyStats[dateKey][typeKey].total++
      if (log.status === WorkflowStatus.COMPLETED) {
        dailyStats[dateKey][typeKey].success++
      } else if (log.status === WorkflowStatus.FAILED) {
        dailyStats[dateKey][typeKey].failed++
      }
    }
  }

  return Object.values(dailyStats)
}
