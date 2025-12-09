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
 * PublishService를 사용하여 상품을 소매채널 및 쇼핑몰에 발행
 */
export async function runPublishPipeline(
  config: PublishConfig
): Promise<PublishResult> {
  const context = getBatchContext()
  if (!context) {
    throw new Error('Batch context is required')
  }

  const { userId, workflowLogId, shopIds } = context
  const errors: PipelineError[] = []
  const publishedProducts: PublishedProductResult[] = []
  const channelResults: ChannelPublishResult[] = []

  console.log(`[Publish Pipeline] Starting for user ${userId}`)

  // 발행할 채널 IDs
  const channelIds = config.channelIds
  if (!channelIds?.length) {
    throw new Error('발행할 채널이 지정되지 않았습니다')
  }

  // 발행할 상품 조회
  const whereClause: any = {
    userId,
  }

  if (config.productIds?.length) {
    // 특정 상품 ID가 지정된 경우
    whereClause.id = { in: config.productIds }
  } else if (config.publishReadyOnly) {
    // publishReadyOnly가 true인 경우: 아직 발행되지 않은 상품만
    // 지정된 모든 채널에 발행되지 않은 상품 조회
    whereClause.AND = [
      {
        OR: channelIds.map(channelId => ({
          publishedProducts: {
            none: { channelId },
          },
        })),
      },
    ]
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      options: { select: { id: true } },
      variants: { select: { id: true, price: true } },
      publishedProducts: {
        where: { channelId: { in: channelIds } },
        select: { channelId: true },
      },
    },
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

  // 가격 정보가 있는지 확인하는 헬퍼 함수
  const hasValidPrice = (variants: { id: number; price: number | null }[]): boolean => {
    return variants.some(v => v.price !== null && v.price > 0)
  }

  // options, variants가 있고 가격 정보가 있는 상품만 필터링
  const validProducts = products.filter(
    (p) => p.options.length > 0 && p.variants.length > 0 && hasValidPrice(p.variants)
  )

  // 건너뛸 상품들 (options/variants 없거나 가격 없음)
  const skippedProducts = products.filter(
    (p) => p.options.length === 0 || p.variants.length === 0 || !hasValidPrice(p.variants)
  )

  if (skippedProducts.length > 0) {
    console.log(`[Publish Pipeline] Skipping ${skippedProducts.length} products without options/variants/price`)
    for (const p of skippedProducts) {
      let reason: string
      if (p.options.length === 0 && p.variants.length === 0) {
        reason = 'options와 variants가 없음'
      } else if (p.options.length === 0) {
        reason = 'options가 없음'
      } else if (p.variants.length === 0) {
        reason = 'variants가 없음'
      } else if (!hasValidPrice(p.variants)) {
        reason = '가격 정보가 없음'
      } else {
        reason = '알 수 없는 이유'
      }
      console.log(`[Publish Pipeline] Skipped product ${p.id} (${p.name}): ${reason}`)
      errors.push({
        itemId: p.id,
        message: `발행 건너뜀: ${reason}`,
        timestamp: new Date(),
      })
    }
  }

  if (validProducts.length === 0) {
    console.log('[Publish Pipeline] No valid products to publish (all missing options/variants/price)')
    return {
      success: true,
      totalItems: products.length,
      successCount: 0,
      failedCount: 0,
      details: {
        publishedProducts: [],
        channelResults: [],
        skippedProducts: skippedProducts.map((p) => {
          let reason: string
          if (p.options.length === 0 && p.variants.length === 0) {
            reason = 'options와 variants가 없음'
          } else if (p.options.length === 0) {
            reason = 'options가 없음'
          } else if (p.variants.length === 0) {
            reason = 'variants가 없음'
          } else if (!hasValidPrice(p.variants)) {
            reason = '가격 정보가 없음'
          } else {
            reason = '알 수 없는 이유'
          }
          return { productId: p.id, reason }
        }),
      },
      errors,
    }
  }

  const productIds = validProducts.map((p) => p.id)
  console.log(`[Publish Pipeline] Found ${productIds.length} valid products to publish (${skippedProducts.length} skipped)`)

  // 발행할 소매채널 조회
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

  // 이미 발행된 상품 정보 매핑 (productId -> 발행된 channelIds)
  const publishedChannelsMap = new Map<number, Set<number>>()
  for (const product of validProducts) {
    const publishedChannelIds: number[] = (product as any).publishedProducts?.map((pp: any) => pp.channelId) || []
    publishedChannelsMap.set(product.id, new Set<number>(publishedChannelIds))
  }

  // 진행 상황 초기화
  let totalItems = productIds.length * retailChannels.length
  let currentSuccess = 0
  let currentFailed = 0

  if (workflowLogId) {
    await updateWorkflowProgress(workflowLogId, totalItems, 0, 0)
  }

  // PublishService를 사용하여 각 채널에 병렬 발행
  // 각 채널은 독립적인 API를 사용하므로 동시에 발행 가능
  const channelPublishTasks = retailChannels.map(async (channel) => {
    // 해당 채널에 아직 발행되지 않은 상품만 필터링
    const unpublishedProductIds = productIds.filter(productId => {
      const publishedChannels = publishedChannelsMap.get(productId)
      return !publishedChannels || !publishedChannels.has(channel.id)
    })

    if (unpublishedProductIds.length === 0) {
      console.log(`[Publish Pipeline] All products already published to channel ${channel.id} (${channel.name})`)
      return {
        channelResult: {
          channelId: channel.id,
          channelName: channel.name,
          attempted: 0,
          success: 0,
          failed: 0,
          skipped: productIds.length,
          errors: [],
        } as ChannelPublishResult,
        productResults: [] as PublishedProductResult[],
        errors: [] as PipelineError[],
      }
    }

    console.log(`[Publish Pipeline] Publishing ${unpublishedProductIds.length} products to channel ${channel.id} (${channel.name})`)

    const result = await publishService.publishBatch({
      userId,
      productIds: unpublishedProductIds,
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

    // 개별 상품 결과 변환
    const productResults: PublishedProductResult[] = []
    const channelErrors: PipelineError[] = []

    for (const productResult of result.results) {
      productResults.push({
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
        channelErrors.push({
          itemId: `${productResult.productId}-${productResult.channelId}`,
          message: productResult.error,
          timestamp: new Date(),
        })
      }
    }

    return { channelResult, productResults, errors: channelErrors }
  })

  // 모든 채널 발행 병렬 실행
  const channelPublishResults = await Promise.all(channelPublishTasks)

  // 결과 집계
  for (const { channelResult, productResults, errors: channelErrors } of channelPublishResults) {
    channelResults.push(channelResult)
    publishedProducts.push(...productResults)
    errors.push(...channelErrors)
    currentSuccess += channelResult.success
    currentFailed += channelResult.failed
  }

  // 진행 상황 업데이트
  if (workflowLogId) {
    await updateWorkflowProgress(workflowLogId, totalItems, currentSuccess, currentFailed, {
      publish: {
        channelResults,
        publishedProducts: publishedProducts.slice(-10), // 최근 10개만
        errors: errors.slice(-5),
      },
    })
  }

  let totalSuccess = channelResults.reduce((sum, r) => sum + r.success, 0)
  let totalFailed = channelResults.reduce((sum, r) => sum + r.failed, 0)

  // 쇼핑몰에도 발행 (shopIds가 설정된 경우)
  if (shopIds && shopIds.length > 0) {
    console.log(`[Publish Pipeline] Also publishing to ${shopIds.length} shop(s): ${shopIds.join(', ')}`)

    for (const shopId of shopIds) {
      const shopResult = await publishService.publishShopBatch({
        userId,
        productIds,
        shopId,
      })

      // Shop 결과를 channelResults에 추가 (shopId를 음수로 구분)
      const shopChannelResult: ChannelPublishResult = {
        channelId: -shopId, // 음수로 표시하여 Shop임을 구분
        channelName: `Shop: ${shopResult.shopName}`,
        attempted: shopResult.total,
        success: shopResult.successCount,
        failed: shopResult.failedCount,
        skipped: shopResult.skippedCount,
        errors: shopResult.errors,
      }
      channelResults.push(shopChannelResult)

      // 개별 상품 결과 추가
      for (const productResult of shopResult.results) {
        publishedProducts.push({
          productId: productResult.productId,
          channelId: -shopId,
          status: productResult.success
            ? productResult.skipped
              ? 'SKIPPED'
              : 'SUCCESS'
            : 'FAILED',
          error: productResult.error,
        })

        if (!productResult.success && productResult.error) {
          errors.push({
            itemId: `${productResult.productId}-shop-${shopId}`,
            message: productResult.error,
            timestamp: new Date(),
          })
        }
      }

      totalSuccess += shopResult.successCount
      totalFailed += shopResult.failedCount
      totalItems += productIds.length

      if (workflowLogId) {
        await updateWorkflowProgress(workflowLogId, totalItems, totalSuccess, totalFailed, {
          publish: {
            channelResults,
            publishedProducts: publishedProducts.slice(-10),
            errors: errors.slice(-5),
          },
        })
      }
    }
  }

  return {
    success: totalFailed === 0,
    totalItems,
    successCount: totalSuccess,
    failedCount: totalFailed,
    details: {
      publishedProducts,
      channelResults,
    },
    errors,
  }
}
