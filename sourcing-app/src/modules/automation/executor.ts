/**
 * Pipeline Executor
 * 전체 자동화 파이프라인 실행
 */

import { PrismaClient, WorkflowType, WorkflowStatus, TriggerType } from '@bandauto/db'
import { setBatchContext, clearBatchContext, createBatchContextFromUserId } from './context'
import { runCollectionPipeline } from './pipelines/collection'
import { runTransformPipeline } from './pipelines/transform'
import { runPublishPipeline } from './pipelines/publish'
import {
  createWorkflowLog,
  completeWorkflowLog,
  failWorkflowLog,
} from './workflow-service'
import {
  FullPipelineConfig,
  FullPipelineResult,
  CollectionResult,
  TransformResult,
  PublishResult,
} from './types'

const prisma = new PrismaClient()

// =============================================
// INDIVIDUAL PIPELINE EXECUTORS
// =============================================

/**
 * 수집 파이프라인 실행 (with logging)
 */
export async function executeCollectionPipeline(
  userId: number,
  config?: Partial<FullPipelineConfig['collection']>,
  triggerType: TriggerType = TriggerType.MANUAL
): Promise<CollectionResult> {
  const context = await createBatchContextFromUserId(userId)

  const logId = await createWorkflowLog({
    userId,
    workflowType: WorkflowType.COLLECT,
    triggerType,
  })

  // context에 workflowLogId 설정
  context.workflowLogId = logId
  setBatchContext(context)

  try {
    // 자동화 설정 조회
    const automationConfig = await prisma.automationConfig.findUnique({
      where: { userId },
    })

    const collectionConfig = {
      collectFromAllBands: config?.collectFromAllBands ?? automationConfig?.collectFromAllBands ?? true,
      wholesaleBandIds: config?.wholesaleBandIds ?? (automationConfig?.wholesaleBandIds as number[] | undefined),
      limit: config?.limit ?? 20,
    }

    const result = await runCollectionPipeline(collectionConfig)

    await completeWorkflowLog(
      logId,
      result.success,
      result.totalItems,
      result.successCount,
      result.failedCount,
      result.details
    )

    return result
  } catch (error: any) {
    await failWorkflowLog(logId, error.message)
    throw error
  } finally {
    clearBatchContext()
  }
}

/**
 * 변환 파이프라인 실행 (with logging)
 */
export async function executeTransformPipeline(
  userId: number,
  config?: Partial<FullPipelineConfig['transform']>,
  triggerType: TriggerType = TriggerType.MANUAL
): Promise<TransformResult> {
  const context = await createBatchContextFromUserId(userId)

  const logId = await createWorkflowLog({
    userId,
    workflowType: WorkflowType.TRANSFORM,
    triggerType,
  })

  // context에 workflowLogId 설정
  context.workflowLogId = logId
  setBatchContext(context)

  try {
    // 자동화 설정 조회
    const automationConfig = await prisma.automationConfig.findUnique({
      where: { userId },
      include: {
        pricingPolicy: true,
      },
    })

    const transformConfig = {
      aiProvider: config?.aiProvider ?? automationConfig?.aiProvider ?? 'GEMINI',
      pricingPolicyId: config?.pricingPolicyId ?? automationConfig?.pricingPolicyId,
      pricingPolicyContent: config?.pricingPolicyContent ?? automationConfig?.pricingPolicy?.content,
      postIds: config?.postIds,
      transformPendingOnly: config?.transformPendingOnly ?? true,
    }

    const result = await runTransformPipeline(transformConfig)

    await completeWorkflowLog(
      logId,
      result.success,
      result.totalItems,
      result.successCount,
      result.failedCount,
      result.details
    )

    return result
  } catch (error: any) {
    await failWorkflowLog(logId, error.message)
    throw error
  } finally {
    clearBatchContext()
  }
}

/**
 * 발행 파이프라인 실행 (with logging)
 */
export async function executePublishPipeline(
  userId: number,
  config?: Partial<FullPipelineConfig['publish']>,
  triggerType: TriggerType = TriggerType.MANUAL
): Promise<PublishResult> {
  const context = await createBatchContextFromUserId(userId)

  const logId = await createWorkflowLog({
    userId,
    workflowType: WorkflowType.PUBLISH,
    triggerType,
  })

  // context에 workflowLogId 설정
  context.workflowLogId = logId
  setBatchContext(context)

  try {
    // 자동화 설정 조회
    const automationConfig = await prisma.automationConfig.findUnique({
      where: { userId },
    })

    if (!config?.retailBandIds && !automationConfig?.retailBandIds) {
      throw new Error('발행할 소매밴드가 설정되지 않았습니다')
    }

    const publishConfig = {
      retailBandIds: config?.retailBandIds ?? (automationConfig?.retailBandIds as number[]),
      productIds: config?.productIds,
      publishReadyOnly: config?.publishReadyOnly ?? true,
    }

    const result = await runPublishPipeline(publishConfig)

    await completeWorkflowLog(
      logId,
      result.success,
      result.totalItems,
      result.successCount,
      result.failedCount,
      result.details
    )

    return result
  } catch (error: any) {
    await failWorkflowLog(logId, error.message)
    throw error
  } finally {
    clearBatchContext()
  }
}

// =============================================
// FULL PIPELINE EXECUTOR
// =============================================

/**
 * 전체 파이프라인 실행
 * 수집 → 변환 → 발행 순서로 실행
 */
