/**
 * Pipeline Executor
 * 전체 자동화 파이프라인 실행
 */

import prisma, { WorkflowType, WorkflowStatus, TriggerType } from '@bandauto/db'
import { setBatchContext, clearBatchContext, createBatchContextFromUserId, throwIfCancelled, CancellationError } from './context'
import { runCollectionPipeline } from './pipelines/collection'
import { runTransformPipeline } from './pipelines/transform'
import { runProductCreatePipeline } from './pipelines/product-create'
import { runPublishPipeline } from './pipelines/publish'
import {
  acquireExecutionLock,
  createWorkflowLog,
  completeWorkflowLog,
  failWorkflowLog,
  updateWorkflowProgress,
} from './workflow-service'
import {
  FullPipelineConfig,
  FullPipelineResult,
  CollectionResult,
  TransformResult,
  ProductCreateResult,
  PublishResult,
} from './types'
import { createPipelineNotification } from './notification-helper'

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * JSON 문자열 또는 number[] 값을 number[]로 파싱
 */
function parseNumberArray(value: string | number[] | null | undefined): number[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

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
      channelIds: config?.channelIds ?? parseNumberArray(automationConfig?.channelIds),
      limit: config?.limit ?? 10,  // 자동화 수동실행: 최근 10개만 수집
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
 * 상품 생성 파이프라인 실행 (with logging)
 * CollectedProduct에서 Product 생성
 */
export async function executeProductCreatePipeline(
  userId: number,
  config?: Partial<FullPipelineConfig['productCreate']>,
  triggerType: TriggerType = TriggerType.MANUAL
): Promise<ProductCreateResult> {
  const context = await createBatchContextFromUserId(userId)

  const logId = await createWorkflowLog({
    userId,
    workflowType: WorkflowType.TRANSFORM, // PRODUCT_CREATE 타입이 없으면 TRANSFORM 사용
    triggerType,
  })

  // context에 workflowLogId 설정
  context.workflowLogId = logId
  setBatchContext(context)

  try {
    const productCreateConfig = {
      channelIds: config?.channelIds,
      createPendingOnly: config?.createPendingOnly ?? true,
    }

    const result = await runProductCreatePipeline(productCreateConfig)

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

    // retailChannelIds 사용
    const channelIdsForPublish = config?.channelIds ?? parseNumberArray(automationConfig?.retailChannelIds)

    if (!channelIdsForPublish || channelIdsForPublish.length === 0) {
      throw new Error('발행할 채널이 설정되지 않았습니다')
    }

    const publishConfig = {
      channelIds: channelIdsForPublish,
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
 * 수집 → 변환 → 상품생성 → 발행 순서로 실행
 */
export async function executeFullPipeline(
  userId: number,
  options?: {
    skipCollection?: boolean
    skipTransform?: boolean
    skipProductCreate?: boolean
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
  let productCreateResult: ProductCreateResult | undefined
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

    // 누적 카운터
    let totalItems = 0
    let successCount = 0
    let failedCount = 0

    // 1. 수집 단계
    if (!options?.skipCollection) {
      console.log('[FullPipeline] Step 1: Collection')
      collectionResult = await runCollectionPipeline({
        channelIds: parseNumberArray(automationConfig.channelIds),
        limit: 10,  // 자동화 파이프라인: 최근 10개만 수집
      })

      // 진행 상황 및 details 업데이트 (단계별 누적 저장)
      totalItems += collectionResult.totalItems
      successCount += collectionResult.successCount
      failedCount += collectionResult.failedCount
      await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
        collection: collectionResult.details,
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

      // 진행 상황 및 details 업데이트 (단계별 누적 저장)
      totalItems += transformResult.totalItems
      successCount += transformResult.successCount
      failedCount += transformResult.failedCount
      await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
        collection: collectionResult?.details,
        transform: transformResult.details,
      })

      console.log(`[FullPipeline] Transform completed: ${transformResult.successCount} collected products created`)
    }

    // 3. 상품 생성 단계
    if (!options?.skipProductCreate) {
      console.log('[FullPipeline] Step 3: Product Create')
      productCreateResult = await runProductCreatePipeline({
        createPendingOnly: true,
      })

      // 진행 상황 및 details 업데이트 (단계별 누적 저장)
      totalItems += productCreateResult.totalItems
      successCount += productCreateResult.successCount
      failedCount += productCreateResult.failedCount
      await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
        collection: collectionResult?.details,
        transform: transformResult?.details,
        productCreate: productCreateResult.details,
      })

      console.log(`[FullPipeline] Product Create completed: ${productCreateResult.successCount} products created`)
    }

    // 4. 발행 단계
    if (!options?.skipPublish) {
      const channelIdsForPublish = parseNumberArray(automationConfig.retailChannelIds)
      if (channelIdsForPublish.length) {
        console.log('[FullPipeline] Step 4: Publish')

        // 방금 생성된 상품 IDs 추출 (있으면 해당 상품만 발행)
        const newlyCreatedProductIds = productCreateResult?.details?.createdProducts
          ?.filter(p => p.status === 'success' && p.productId)
          .map(p => p.productId!) || []

        publishResult = await runPublishPipeline({
          channelIds: channelIdsForPublish,
          productIds: newlyCreatedProductIds.length > 0 ? newlyCreatedProductIds : undefined,
          publishReadyOnly: true,
        })

        // 진행 상황 및 details 업데이트 (단계별 누적 저장)
        totalItems += publishResult.totalItems
        successCount += publishResult.successCount
        failedCount += publishResult.failedCount
        await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
          collection: collectionResult?.details,
          transform: transformResult?.details,
          productCreate: productCreateResult?.details,
          publish: publishResult.details,
        })

        console.log(`[FullPipeline] Publish completed: ${publishResult.successCount} published`)
      }
    }

    const completedAt = new Date()

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
      productCreate: productCreateResult?.details,
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

    // 파이프라인 완료 알림 생성
    const pipelineResult: FullPipelineResult = {
      success: overallStatus === WorkflowStatus.COMPLETED,
      startedAt,
      completedAt,
      collection: collectionResult,
      transform: transformResult,
      productCreate: productCreateResult,
      publish: publishResult,
      overallStatus,
    }

    await createPipelineNotification({
      result: pipelineResult,
      workflowLogId: logId,
    })

    return pipelineResult
  } catch (error: any) {
    // 취소 에러는 로깅만 하고 넘어감
    if (error instanceof CancellationError) {
      console.log(`[FullPipeline] Cancelled by user`)

      // 취소 시에도 알림 생성
      const cancelledResult: FullPipelineResult = {
        success: false,
        startedAt,
        completedAt: new Date(),
        collection: collectionResult,
        transform: transformResult,
        productCreate: productCreateResult,
        publish: publishResult,
        overallStatus: WorkflowStatus.FAILED,
      }

      await createPipelineNotification({
        result: cancelledResult,
        workflowLogId: logId,
        errorMessage: '사용자에 의해 작업이 취소되었습니다.',
      })

      return cancelledResult
    } else {
      console.error('[FullPipeline] Error:', error)
      await failWorkflowLog(logId, error.message, {
        collection: collectionResult?.details,
        transform: transformResult?.details,
        productCreate: productCreateResult?.details,
        publish: publishResult?.details,
      })

      // 에러 발생 시 알림 생성
      const errorResult: FullPipelineResult = {
        success: false,
        startedAt,
        completedAt: new Date(),
        collection: collectionResult,
        transform: transformResult,
        productCreate: productCreateResult,
        publish: publishResult,
        overallStatus: WorkflowStatus.FAILED,
      }

      await createPipelineNotification({
        result: errorResult,
        workflowLogId: logId,
        errorMessage: error.message,
      })

      return errorResult
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

// =============================================
// LOCK-BASED PIPELINE EXECUTION
// =============================================

/**
 * Lock 기반 전체 파이프라인 실행
 * 중복 실행을 원자적으로 방지하고 파이프라인 실행
 *
 * @returns 성공 시 FullPipelineResult, Lock 획득 실패 시 null
 */
export async function executeFullPipelineWithLock(
  userId: number,
  options?: {
    skipCollection?: boolean
    skipTransform?: boolean
    skipProductCreate?: boolean
    skipPublish?: boolean
  },
  triggerType: TriggerType = TriggerType.MANUAL
): Promise<FullPipelineResult | null> {
  // 1. Lock 획득 시도 (워크플로우 생성과 중복 체크를 원자적으로 수행)
  const logId = await acquireExecutionLock(userId, WorkflowType.FULL_PIPELINE, triggerType)

  if (!logId) {
    console.log(`[Executor] Lock 획득 실패 - 이미 실행 중인 작업이 있음 (user: ${userId})`)
    return null
  }

  const context = await createBatchContextFromUserId(userId)
  context.workflowLogId = logId
  setBatchContext(context)

  const startedAt = new Date()

  let collectionResult: CollectionResult | undefined
  let transformResult: TransformResult | undefined
  let productCreateResult: ProductCreateResult | undefined
  let publishResult: PublishResult | undefined

  try {
    console.log(`[FullPipeline] Starting for user ${userId} (workflow: ${logId})`)

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

    // 누적 카운터
    let totalItems = 0
    let successCount = 0
    let failedCount = 0

    // 1. 수집 단계
    if (!options?.skipCollection) {
      await throwIfCancelled() // 취소 체크
      console.log('[FullPipeline] Step 1: Collection')
      collectionResult = await runCollectionPipeline({
        channelIds: parseNumberArray(automationConfig.channelIds),
        limit: 10,  // 자동화 파이프라인: 최근 10개만 수집
      })

      // 진행 상황 및 details 업데이트 (단계별 누적 저장)
      totalItems += collectionResult.totalItems
      successCount += collectionResult.successCount
      failedCount += collectionResult.failedCount
      await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
        collection: collectionResult.details,
      })

      console.log(`[FullPipeline] Collection completed: ${collectionResult.successCount} new posts`)
    }

    // 2. 변환 단계
    if (!options?.skipTransform) {
      await throwIfCancelled() // 취소 체크
      console.log('[FullPipeline] Step 2: Transform')
      transformResult = await runTransformPipeline({
        aiProvider: automationConfig.aiProvider,
        pricingPolicyId: automationConfig.pricingPolicyId,
        pricingPolicyContent: automationConfig.pricingPolicy?.content,
        transformPendingOnly: true,
      })

      // 진행 상황 및 details 업데이트 (단계별 누적 저장)
      totalItems += transformResult.totalItems
      successCount += transformResult.successCount
      failedCount += transformResult.failedCount
      await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
        collection: collectionResult?.details,
        transform: transformResult.details,
      })

      console.log(`[FullPipeline] Transform completed: ${transformResult.successCount} collected products created`)
    }

    // 3. 상품 생성 단계
    if (!options?.skipProductCreate) {
      await throwIfCancelled() // 취소 체크
      console.log('[FullPipeline] Step 3: Product Create')
      productCreateResult = await runProductCreatePipeline({
        createPendingOnly: true,
      })

      // 진행 상황 및 details 업데이트 (단계별 누적 저장)
      totalItems += productCreateResult.totalItems
      successCount += productCreateResult.successCount
      failedCount += productCreateResult.failedCount
      await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
        collection: collectionResult?.details,
        transform: transformResult?.details,
        productCreate: productCreateResult.details,
      })

      console.log(`[FullPipeline] Product Create completed: ${productCreateResult.successCount} products created`)
    }

    // 4. 발행 단계
    if (!options?.skipPublish) {
      await throwIfCancelled() // 취소 체크
      const channelIdsForPublish = parseNumberArray(automationConfig.retailChannelIds)
      if (channelIdsForPublish.length) {
        console.log('[FullPipeline] Step 4: Publish')
        publishResult = await runPublishPipeline({
          channelIds: channelIdsForPublish,
          publishReadyOnly: true,
        })

        // 진행 상황 및 details 업데이트 (단계별 누적 저장)
        totalItems += publishResult.totalItems
        successCount += publishResult.successCount
        failedCount += publishResult.failedCount
        await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
          collection: collectionResult?.details,
          transform: transformResult?.details,
          productCreate: productCreateResult?.details,
          publish: publishResult.details,
        })

        console.log(`[FullPipeline] Publish completed: ${publishResult.successCount} published`)
      }
    }

    const completedAt = new Date()

    // 마지막으로 취소 체크 (완료 전)
    await throwIfCancelled()

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
      productCreate: productCreateResult?.details,
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

    console.log(`[FullPipeline] Completed with status: ${overallStatus} (workflow: ${logId})`)

    // 파이프라인 완료 알림 생성
    const pipelineResult: FullPipelineResult = {
      success: overallStatus === WorkflowStatus.COMPLETED,
      startedAt,
      completedAt,
      collection: collectionResult,
      transform: transformResult,
      productCreate: productCreateResult,
      publish: publishResult,
      overallStatus,
    }

    await createPipelineNotification({
      result: pipelineResult,
      workflowLogId: logId,
    })

    return pipelineResult
  } catch (error: any) {
    // 취소 에러는 별도 처리 (이미 DB에서 FAILED로 마킹됨)
    if (error instanceof CancellationError) {
      console.log(`[FullPipeline] Cancelled by user (workflow: ${logId})`)
      // 취소 시에도 현재까지의 details를 저장 (이미 FAILED 상태)
      await prisma.workflowLog.update({
        where: { id: logId },
        data: {
          details: JSON.stringify({
            collection: collectionResult?.details,
            transform: transformResult?.details,
            productCreate: productCreateResult?.details,
            publish: publishResult?.details,
            cancelledAt: new Date().toISOString(),
          }),
        },
      })

      // 취소 시에도 알림 생성
      const cancelledResult: FullPipelineResult = {
        success: false,
        startedAt,
        completedAt: new Date(),
        collection: collectionResult,
        transform: transformResult,
        productCreate: productCreateResult,
        publish: publishResult,
        overallStatus: WorkflowStatus.FAILED,
      }

      await createPipelineNotification({
        result: cancelledResult,
        workflowLogId: logId,
        errorMessage: '사용자에 의해 작업이 취소되었습니다.',
      })

      return cancelledResult
    }

    console.error('[FullPipeline] Error:', error)
    await failWorkflowLog(logId, error.message, {
      collection: collectionResult?.details,
      transform: transformResult?.details,
      productCreate: productCreateResult?.details,
      publish: publishResult?.details,
    })

    // 에러 발생 시 알림 생성
    const errorResult: FullPipelineResult = {
      success: false,
      startedAt,
      completedAt: new Date(),
      collection: collectionResult,
      transform: transformResult,
      productCreate: productCreateResult,
      publish: publishResult,
      overallStatus: WorkflowStatus.FAILED,
    }

    await createPipelineNotification({
      result: errorResult,
      workflowLogId: logId,
      errorMessage: error.message,
    })

    return errorResult
  } finally {
    clearBatchContext()
  }
}
