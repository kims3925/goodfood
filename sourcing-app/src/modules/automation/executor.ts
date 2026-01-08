/**
 * Pipeline Executor
 * 전체 자동화 파이프라인 실행
 */

import prisma, { WorkflowType, WorkflowStatus, TriggerType, StepType } from '@bandauto/db'
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
  startWorkflowStep,
  updateStepProgress,
  completeWorkflowStep,
  clearCurrentStep,
  failRunningSteps,
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
// LOGGER
// =============================================

const LOG_PREFIX = '[Pipeline]'

interface LogContext {
  userId?: number
  workflowId?: number
  stage?: string
}

function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, context?: LogContext) {
  const timestamp = formatTimestamp()
  const contextStr = context
    ? ` [user:${context.userId || '-'}][wf:${context.workflowId || '-'}]${context.stage ? `[${context.stage}]` : ''}`
    : ''

  const prefix = `${timestamp} ${LOG_PREFIX}${contextStr}`

  switch (level) {
    case 'ERROR':
      console.error(`${prefix} ❌ ${message}`)
      break
    case 'WARN':
      console.warn(`${prefix} ⚠️ ${message}`)
      break
    case 'DEBUG':
      console.log(`${prefix} 🔍 ${message}`)
      break
    default:
      console.log(`${prefix} ✅ ${message}`)
  }
}

function logStageStart(stage: string, context: LogContext) {
  log('INFO', `━━━ ${stage} 단계 시작 ━━━`, context)
}

function logStageComplete(stage: string, result: { successCount: number; failedCount: number; totalItems: number }, context: LogContext) {
  const status = result.failedCount === 0 ? '성공' : result.successCount > 0 ? '부분 성공' : '실패'
  log('INFO', `━━━ ${stage} 단계 완료 (${status}) - 성공: ${result.successCount}, 실패: ${result.failedCount}, 총: ${result.totalItems}건 ━━━`, context)
}

