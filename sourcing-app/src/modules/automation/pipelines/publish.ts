/**
 * Publish Pipeline
 * 상품을 소매채널(소매밴드 등)에 발행
 *
 * 이 파이프라인은 PublishService를 사용하여 실제 발행을 수행합니다.
 * 워크플로우 진행 상황 추적 기능을 추가합니다.
 */

import prisma, { ChannelKind } from '@bandauto/db'
import { getBatchContext } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import { publishService } from '@/modules/publish'
import {
  PublishConfig,
  PublishResult,
  PublishedProductResult,
  ChannelPublishResult,
  PipelineError,
} from '../types'

// =============================================
// PUBLISH PIPELINE
// =============================================

/**
 * 발행 파이프라인 실행
 * PublishService를 사용하여 상품을 소매채널에 발행
 */
export async function runPublishPipeline(
  config: PublishConfig
): Promise<PublishResult> {
  const context = getBatchContext()
  if (!context) {
    throw new Error('Batch context is required')
  }

  const { userId, workflowLogId } = context
  const errors: PipelineError[] = []
  const publishedProducts: PublishedProductResult[] = []
  const channelResults: ChannelPublishResult[] = []

  console.log(`[Publish Pipeline] Starting for user ${userId}`)

  // 발행할 상품 조회
  const whereClause: any = {
    userId,
  }

  if (config.productIds?.length) {
    whereClause.id = { in: config.productIds }
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    select: { id: true },
  })

  if (products.length === 0) {
    console.log('[Publish Pipeline] No products to publish')
    return {
      success: true,
      totalItems: 0,
      successCount: 0,
      failedCount: 0,
      details: {
        publishedProducts: [],
        channelResults: [],
      },
      errors: [],
    }
  }

  const productIds = products.map((p) => p.id)
  console.log(`[Publish Pipeline] Found ${productIds.length} products to publish`)

  // 발행할 소매채널 조회
  const channelIds = config.channelIds
  if (!channelIds?.length) {
    throw new Error('발행할 채널이 지정되지 않았습니다')
  }

  const retailChannels = await prisma.channel.findMany({
    where: {
      userId,
      id: { in: channelIds },
      kind: ChannelKind.RETAIL,
      isActive: true,
    },
    select: { id: true, name: true },
  })

  if (retailChannels.length === 0) {
    throw new Error('No active retail channels found')
  }

  console.log(`[Publish Pipeline] Publishing to ${retailChannels.length} retail channels`)

  // 진행 상황 초기화
  const totalItems = productIds.length * retailChannels.length
  let currentSuccess = 0
  let currentFailed = 0

  if (workflowLogId) {
    await updateWorkflowProgress(workflowLogId, totalItems, 0, 0)
  }

  // PublishService를 사용하여 각 채널에 발행
  for (const channel of retailChannels) {
    const result = await publishService.publishBatch({
      userId,
      productIds,
      channelId: channel.id,
    })

    // 채널별 결과 변환
    const channelResult: ChannelPublishResult = {
      channelId: result.channelId,
      channelName: result.channelName,
      attempted: result.total,
      success: result.successCount,
      failed: result.failedCount,
      skipped: result.skippedCount,
      errors: result.errors,
    }
    channelResults.push(channelResult)

    // 개별 상품 결과 변환
    for (const productResult of result.results) {
      publishedProducts.push({
        productId: productResult.productId,
        channelId: productResult.channelId,
        postKey: productResult.postKey,
        status: productResult.success
          ? productResult.skipped
            ? 'SKIPPED'
            : 'SUCCESS'
          : 'FAILED',
        error: productResult.error,
      })

      // 에러 수집
      if (!productResult.success && productResult.error) {
        errors.push({
          itemId: `${productResult.productId}-${productResult.channelId}`,
          message: productResult.error,
          timestamp: new Date(),
        })
      }
    }

    // 진행 상황 업데이트
    currentSuccess += result.successCount
    currentFailed += result.failedCount

    if (workflowLogId) {
      await updateWorkflowProgress(workflowLogId, totalItems, currentSuccess, currentFailed)
    }
  }

  const totalSuccess = channelResults.reduce((sum, r) => sum + r.success, 0)
  const totalFailed = channelResults.reduce((sum, r) => sum + r.failed, 0)

  return {
    success: totalFailed === 0,
    totalItems: productIds.length * retailChannels.length,
    successCount: totalSuccess,
    failedCount: totalFailed,
    details: {
      publishedProducts,
      channelResults,
    },
    errors,
  }
}
