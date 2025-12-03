/**
 * Workflow Service
 * WorkflowLog 생성/업데이트 및 통계 조회
 */

import prisma, { WorkflowType, WorkflowStatus, TriggerType } from '@bandauto/db'
import { WorkflowLogInput, WorkflowLogUpdate, AutomationStats } from './types'

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
      triggerType: input.triggerType ?? TriggerType.MANUAL,
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
      details: update.details ? JSON.stringify(update.details) : undefined,
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

  // 에러 메시지 길이 제한
  const truncatedMessage = errorMessage && errorMessage.length > 1000
    ? errorMessage.substring(0, 1000) + '...(truncated)'
    : errorMessage

  // details 내 에러 배열 크기 제한 (각 채널별 최대 5개 에러만)
  const sanitizedDetails = sanitizeDetails(details)

  await updateWorkflowLog(logId, {
    status,
    completedAt: new Date(),
    totalItems,
    successCount,
    failedCount,
    details: sanitizedDetails,
    errorMessage: truncatedMessage,
  })
}

/**
 * details 객체 내 에러 배열 크기 제한
 */
function sanitizeDetails(details: Record<string, any>): Record<string, any> {
  if (!details) return details

  const sanitized = { ...details }

  // collection 결과의 에러 배열 제한
  if (sanitized.collection?.channelResults) {
    sanitized.collection = {
      ...sanitized.collection,
      channelResults: sanitized.collection.channelResults.map((cr: any) => ({
        ...cr,
        errors: cr.errors?.slice(0, 5) || [], // 채널당 최대 5개 에러
      })),
    }
  }

  // transform 결과의 에러 배열 제한
  if (sanitized.transform?.errors) {
    sanitized.transform = {
      ...sanitized.transform,
      errors: sanitized.transform.errors.slice(0, 10), // 최대 10개 에러
    }
  }

  // publish 결과의 에러 배열 제한
  if (sanitized.publish?.errors) {
    sanitized.publish = {
      ...sanitized.publish,
      errors: sanitized.publish.errors.slice(0, 10), // 최대 10개 에러
    }
  }

  return sanitized
}

/**
 * 워크플로우 실패 처리
 */
export async function failWorkflowLog(
  logId: number,
  errorMessage: string,
  details?: Record<string, any>
): Promise<void> {
  // 에러 메시지 길이 제한 (DB 컬럼 제한 및 중첩 에러 방지)
  const truncatedMessage = errorMessage && errorMessage.length > 1000
    ? errorMessage.substring(0, 1000) + '...(truncated)'
    : errorMessage

  await updateWorkflowLog(logId, {
    status: WorkflowStatus.FAILED,
    completedAt: new Date(),
    errorMessage: truncatedMessage,
    details,
  })
}

/**
 * 워크플로우 진행 상황 업데이트 (실시간)
 */
export async function updateWorkflowProgress(
  logId: number,
  totalItems: number,
  successCount: number,
  failedCount: number
): Promise<void> {
  await prisma.workflowLog.update({
    where: { id: logId },
    data: {
      totalItems,
      successCount,
      failedCount,
    },
  })
}

// =============================================
// STATS QUERIES
// =============================================

/**
 * 자동화 통계 조회 (헤더용)
 */