export async function executeFullPipeline(
  userId: number,
  options?: {
    skipCollection?: boolean
    skipTransform?: boolean
    skipPublish?: boolean
  },
  triggerType: TriggerType = TriggerType.MANUAL
): Promise<FullPipelineResult> {
  const context = await createBatchContextFromUserId(userId)
  setBatchContext(context)

  const startedAt = new Date()
  const logId = await createWorkflowLog({
    userId,
    workflowType: WorkflowType.FULL_PIPELINE,
    triggerType,
  })

  let collectionResult: CollectionResult | undefined
  let transformResult: TransformResult | undefined
  let publishResult: PublishResult | undefined

  try {
    console.log(`[FullPipeline] Starting for user ${userId}`)

    // 자동화 설정 조회
    const automationConfig = await prisma.automationConfig.findUnique({
      where: { userId },
      include: {
        pricingPolicy: true,
      },
    })

    if (!automationConfig) {
      throw new Error('자동화 설정이 없습니다')
    }

    // 1. 수집 단계
    if (!options?.skipCollection) {
      console.log('[FullPipeline] Step 1: Collection')
      collectionResult = await runCollectionPipeline({
        collectFromAllBands: automationConfig.collectFromAllBands,
        wholesaleBandIds: automationConfig.wholesaleBandIds as number[] | undefined,
      })
      console.log(`[FullPipeline] Collection completed: ${collectionResult.successCount} new posts`)
    }

    // 2. 변환 단계
    if (!options?.skipTransform) {
      console.log('[FullPipeline] Step 2: Transform')
      transformResult = await runTransformPipeline({
        aiProvider: automationConfig.aiProvider,
        pricingPolicyId: automationConfig.pricingPolicyId,
        pricingPolicyContent: automationConfig.pricingPolicy?.content,
        transformPendingOnly: true,
      })
      console.log(`[FullPipeline] Transform completed: ${transformResult.successCount} products created`)
    }

    // 3. 발행 단계 (autoPublish가 true인 경우에만)
    if (!options?.skipPublish && automationConfig.autoPublish) {
      const retailBandIds = automationConfig.retailBandIds as number[] | undefined
      if (retailBandIds?.length) {
        console.log('[FullPipeline] Step 3: Publish')
        publishResult = await runPublishPipeline({
          retailBandIds,
          publishReadyOnly: true,
        })
        console.log(`[FullPipeline] Publish completed: ${publishResult.successCount} published`)
      }
    }

    const completedAt = new Date()

    // 전체 결과 집계
    const totalItems =
      (collectionResult?.totalItems || 0) +
      (transformResult?.totalItems || 0) +
      (publishResult?.totalItems || 0)
    const successCount =
      (collectionResult?.successCount || 0) +
      (transformResult?.successCount || 0) +
      (publishResult?.successCount || 0)
    const failedCount =
      (collectionResult?.failedCount || 0) +
      (transformResult?.failedCount || 0) +
      (publishResult?.failedCount || 0)

    // 상태 결정
    let overallStatus: WorkflowStatus
    if (failedCount === 0) {
      overallStatus = WorkflowStatus.COMPLETED
    } else if (successCount > 0) {
      overallStatus = WorkflowStatus.PARTIAL_SUCCESS
    } else {
      overallStatus = WorkflowStatus.FAILED
    }

    await completeWorkflowLog(logId, overallStatus === WorkflowStatus.COMPLETED, totalItems, successCount, failedCount, {
      collection: collectionResult?.details,
      transform: transformResult?.details,
      publish: publishResult?.details,
    })

    // 다음 실행 시간 업데이트
    if (automationConfig.cronExpression) {
      const nextRunAt = calculateNextRunTime(automationConfig.cronExpression)
      await prisma.automationConfig.update({
        where: { userId },
        data: {
          lastRunAt: new Date(),
          nextRunAt,
        },
      })
    }

    console.log(`[FullPipeline] Completed with status: ${overallStatus}`)

    return {
      success: overallStatus === WorkflowStatus.COMPLETED,
      startedAt,
      completedAt,
      collection: collectionResult,
      transform: transformResult,
      publish: publishResult,
      overallStatus,
    }
  } catch (error: any) {
    console.error('[FullPipeline] Error:', error)
    await failWorkflowLog(logId, error.message, {
      collection: collectionResult?.details,
      transform: transformResult?.details,
      publish: publishResult?.details,
    })

    return {
      success: false,
      startedAt,
      completedAt: new Date(),
      collection: collectionResult,
      transform: transformResult,
      publish: publishResult,
      overallStatus: WorkflowStatus.FAILED,
    }
  } finally {
    clearBatchContext()
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * cron 표현식에서 다음 실행 시간 계산
 */
function calculateNextRunTime(cronExpression: string): Date {
  // 간단한 구현 - 실제로는 cron 파서 라이브러리 사용 권장
  const now = new Date()
  const parts = cronExpression.split(' ')

  if (parts.length !== 5) {
    // 기본값: 1시간 후
    return new Date(now.getTime() + 60 * 60 * 1000)
  }

  const [minute, hour] = parts

  // 매 시간 실행 (0 * * * *)
  if (minute === '0' && hour === '*') {
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    next.setHours(next.getHours() + 1)
    return next
  }

  // N시간마다 (0 */N * * *)
  if (minute === '0' && hour.startsWith('*/')) {
    const interval = parseInt(hour.substring(2))
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    const currentHour = next.getHours()
    const nextHour = Math.ceil((currentHour + 1) / interval) * interval
    next.setHours(nextHour)
    return next
  }

  // 매일 특정 시간 (0 H * * *)
  if (minute === '0' && !isNaN(parseInt(hour))) {
    const targetHour = parseInt(hour)
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    next.setHours(targetHour)
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }
    return next
  }

  // 기본값: 1시간 후
  return new Date(now.getTime() + 60 * 60 * 1000)
}
