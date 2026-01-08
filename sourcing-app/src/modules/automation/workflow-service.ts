/**
 * Workflow Service
 * WorkflowLog 생성/업데이트 및 통계 조회
 */

import prisma, { WorkflowType, WorkflowStatus, TriggerType, StepType, StepStatus } from '@bandauto/db'
import { WorkflowLogInput, WorkflowLogUpdate, AutomationStats } from './types'

// =============================================
// EXECUTION LOCK (중복 실행 방지)
// =============================================

/**
 * 실행 Lock 획득 (트랜잭션 기반)
 * 동시 실행 방지를 위해 워크플로우 생성과 중복 체크를 원자적으로 수행
 *
 * @returns 성공 시 워크플로우 ID, 실패 시 null
 */
export async function acquireExecutionLock(
  userId: number,
  workflowType: WorkflowType,
  triggerType: TriggerType = TriggerType.MANUAL
): Promise<number | null> {
  try {
    // 트랜잭션으로 원자적 Lock 획득
    const result = await prisma.$transaction(async (tx) => {
      // 1. 기존 RUNNING 워크플로우 확인 (15분 이상 stuck 체크 포함)
      const cutoffTime = new Date()
      cutoffTime.setMinutes(cutoffTime.getMinutes() - 15)

      // 오래된 stuck 워크플로우 자동 정리
      await tx.workflowLog.updateMany({
        where: {
          userId,
          status: WorkflowStatus.RUNNING,
          startedAt: { lt: cutoffTime },
        },
        data: {
          status: WorkflowStatus.FAILED,
          completedAt: new Date(),
          errorMessage: '워크플로우가 15분 이상 응답이 없어 자동 종료되었습니다.',
        },
      })

      // 2. 현재 RUNNING 상태인 워크플로우 확인
      const existing = await tx.workflowLog.findFirst({
        where: {
          userId,
          status: WorkflowStatus.RUNNING,
        },
      })

      // 이미 실행 중이면 null 반환 (Lock 획득 실패)
      if (existing) {
        console.log(`[WorkflowService] Lock 획득 실패 - 이미 실행 중 (workflow: ${existing.id})`)
        return null
      }

      // 3. 새 워크플로우 생성 (Lock 역할)
      const log = await tx.workflowLog.create({
        data: {
          userId,
          workflowType,
          triggerType,
          status: WorkflowStatus.RUNNING,
          startedAt: new Date(),
        },
      })

      console.log(`[WorkflowService] Lock 획득 성공 (workflow: ${log.id})`)
      return log.id
    })

    return result
  } catch (error: any) {
    console.error('[WorkflowService] Lock 획득 중 오류:', error)
    return null
  }
}

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
  // details를 분리하여 JSON.stringify 처리 (객체가 직접 DB에 전달되는 것 방지)
  const { details, ...rest } = update

  await prisma.workflowLog.update({
    where: { id: logId },
    data: {
      ...rest,
      ...(details !== undefined && { details: JSON.stringify(details) }),
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
 * details를 함께 저장하여 작업마다 로그 확인 가능
 */
export async function updateWorkflowProgress(
  logId: number,
  totalItems: number,
  successCount: number,
  failedCount: number,
  details?: Record<string, any>
): Promise<void> {
  const updateData: any = {
    totalItems,
    successCount,
    failedCount,
  }

  if (details) {
    updateData.details = JSON.stringify(sanitizeDetails(details))
  }

  await prisma.workflowLog.update({
    where: { id: logId },
    data: updateData,
  })
}

// =============================================
// STEP LOG MANAGEMENT
// =============================================

/**
 * 단계 순서 매핑
 */
const STEP_ORDER: Record<StepType, number> = {
  [StepType.COLLECTION]: 1,
  [StepType.TRANSFORM]: 2,
  [StepType.PRODUCT_CREATE]: 3,
  [StepType.PUBLISH]: 4,
}

/**
 * 워크플로우 단계 시작
 * 단계 로그를 생성하고 워크플로우의 현재 단계를 업데이트
 * 트랜잭션으로 두 작업을 원자적으로 실행
 */
export async function startWorkflowStep(
  workflowId: number,
  stepType: StepType,
  totalItems: number = 0
): Promise<number> {
  const stepOrder = STEP_ORDER[stepType]

  const step = await prisma.$transaction(async (tx) => {
    // 1. 단계 로그 생성/업데이트
    const stepLog = await tx.workflowStepLog.upsert({
      where: {
        workflowId_stepType: { workflowId, stepType }
      },
      create: {
        workflowId,
        stepType,
        stepOrder,
        status: StepStatus.RUNNING,
        startedAt: new Date(),
        totalItems,
      },
      update: {
        status: StepStatus.RUNNING,
        startedAt: new Date(),
        totalItems,
        processedItems: 0,
        successCount: 0,
        failedCount: 0,
        completedAt: null,
        errorMessage: null,
      }
    })

    // 2. 현재 단계 업데이트
    await tx.workflowLog.update({
      where: { id: workflowId },
      data: { currentStep: stepType }
    })

    return stepLog
  })

  console.log(`[WorkflowService] Step ${stepType} started (workflow: ${workflowId}, stepId: ${step.id})`)
  return step.id
}

/**
 * 워크플로우 단계 진행 상황 업데이트
 */
export async function updateStepProgress(
  workflowId: number,
  stepType: StepType,
  progress: {
    processedItems?: number
    successCount?: number
    failedCount?: number
    totalItems?: number
    details?: Record<string, any>
  }
): Promise<void> {
  const updateData: Record<string, any> = {}

  if (progress.processedItems !== undefined) {
    updateData.processedItems = progress.processedItems
  }
  if (progress.successCount !== undefined) {
    updateData.successCount = progress.successCount
  }
  if (progress.failedCount !== undefined) {
    updateData.failedCount = progress.failedCount
  }
  if (progress.totalItems !== undefined) {
    updateData.totalItems = progress.totalItems
  }
  if (progress.details !== undefined) {
    updateData.details = JSON.stringify(progress.details)
  }

  await prisma.workflowStepLog.update({
    where: {
      workflowId_stepType: { workflowId, stepType }
    },
    data: updateData
  })
}

/**
 * 워크플로우 단계 완료 처리
 */
export async function completeWorkflowStep(
  workflowId: number,
  stepType: StepType,
  result: {
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED'
    successCount: number
    failedCount: number
    processedItems?: number
    details?: Record<string, any>
    errorMessage?: string
  }
): Promise<void> {
  const stepStatus = StepStatus[result.status]

  // 에러 메시지 길이 제한
  const truncatedMessage = result.errorMessage && result.errorMessage.length > 1000
    ? result.errorMessage.substring(0, 1000) + '...(truncated)'
    : result.errorMessage

  await prisma.workflowStepLog.update({
    where: {
      workflowId_stepType: { workflowId, stepType }
    },
    data: {
      status: stepStatus,
      completedAt: new Date(),
      successCount: result.successCount,
      failedCount: result.failedCount,
      processedItems: result.processedItems ?? (result.successCount + result.failedCount),
      details: result.details ? JSON.stringify(result.details) : undefined,
      errorMessage: truncatedMessage,
    }
  })

  console.log(`[WorkflowService] Step ${stepType} completed with status ${result.status} (workflow: ${workflowId})`)
}

/**
 * 워크플로우의 모든 단계 조회
 */
export async function getWorkflowSteps(workflowId: number) {
  return prisma.workflowStepLog.findMany({
    where: { workflowId },
    orderBy: { stepOrder: 'asc' }
  })
}

/**
 * 워크플로우 상세 조회 (단계 포함)
 */
export async function getWorkflowWithSteps(workflowId: number) {
  return prisma.workflowLog.findUnique({
    where: { id: workflowId },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' }
      }
    }
  })
}

/**
 * 워크플로우의 현재 진행 중인 단계 조회
 */
export async function getCurrentStep(workflowId: number) {
  return prisma.workflowStepLog.findFirst({
    where: {
      workflowId,
      status: StepStatus.RUNNING
    }
  })
}

/**
 * 워크플로우 완료 시 현재 단계 초기화
 */
export async function clearCurrentStep(workflowId: number): Promise<void> {
  await prisma.workflowLog.update({
    where: { id: workflowId },
    data: { currentStep: null }
  })
}

/**
 * 워크플로우의 RUNNING 상태인 모든 step을 FAILED로 변경
 * 에러 발생 시 catch 블록에서 호출하여 step 상태 정리
 */
export async function failRunningSteps(
  workflowId: number,
  errorMessage?: string
): Promise<number> {
  const truncatedMessage = errorMessage && errorMessage.length > 1000
    ? errorMessage.substring(0, 1000) + '...(truncated)'
    : errorMessage

  const result = await prisma.workflowStepLog.updateMany({
    where: {
      workflowId,
      status: StepStatus.RUNNING,
    },
    data: {
      status: StepStatus.FAILED,
      completedAt: new Date(),
      errorMessage: truncatedMessage || '워크플로우 실행 중 오류 발생',
    },
  })

  if (result.count > 0) {
    console.log(`[WorkflowService] ${result.count}개의 RUNNING step을 FAILED로 변경 (workflow: ${workflowId})`)
  }

  return result.count
}

// =============================================
// STATS QUERIES
// =============================================

// Raw SQL 결과 타입
interface RawStatsResult {
  totalPosts: bigint
  periodCollected: bigint
  pendingTransform: bigint
  totalTransformed: bigint
  periodTransformed: bigint
  totalProducts: bigint
  periodProducts: bigint
  readyToPublish: bigint
  totalPublishedProducts: bigint
  periodPublishedProducts: bigint
}

/**
 * 자동화 통계 조회 (헤더용)
 * 단일 Raw SQL 쿼리로 모든 통계를 한 번에 조회 (10개 쿼리 -> 1개 쿼리)
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

  // 단일 쿼리로 모든 통계 조회
  const stats = await prisma.$queryRaw<RawStatsResult[]>`
    SELECT
      -- 전체 게시물 수
      (SELECT COUNT(*) FROM collected_post WHERE user_id = ${userId}) as totalPosts,

      -- 기간 내 수집된 게시물 수
      (SELECT COUNT(*) FROM collected_post
       WHERE user_id = ${userId}
       AND created_at >= ${periodStart} AND created_at <= ${periodEnd}) as periodCollected,

      -- AI 변환 대기 중인 게시물 수 (CollectedProduct가 없는 게시물)
      (SELECT COUNT(*) FROM collected_post cp
       WHERE cp.user_id = ${userId}
       AND NOT EXISTS (SELECT 1 FROM collected_product cpr WHERE cpr.collected_post_id = cp.id)) as pendingTransform,

      -- AI 변환 완료된 게시물 수 (CollectedProduct가 있는 게시물)
      (SELECT COUNT(*) FROM collected_post cp
       WHERE cp.user_id = ${userId}
       AND EXISTS (SELECT 1 FROM collected_product cpr WHERE cpr.collected_post_id = cp.id)) as totalTransformed,

      -- 기간 내 AI 변환 완료된 게시물 수 (distinct postId)
      (SELECT COUNT(DISTINCT collected_post_id) FROM collected_product
       WHERE user_id = ${userId}
       AND created_at >= ${periodStart} AND created_at <= ${periodEnd}) as periodTransformed,

      -- 전체 상품 수
      (SELECT COUNT(*) FROM product WHERE user_id = ${userId}) as totalProducts,

      -- 기간 내 등록된 상품 수
      (SELECT COUNT(*) FROM product
       WHERE user_id = ${userId}
       AND created_at >= ${periodStart} AND created_at <= ${periodEnd}) as periodProducts,

      -- 발행 준비된 상품 수 (미발행 상품)
      (SELECT COUNT(*) FROM product p
       WHERE p.user_id = ${userId}
       AND NOT EXISTS (SELECT 1 FROM channel_product cp WHERE cp.product_id = p.id)) as readyToPublish,

      -- 전체 발행 횟수 (채널별 발행 수)
      (SELECT COUNT(*) FROM channel_product WHERE user_id = ${userId}) as totalPublishedProducts,

      -- 기간 내 발행 횟수 (채널별 발행 수)
      (SELECT COUNT(*) FROM channel_product
       WHERE user_id = ${userId}
       AND published_at >= ${periodStart} AND published_at <= ${periodEnd}) as periodPublishedProducts
  `

  const result = stats[0]

  return {
    // 기존 필드 (이제 기간 기준)
    todayCollected: Number(result.periodCollected),
    pendingTransform: Number(result.pendingTransform),
    readyToPublish: Number(result.readyToPublish),
    todayPublished: Number(result.periodPublishedProducts),

    // 전체 진행률 계산용 추가 필드
    totalPosts: Number(result.totalPosts),
    totalTransformed: Number(result.totalTransformed),
    totalProducts: Number(result.totalProducts),
    totalPublishedProducts: Number(result.totalPublishedProducts),

    // 기간 내 통계
    todayTransformed: Number(result.periodTransformed),
    todayProducts: Number(result.periodProducts),
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
 * 워크플로우를 세션 대기 상태로 변경
 * 세션 만료 시 호출되어 프론트엔드에서 세션 저장을 기다림
 */
export async function setWaitingSessionStatus(
  logId: number,
  pendingItems: { productIds: number[]; channelId: number },
  currentProgress?: { successCount: number; failedCount: number; totalItems: number }
): Promise<void> {
  await prisma.workflowLog.update({
    where: { id: logId },
    data: {
      status: WorkflowStatus.WAITING_SESSION,
      details: JSON.stringify({
        waitingSession: true,
        pendingItems,
        currentProgress,
        waitingSince: new Date().toISOString(),
      }),
    },
  })
  console.log(`[WorkflowService] 워크플로우 ${logId} 세션 대기 상태로 변경`)
}

/**
 * 세션 대기 중인 워크플로우 조회
 */
export async function getWaitingSessionWorkflow(userId: number) {
  return prisma.workflowLog.findFirst({
    where: {
      userId,
      status: WorkflowStatus.WAITING_SESSION,
    },
    orderBy: { startedAt: 'desc' },
  })
}

/**
 * 세션 대기 워크플로우를 RUNNING 상태로 재개
 */
export async function resumeWorkflow(logId: number): Promise<{
  pendingItems: { productIds: number[]; channelId: number } | null
  currentProgress: { successCount: number; failedCount: number; totalItems: number } | null
}> {
  const workflow = await prisma.workflowLog.findUnique({
    where: { id: logId },
  })

  if (!workflow || workflow.status !== WorkflowStatus.WAITING_SESSION) {
    throw new Error('재개할 수 있는 워크플로우가 없습니다')
  }

  const details = workflow.details ? JSON.parse(workflow.details as string) : {}

  await prisma.workflowLog.update({
    where: { id: logId },
    data: {
      status: WorkflowStatus.RUNNING,
      details: JSON.stringify({
        ...details,
        waitingSession: false,
        resumedAt: new Date().toISOString(),
      }),
    },
  })

  console.log(`[WorkflowService] 워크플로우 ${logId} 재개`)

  return {
    pendingItems: details.pendingItems || null,
    currentProgress: details.currentProgress || null,
  }
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

// 시간대별 통계 Raw SQL 결과 타입
interface HourlyStatsRawResult {
  hour: number
  collect: bigint
  transform: bigint
  productCreate: bigint
  publish: bigint
}

/**
 * 기간별 시간대별 통계 조회 (실제 DB 테이블 기반)
 * WorkflowLog가 아닌 실제 데이터 테이블에서 시간대별 집계
 * @param userId 사용자 ID
 * @param startDate 시작 날짜 (기본값: 오늘 00:00:00)
 * @param endDate 종료 날짜 (기본값: 오늘 23:59:59)
 */
export async function getHourlyWorkflowStats(
  userId: number,
  startDate?: Date,
  endDate?: Date
) {
  // 기본값: 오늘
  const start = startDate || (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })()

  const end = endDate || (() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return today
  })()

  // 단일 Raw SQL 쿼리로 시간대별 통계 조회 (한국 시간 KST 기준)
  const stats = await prisma.$queryRaw<HourlyStatsRawResult[]>`
    SELECT
      hours.hour,
      COALESCE(cp_stats.cnt, 0) as collect,
      COALESCE(cpr_stats.cnt, 0) as transform,
      COALESCE(p_stats.cnt, 0) as productCreate,
      COALESCE(pp_stats.cnt, 0) as publish
    FROM (
      SELECT 0 as hour UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
      UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11
      UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17
      UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23
    ) hours
    LEFT JOIN (
      SELECT HOUR(CONVERT_TZ(created_at, '+00:00', '+09:00')) as hour, COUNT(*) as cnt
      FROM collected_post
      WHERE user_id = ${userId}
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY HOUR(CONVERT_TZ(created_at, '+00:00', '+09:00'))
    ) cp_stats ON hours.hour = cp_stats.hour
    LEFT JOIN (
      SELECT HOUR(CONVERT_TZ(created_at, '+00:00', '+09:00')) as hour, COUNT(*) as cnt
      FROM collected_product
      WHERE user_id = ${userId}
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY HOUR(CONVERT_TZ(created_at, '+00:00', '+09:00'))
    ) cpr_stats ON hours.hour = cpr_stats.hour
    LEFT JOIN (
      SELECT HOUR(CONVERT_TZ(created_at, '+00:00', '+09:00')) as hour, COUNT(*) as cnt
      FROM product
      WHERE user_id = ${userId}
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY HOUR(CONVERT_TZ(created_at, '+00:00', '+09:00'))
    ) p_stats ON hours.hour = p_stats.hour
    LEFT JOIN (
      SELECT HOUR(CONVERT_TZ(published_at, '+00:00', '+09:00')) as hour, COUNT(*) as cnt
      FROM channel_product
      WHERE user_id = ${userId}
        AND published_at >= ${start}
        AND published_at <= ${end}
      GROUP BY HOUR(CONVERT_TZ(published_at, '+00:00', '+09:00'))
    ) pp_stats ON hours.hour = pp_stats.hour
    ORDER BY hours.hour
  `

  // bigint를 number로 변환하여 반환
  return stats.map(row => ({
    hour: Number(row.hour),
    collect: Number(row.collect),
    transform: Number(row.transform),
    productCreate: Number(row.productCreate),
    publish: Number(row.publish),
  }))
}