export async function getAutomationStats(
  userId: number,
  startDate?: Date,
  endDate?: Date
): Promise<AutomationStats> {
  // 기본값: 오늘
  const periodStart = startDate || (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })()

  const periodEnd = endDate || (() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return today
  })()

  // 병렬로 모든 통계 조회
  const [
    totalPosts,
    periodCollected,
    pendingTransform,
    totalTransformed,
    periodTransformedPosts,
    totalProducts,
    periodProductsCount,
    readyToPublish,
    allPublishedProducts,
    periodPublishedProducts,
  ] = await Promise.all([
    // 전체 게시물 수
    prisma.collectedPost.count({
      where: { userId }
    }),

    // 기간 내 수집된 게시물 수
    prisma.collectedPost.count({
      where: {
        userId,
        createdAt: { gte: periodStart, lte: periodEnd }
      }
    }),

    // AI 변환 대기 중인 게시물 수 (CollectedProduct가 없는 게시물)
    prisma.collectedPost.count({
      where: {
        userId,
        collectedProducts: {
          none: {},
        },
      }
    }),

    // AI 변환 완료된 게시물 수 (CollectedProduct가 있는 게시물)
    prisma.collectedPost.count({
      where: {
        userId,
        collectedProducts: {
          some: {},
        },
      }
    }),

    // 기간 내 AI 변환 완료된 게시물 수
    prisma.collectedProduct.findMany({
      where: {
        userId,
        createdAt: { gte: periodStart, lte: periodEnd }
      },
      distinct: ['postId'],
      select: { postId: true }
    }),

    // 전체 상품 수
    prisma.product.count({
      where: { userId }
    }),

    // 기간 내 등록된 상품 수
    prisma.product.count({
      where: {
        userId,
        createdAt: { gte: periodStart, lte: periodEnd }
      }
    }),

    // 발행 준비된 상품 수 (미발행 상품)
    prisma.product.count({
      where: {
        userId,
        publishedProducts: {
          none: {}
        }
      }
    }),

    // 전체 발행된 상품 수 (distinct productId)
    prisma.publishedProduct.findMany({
      where: { userId },
      distinct: ['productId'],
      select: { productId: true }
    }),

    // 기간 내 발행된 상품 수 (같은 상품은 1개로 카운트)
    prisma.publishedProduct.findMany({
      where: {
        userId,
        publishedAt: { gte: periodStart, lte: periodEnd }
      },
      distinct: ['productId'],
      select: { productId: true }
    }),
  ])

  return {
    // 기존 필드 (이제 기간 기준)
    todayCollected: periodCollected,
    pendingTransform,
    readyToPublish,
    todayPublished: periodPublishedProducts.length,

    // 전체 진행률 계산용 추가 필드
    totalPosts,
    totalTransformed,
    totalProducts,
    totalPublishedProducts: allPublishedProducts.length,

    // 기간 내 통계
    todayTransformed: periodTransformedPosts.length,
    todayProducts: periodProductsCount,
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

// 자동 정리 임계값 (분)
const AUTO_CLEANUP_THRESHOLD_MINUTES = 15

/**
 * 실행 중인 워크플로우 확인
 * - 15분 이상 RUNNING 상태인 워크플로우는 자동으로 실패 처리
 */
export async function getRunningWorkflow(userId: number) {
  const cutoffTime = new Date()
  cutoffTime.setMinutes(cutoffTime.getMinutes() - AUTO_CLEANUP_THRESHOLD_MINUTES)

  // 먼저 오래된 stuck 워크플로우를 자동 정리
  const staleWorkflow = await prisma.workflowLog.findFirst({
    where: {
      userId,
      status: WorkflowStatus.RUNNING,
      startedAt: { lt: cutoffTime },
    },
  })

  if (staleWorkflow) {
    console.log(`[WorkflowService] Auto-cleaning stale workflow ${staleWorkflow.id} (started at ${staleWorkflow.startedAt})`)
    await prisma.workflowLog.update({
      where: { id: staleWorkflow.id },
      data: {
        status: WorkflowStatus.FAILED,
        completedAt: new Date(),
        errorMessage: `워크플로우가 ${AUTO_CLEANUP_THRESHOLD_MINUTES}분 이상 응답이 없어 자동 종료되었습니다. AI API 연결 문제일 수 있습니다.`,
      },
    })
  }

  // 정상적인 실행 중 워크플로우 반환
  return prisma.workflowLog.findFirst({
    where: {
      userId,
      status: WorkflowStatus.RUNNING,
    },
    orderBy: { startedAt: 'desc' },
  })
}

/**
 * 워크플로우 취소 (RUNNING -> FAILED로 변경)
 */
export async function cancelWorkflow(
  workflowId: number,
  userId: number
): Promise<boolean> {
  const workflow = await prisma.workflowLog.findFirst({
    where: {
      id: workflowId,
      userId,
      status: WorkflowStatus.RUNNING,
    },
  })

  if (!workflow) {
    return false
  }

  await prisma.workflowLog.update({
    where: { id: workflowId },
    data: {
      status: WorkflowStatus.FAILED,
      completedAt: new Date(),
      errorMessage: '사용자에 의해 취소됨',
    },
  })

  return true
}

/**
 * 오래된 RUNNING 워크플로우 정리 (서버 재시작 등의 이유로 stuck 된 경우)
 * @param userId 사용자 ID
 * @param maxAgeMinutes 이 시간(분) 이상 RUNNING인 워크플로우를 정리
 */
export async function cleanupStaleWorkflows(
  userId: number,
  maxAgeMinutes: number = 30
): Promise<number> {
  const cutoffTime = new Date()
  cutoffTime.setMinutes(cutoffTime.getMinutes() - maxAgeMinutes)

  const result = await prisma.workflowLog.updateMany({
    where: {
      userId,
      status: WorkflowStatus.RUNNING,
      startedAt: { lt: cutoffTime },
    },
    data: {
      status: WorkflowStatus.FAILED,
      completedAt: new Date(),
      errorMessage: '타임아웃으로 인한 자동 취소',
    },
  })

  return result.count
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