function logStageError(stage: string, error: Error, context: LogContext) {
  log('ERROR', `${stage} 단계 실패: ${error.message}`, context)
  if (error.stack) {
    log('DEBUG', `Stack trace: ${error.stack.split('\n').slice(0, 3).join(' -> ')}`, context)
  }
}

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
      { collection: result.details }  // 로그 페이지와 일관된 구조로 저장
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
    })

    const transformConfig = {
      aiProvider: config?.aiProvider ?? automationConfig?.aiProvider ?? 'GEMINI',
      pricingPolicyContent: config?.pricingPolicyContent,
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
      { transform: result.details }  // 로그 페이지와 일관된 구조로 저장
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
      { productCreate: result.details }  // 로그 페이지와 일관된 구조로 저장
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
      { publish: result.details }  // 로그 페이지와 일관된 구조로 저장
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

  const logCtx: LogContext = { userId, workflowId: logId }

  try {
    log('INFO', `═══════════════════════════════════════════════════════════`, logCtx)
    log('INFO', `전체 파이프라인 시작 (trigger: ${triggerType})`, logCtx)
    log('INFO', `═══════════════════════════════════════════════════════════`, logCtx)

    // 자동화 설정 조회
    const automationConfig = await prisma.automationConfig.findUnique({
      where: { userId },
    })

    if (!automationConfig) {
      log('ERROR', '자동화 설정이 없습니다. 설정 페이지에서 자동화를 먼저 설정해주세요.', logCtx)
      throw new Error('자동화 설정이 없습니다')
    }

    // 설정 정보 로그
    const channelIds = parseNumberArray(automationConfig.channelIds)
    const retailChannelIds = parseNumberArray(automationConfig.retailChannelIds)
    log('DEBUG', `설정 - 수집채널: ${channelIds.length}개, 발행채널: ${retailChannelIds.length}개, AI: ${automationConfig.aiProvider}`, logCtx)

    // 누적 카운터
    let totalItems = 0
    let successCount = 0
    let failedCount = 0

    // 1. 수집 단계
    if (!options?.skipCollection) {
      logStageStart('수집(Collection)', { ...logCtx, stage: 'COLLECT' })

      if (channelIds.length === 0) {
        log('WARN', '수집할 채널이 설정되지 않았습니다. 이 단계를 건너뜁니다.', { ...logCtx, stage: 'COLLECT' })
      } else {
        log('DEBUG', `수집 대상 채널: ${channelIds.join(', ')}`, { ...logCtx, stage: 'COLLECT' })

        collectionResult = await runCollectionPipeline({
          channelIds,
          limit: 10,
        })

        totalItems += collectionResult.totalItems
        successCount += collectionResult.successCount
        failedCount += collectionResult.failedCount
        await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
          collection: collectionResult.details,
        })

        logStageComplete('수집(Collection)', collectionResult, { ...logCtx, stage: 'COLLECT' })

        if (collectionResult.details?.channelResults) {
          for (const ch of collectionResult.details.channelResults) {
            log('DEBUG', `  - ${ch.channelName}: 신규 ${ch.newPosts || 0}건${ch.failed ? `, 실패 ${ch.failed}건` : ''}`, { ...logCtx, stage: 'COLLECT' })
          }
        }
      }
    } else {
      log('INFO', '수집 단계 건너뜀 (skipCollection=true)', logCtx)
    }

    // 2. 변환 단계
    if (!options?.skipTransform) {
      logStageStart('AI변환(Transform)', { ...logCtx, stage: 'TRANSFORM' })
      log('DEBUG', `AI 제공자: ${automationConfig.aiProvider}`, { ...logCtx, stage: 'TRANSFORM' })

      transformResult = await runTransformPipeline({
        aiProvider: automationConfig.aiProvider,
        transformPendingOnly: true,
      })

      totalItems += transformResult.totalItems
      successCount += transformResult.successCount
      failedCount += transformResult.failedCount
      await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
        collection: collectionResult?.details,
        transform: transformResult.details,
      })

      logStageComplete('AI변환(Transform)', transformResult, { ...logCtx, stage: 'TRANSFORM' })
    } else {
      log('INFO', 'AI변환 단계 건너뜀 (skipTransform=true)', logCtx)
    }

    // 3. 상품 생성 단계
    if (!options?.skipProductCreate) {
      logStageStart('상품생성(ProductCreate)', { ...logCtx, stage: 'PRODUCT' })

      productCreateResult = await runProductCreatePipeline({
        createPendingOnly: true,
      })

      totalItems += productCreateResult.totalItems
      successCount += productCreateResult.successCount
      failedCount += productCreateResult.failedCount
      await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
        collection: collectionResult?.details,
        transform: transformResult?.details,
        productCreate: productCreateResult.details,
      })

      logStageComplete('상품생성(ProductCreate)', productCreateResult, { ...logCtx, stage: 'PRODUCT' })

      if (productCreateResult.failedCount > 0 && productCreateResult.details?.createdProducts) {
        const failedProducts = productCreateResult.details.createdProducts.filter((p: any) => p.status !== 'success')
        if (failedProducts.length > 0) {
          log('WARN', `상품 생성 실패 항목:`, { ...logCtx, stage: 'PRODUCT' })
          for (const p of failedProducts.slice(0, 3)) {
            log('WARN', `  - ${p.productName || 'Unknown'}: ${p.error || '알 수 없는 오류'}`, { ...logCtx, stage: 'PRODUCT' })
          }
        }
      }
    } else {
      log('INFO', '상품생성 단계 건너뜀 (skipProductCreate=true)', logCtx)
    }

    // 4. 발행 단계
    if (!options?.skipPublish) {
      if (retailChannelIds.length === 0) {
        log('WARN', '발행할 채널이 설정되지 않았습니다. 발행 단계를 건너뜁니다.', logCtx)
      } else {
        logStageStart('발행(Publish)', { ...logCtx, stage: 'PUBLISH' })
        log('DEBUG', `발행 대상 채널: ${retailChannelIds.join(', ')}`, { ...logCtx, stage: 'PUBLISH' })

        const newlyCreatedProductIds = productCreateResult?.details?.createdProducts
          ?.filter((p: any) => p.status === 'success' && p.productId)
          .map((p: any) => p.productId!) || []

        if (newlyCreatedProductIds.length > 0) {
          log('DEBUG', `이번에 생성된 상품 ${newlyCreatedProductIds.length}개 발행 대상`, { ...logCtx, stage: 'PUBLISH' })
        }

        publishResult = await runPublishPipeline({
          channelIds: retailChannelIds,
          productIds: newlyCreatedProductIds.length > 0 ? newlyCreatedProductIds : undefined,
          publishReadyOnly: true,
        })

        totalItems += publishResult.totalItems
        successCount += publishResult.successCount
        failedCount += publishResult.failedCount
        await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
          collection: collectionResult?.details,
          transform: transformResult?.details,
          productCreate: productCreateResult?.details,
          publish: publishResult.details,
        })

        logStageComplete('발행(Publish)', publishResult, { ...logCtx, stage: 'PUBLISH' })

      }
    } else {
      log('INFO', '발행 단계 건너뜀 (skipPublish=true)', logCtx)
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

    log('INFO', `═══════════════════════════════════════════════════════════`, logCtx)
    log('INFO', `전체 파이프라인 완료 - 상태: ${overallStatus}`, logCtx)
    log('INFO', `최종 결과: 총 ${totalItems}건 처리 (성공: ${successCount}, 실패: ${failedCount})`, logCtx)
    log('INFO', `소요 시간: ${((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)}초`, logCtx)
    log('INFO', `═══════════════════════════════════════════════════════════`, logCtx)

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
      userId,
      result: pipelineResult,
      workflowLogId: logId,
    })

    return pipelineResult
  } catch (error: any) {
    const completedAt = new Date()
    const duration = ((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)

    // 취소 에러는 별도 처리
    if (error instanceof CancellationError) {
      log('WARN', `═══════════════════════════════════════════════════════════`, logCtx)
      log('WARN', `파이프라인 취소됨 (사용자 요청)`, logCtx)
      log('WARN', `소요 시간: ${duration}초`, logCtx)
      log('WARN', `═══════════════════════════════════════════════════════════`, logCtx)

      const cancelledResult: FullPipelineResult = {
        success: false,
        startedAt,
        completedAt,
        collection: collectionResult,
        transform: transformResult,
        productCreate: productCreateResult,
        publish: publishResult,
        overallStatus: WorkflowStatus.FAILED,
      }

      await createPipelineNotification({
        userId,
        result: cancelledResult,
        workflowLogId: logId,
        errorMessage: '사용자에 의해 작업이 취소되었습니다.',
      })

      return cancelledResult
    } else {
      // 일반 에러 처리
      log('ERROR', `═══════════════════════════════════════════════════════════`, logCtx)
      log('ERROR', `파이프라인 실패`, logCtx)
      log('ERROR', `에러 메시지: ${error.message}`, logCtx)
      log('ERROR', `소요 시간: ${duration}초`, logCtx)
      log('ERROR', `═══════════════════════════════════════════════════════════`, logCtx)

      // 에러 유형별 추가 안내
      if (error.message?.includes('API') || error.message?.includes('fetch')) {
        log('ERROR', `→ AI API 연결 문제일 수 있습니다. API 키와 네트워크 상태를 확인해주세요.`, logCtx)
      } else if (error.message?.includes('timeout') || error.message?.includes('시간 초과')) {
        log('ERROR', `→ 요청 시간이 초과되었습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요.`, logCtx)
      } else if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
        log('ERROR', `→ API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.`, logCtx)
      } else if (error.message?.includes('설정')) {
        log('ERROR', `→ 자동화 설정을 확인해주세요.`, logCtx)
      }

      if (error.stack) {
        log('DEBUG', `Stack: ${error.stack.split('\n').slice(0, 5).join(' | ')}`, logCtx)
      }

      await failWorkflowLog(logId, error.message, {
        collection: collectionResult?.details,
        transform: transformResult?.details,
        productCreate: productCreateResult?.details,
        publish: publishResult?.details,
      })

      const errorResult: FullPipelineResult = {
        success: false,
        startedAt,
        completedAt,
        collection: collectionResult,
        transform: transformResult,
        productCreate: productCreateResult,
        publish: publishResult,
        overallStatus: WorkflowStatus.FAILED,
      }

      await createPipelineNotification({
        userId,
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
    log('WARN', `Lock 획득 실패 - 이미 실행 중인 작업이 있습니다`, { userId })
    return null
  }

  const context = await createBatchContextFromUserId(userId)
  context.workflowLogId = logId
  setBatchContext(context)

  const startedAt = new Date()
  const logCtx: LogContext = { userId, workflowId: logId }

  let collectionResult: CollectionResult | undefined
  let transformResult: TransformResult | undefined
  let productCreateResult: ProductCreateResult | undefined
  let publishResult: PublishResult | undefined

  try {
    log('INFO', `═══════════════════════════════════════════════════════════`, logCtx)
    log('INFO', `전체 파이프라인 시작 (trigger: ${triggerType}, Lock 획득 완료)`, logCtx)
    log('INFO', `═══════════════════════════════════════════════════════════`, logCtx)

    // 자동화 설정 조회
    const automationConfig = await prisma.automationConfig.findUnique({
      where: { userId },
    })

    if (!automationConfig) {
      log('ERROR', '자동화 설정이 없습니다. 설정 페이지에서 자동화를 먼저 설정해주세요.', logCtx)
      throw new Error('자동화 설정이 없습니다')
    }

    // 설정 정보 로그
    const channelIds = parseNumberArray(automationConfig.channelIds)
    const retailChannelIds = parseNumberArray(automationConfig.retailChannelIds)
    log('DEBUG', `설정 - 수집채널: ${channelIds.length}개, 발행채널: ${retailChannelIds.length}개, AI: ${automationConfig.aiProvider}`, logCtx)

    // 누적 카운터
    let totalItems = 0
    let successCount = 0
    let failedCount = 0

    // 1. 수집 단계
    if (!options?.skipCollection) {
      await throwIfCancelled()
      logStageStart('수집(Collection)', { ...logCtx, stage: 'COLLECT' })
      await startWorkflowStep(logId, StepType.COLLECTION, channelIds.length)

      if (channelIds.length === 0) {
        log('WARN', '수집할 채널이 설정되지 않았습니다.', { ...logCtx, stage: 'COLLECT' })
        await completeWorkflowStep(logId, StepType.COLLECTION, {
          status: 'SKIPPED',
          successCount: 0,
          failedCount: 0,
        })
      } else {
        collectionResult = await runCollectionPipeline({
          channelIds,
          limit: 10,
        })

        totalItems += collectionResult.totalItems
        successCount += collectionResult.successCount
        failedCount += collectionResult.failedCount
        await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
          collection: collectionResult.details,
        })

        await completeWorkflowStep(logId, StepType.COLLECTION, {
          status: collectionResult.failedCount === 0 ? 'COMPLETED' : collectionResult.successCount > 0 ? 'COMPLETED' : 'FAILED',
          successCount: collectionResult.successCount,
          failedCount: collectionResult.failedCount,
          processedItems: collectionResult.totalItems,
          details: collectionResult.details,
        })

        logStageComplete('수집(Collection)', collectionResult, { ...logCtx, stage: 'COLLECT' })
      }
    } else {
      log('INFO', '수집 단계 건너뜀', logCtx)
    }

    // 2. 변환 단계
    if (!options?.skipTransform) {
      await throwIfCancelled()
      logStageStart('AI변환(Transform)', { ...logCtx, stage: 'TRANSFORM' })
      await startWorkflowStep(logId, StepType.TRANSFORM)

      transformResult = await runTransformPipeline({
        aiProvider: automationConfig.aiProvider,
        transformPendingOnly: true,
      })

      totalItems += transformResult.totalItems
      successCount += transformResult.successCount
      failedCount += transformResult.failedCount
      await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
        collection: collectionResult?.details,
        transform: transformResult.details,
      })

      await completeWorkflowStep(logId, StepType.TRANSFORM, {
        status: transformResult.failedCount === 0 ? 'COMPLETED' : transformResult.successCount > 0 ? 'COMPLETED' : 'FAILED',
        successCount: transformResult.successCount,
        failedCount: transformResult.failedCount,
        processedItems: transformResult.totalItems,
        details: transformResult.details,
      })

      logStageComplete('AI변환(Transform)', transformResult, { ...logCtx, stage: 'TRANSFORM' })
    } else {
      log('INFO', 'AI변환 단계 건너뜀', logCtx)
    }

    // 3. 상품 생성 단계
    if (!options?.skipProductCreate) {
      await throwIfCancelled()
      logStageStart('상품생성(ProductCreate)', { ...logCtx, stage: 'PRODUCT' })
      await startWorkflowStep(logId, StepType.PRODUCT_CREATE)

      productCreateResult = await runProductCreatePipeline({
        createPendingOnly: true,
      })

      totalItems += productCreateResult.totalItems
      successCount += productCreateResult.successCount
      failedCount += productCreateResult.failedCount
      await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
        collection: collectionResult?.details,
        transform: transformResult?.details,
        productCreate: productCreateResult.details,
      })

      await completeWorkflowStep(logId, StepType.PRODUCT_CREATE, {
        status: productCreateResult.failedCount === 0 ? 'COMPLETED' : productCreateResult.successCount > 0 ? 'COMPLETED' : 'FAILED',
        successCount: productCreateResult.successCount,
        failedCount: productCreateResult.failedCount,
        processedItems: productCreateResult.totalItems,
        details: productCreateResult.details,
      })

      logStageComplete('상품생성(ProductCreate)', productCreateResult, { ...logCtx, stage: 'PRODUCT' })
    } else {
      log('INFO', '상품생성 단계 건너뜀', logCtx)
    }

    // 4. 발행 단계
    if (!options?.skipPublish) {
      await throwIfCancelled()
      await startWorkflowStep(logId, StepType.PUBLISH, retailChannelIds.length)

      if (retailChannelIds.length === 0) {
        log('WARN', '발행할 채널이 설정되지 않았습니다.', logCtx)
        await completeWorkflowStep(logId, StepType.PUBLISH, {
          status: 'SKIPPED',
          successCount: 0,
          failedCount: 0,
        })
      } else {
        logStageStart('발행(Publish)', { ...logCtx, stage: 'PUBLISH' })

        publishResult = await runPublishPipeline({
          channelIds: retailChannelIds,
          publishReadyOnly: true,
        })

        totalItems += publishResult.totalItems
        successCount += publishResult.successCount
        failedCount += publishResult.failedCount
        await updateWorkflowProgress(logId, totalItems, successCount, failedCount, {
          collection: collectionResult?.details,
          transform: transformResult?.details,
          productCreate: productCreateResult?.details,
          publish: publishResult.details,
        })

        await completeWorkflowStep(logId, StepType.PUBLISH, {
          status: publishResult.failedCount === 0 ? 'COMPLETED' : publishResult.successCount > 0 ? 'COMPLETED' : 'FAILED',
          successCount: publishResult.successCount,
          failedCount: publishResult.failedCount,
          processedItems: publishResult.totalItems,
          details: publishResult.details,
        })

        logStageComplete('발행(Publish)', publishResult, { ...logCtx, stage: 'PUBLISH' })
      }
    } else {
      log('INFO', '발행 단계 건너뜀', logCtx)
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

    // 현재 단계 초기화
    await clearCurrentStep(logId)

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

    log('INFO', `═══════════════════════════════════════════════════════════`, logCtx)
    log('INFO', `전체 파이프라인 완료 - 상태: ${overallStatus}`, logCtx)
    log('INFO', `최종 결과: 총 ${totalItems}건 처리 (성공: ${successCount}, 실패: ${failedCount})`, logCtx)
    log('INFO', `소요 시간: ${((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)}초`, logCtx)
    log('INFO', `═══════════════════════════════════════════════════════════`, logCtx)

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
      userId,
      result: pipelineResult,
      workflowLogId: logId,
    })

    return pipelineResult
  } catch (error: any) {
    const completedAt = new Date()
    const duration = ((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)

    // 취소 에러는 별도 처리 (이미 DB에서 FAILED로 마킹됨)
    if (error instanceof CancellationError) {
      log('WARN', `═══════════════════════════════════════════════════════════`, logCtx)
      log('WARN', `파이프라인 취소됨 (사용자 요청)`, logCtx)
      log('WARN', `소요 시간: ${duration}초`, logCtx)
      log('WARN', `═══════════════════════════════════════════════════════════`, logCtx)

      // RUNNING 상태인 step들을 FAILED로 변경
      await failRunningSteps(logId, '사용자에 의해 작업이 취소되었습니다.')

      await prisma.workflowLog.update({
        where: { id: logId },
        data: {
          details: JSON.stringify({
            collection: collectionResult?.details,
            transform: transformResult?.details,
            productCreate: productCreateResult?.details,
            publish: publishResult?.details,
            cancelledAt: completedAt.toISOString(),
          }),
        },
      })

      const cancelledResult: FullPipelineResult = {
        success: false,
        startedAt,
        completedAt,
        collection: collectionResult,
        transform: transformResult,
        productCreate: productCreateResult,
        publish: publishResult,
        overallStatus: WorkflowStatus.FAILED,
      }

      await createPipelineNotification({
        userId,
        result: cancelledResult,
        workflowLogId: logId,
        errorMessage: '사용자에 의해 작업이 취소되었습니다.',
      })

      return cancelledResult
    }

    // 일반 에러 처리
    log('ERROR', `═══════════════════════════════════════════════════════════`, logCtx)
    log('ERROR', `파이프라인 실패`, logCtx)
    log('ERROR', `에러 메시지: ${error.message}`, logCtx)
    log('ERROR', `소요 시간: ${duration}초`, logCtx)
    log('ERROR', `═══════════════════════════════════════════════════════════`, logCtx)

    // 에러 유형별 추가 안내
    if (error.message?.includes('API') || error.message?.includes('fetch')) {
      log('ERROR', `→ AI API 연결 문제일 수 있습니다. API 키와 네트워크 상태를 확인해주세요.`, logCtx)
    } else if (error.message?.includes('timeout') || error.message?.includes('시간 초과')) {
      log('ERROR', `→ 요청 시간이 초과되었습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요.`, logCtx)
    } else if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
      log('ERROR', `→ API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.`, logCtx)
    }

    if (error.stack) {
      log('DEBUG', `Stack: ${error.stack.split('\n').slice(0, 5).join(' | ')}`, logCtx)
    }

    // RUNNING 상태인 step들을 FAILED로 변경
    await failRunningSteps(logId, error.message)

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
      userId,
      result: errorResult,
      workflowLogId: logId,
      errorMessage: error.message,
    })

    return errorResult
  } finally {
    clearBatchContext()
  }
}
