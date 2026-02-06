/**
 * Publish Pipeline
 * 상품을 소매채널(소매밴드 등)에 발행
 *
 * 이 파이프라인은 PublishService를 사용하여 실제 발행을 수행합니다.
 * 워크플로우 진행 상황 추적 기능을 추가합니다.
 */

import prisma, { ChannelKind } from '@bandauto/db'
import { getBatchContext, checkCancellation, CancellationError } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import { publishService } from '@/modules/publish'
import {
  PublishConfig,
  PublishResult,
  PublishedProductResult,
  ChannelPublishResult,
  PipelineError,
} from '../types'
import { isSessionExpiredError } from '../session-utils'
import { uploadProgressEmitter, UploadProgressInfo } from '@/modules/band-playwright/upload-progress-emitter'

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

  // 업로드 진행 상황 추적을 위한 상태
  let currentUploadProgress: UploadProgressInfo | null = null

  // 업로드 진행 이벤트 리스너 등록 (workflowLogId가 있을 때만)
  const uploadProgressHandler = workflowLogId
    ? (progress: UploadProgressInfo) => {
        currentUploadProgress = progress
      }
    : null

  if (uploadProgressHandler) {
    uploadProgressEmitter.on('uploadProgress', uploadProgressHandler)
  }

  // cleanup 함수
  const cleanup = () => {
    if (uploadProgressHandler) {
      uploadProgressEmitter.off('uploadProgress', uploadProgressHandler)
    }
  }

  console.log(`[Publish Pipeline] Starting for user ${userId}`)

  // 발행할 채널 IDs
  const channelIds = config.channelIds
  if (!channelIds?.length) {
    throw new Error('발행할 채널이 지정되지 않았습니다')
  }

  // 발행할 상품 조회
  const whereClause: any = {
    userId,
    deletedAt: null, // Soft Delete 필터링
    isActive: true,  // 활성 상품만
  }

  // 날짜 필터 적용
  if (config.todayOnly) {
    // 오늘 생성된 상품만 (자동화 파이프라인용)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    whereClause.createdAt = { gte: today }
  } else if (config.createdAfter) {
    // 특정 날짜 이후 생성된 상품
    whereClause.createdAt = { gte: config.createdAfter }
  } else if (config.daysWithin) {
    // 최근 N일 이내 생성된 상품
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - config.daysWithin)
    cutoffDate.setHours(0, 0, 0, 0)
    whereClause.createdAt = { gte: cutoffDate }
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
          channelProducts: {
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
      channelProducts: {
        where: { channelId: { in: channelIds } },
        select: { channelId: true },
      },
    },
  })

  if (products.length === 0) {
    console.log('[Publish Pipeline] No products to publish')
    cleanup()
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
    cleanup()
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
    cleanup()
    throw new Error('No active retail channels found')
  }

  console.log(`[Publish Pipeline] Publishing to ${retailChannels.length} retail channels`)

  // 이미 발행된 상품 정보 매핑 (productId -> 발행된 channelIds)
  const publishedChannelsMap = new Map<number, Set<number>>()
  for (const product of validProducts) {
    const publishedChannelIds: number[] = (product as any).channelProducts?.map((cp: any) => cp.channelId) || []
    publishedChannelsMap.set(product.id, new Set<number>(publishedChannelIds))
  }

  // 이미 Shop에 발행된 상품 정보 조회 (productId -> 발행된 shopIds)
  const publishedShopsMap = new Map<number, Set<number>>()
  if (shopIds && shopIds.length > 0) {
    const existingShopProducts = await prisma.shopProduct.findMany({
      where: {
        userId,
        productId: { in: productIds },
        shopId: { in: shopIds },
      },
      select: {
        productId: true,
        shopId: true,
      },
    })
    for (const sp of existingShopProducts) {
      // null 체크 - productId와 shopId가 모두 있어야 함
      if (sp.productId == null || sp.shopId == null) continue
      if (!publishedShopsMap.has(sp.productId)) {
        publishedShopsMap.set(sp.productId, new Set<number>())
      }
      publishedShopsMap.get(sp.productId)!.add(sp.shopId)
    }
  }

  // 진행 상황 추적 (초기화 제거 - executor.ts에서 누적 관리)
  // totalItems는 실제 발행 대상(미발행 상품)만 누적
  let totalItems = 0
  let currentSuccess = 0
  let currentFailed = 0

  // =============================================
  // 1. 쇼핑몰(Shop) 발행 먼저 수행
  // =============================================
  if (shopIds && shopIds.length > 0) {
    console.log(`[Publish Pipeline] Publishing to ${shopIds.length} shop(s) first: ${shopIds.join(', ')}`)

    for (const shopId of shopIds) {
      // 취소 체크: 각 Shop 발행 전에 확인
      if (await checkCancellation()) {
        console.log(`[Publish Pipeline] Cancelled by user before shop ${shopId}`)
        return {
          success: false,
          totalItems,
          successCount: currentSuccess,
          failedCount: currentFailed,
          details: {
            publishedProducts,
            channelResults,
            cancelled: true,
          },
          errors: [...errors, { itemId: 'cancelled', message: '사용자에 의해 취소됨', timestamp: new Date() }],
        }
      }

      // 해당 Shop에 아직 발행되지 않은 상품만 필터링
      const unpublishedProductIds = productIds.filter(productId => {
        const publishedShops = publishedShopsMap.get(productId)
        return !publishedShops || !publishedShops.has(shopId)
      })

      // 실제 발행 대상 수만 totalItems에 누적
      totalItems += unpublishedProductIds.length

      if (unpublishedProductIds.length === 0) {
        console.log(`[Publish Pipeline] All products already published to shop ${shopId}`)
        // Shop 정보 조회
        const shop = await prisma.shop.findFirst({
          where: { id: shopId, userId },
          select: { name: true },
        })
        channelResults.push({
          targetType: 'SHOP',
          targetId: shopId,
          targetName: `Shop: ${shop?.name || 'Unknown'}`,
          attempted: 0,
          
          success: 0,
          failed: 0,
          skipped: productIds.length,
          errors: [],
          channelId: shopId,
          channelName: `Shop: ${shop?.name || 'Unknown'}`,
        })
        continue
      }

      console.log(`[Publish Pipeline] Publishing ${unpublishedProductIds.length} products to shop ${shopId} (${productIds.length - unpublishedProductIds.length} already published)`)

      const shopResult = await publishService.publishShopBatch({
        userId,
        productIds: unpublishedProductIds,
        shopId,
      })

      // Shop 결과를 channelResults에 추가 (명시적 타입 구분)
      const shopChannelResult: ChannelPublishResult = {
        targetType: 'SHOP',
        targetId: shopId,
        targetName: `Shop: ${shopResult.shopName}`,
        attempted: shopResult.total,
        success: shopResult.successCount,
        failed: shopResult.failedCount,
        skipped: shopResult.skippedCount,
        errors: shopResult.errors,
        // 하위 호환성을 위한 deprecated 필드
        channelId: shopId,
        channelName: `Shop: ${shopResult.shopName}`,
      }
      channelResults.push(shopChannelResult)

      // 개별 상품 결과 추가
      for (const productResult of shopResult.results) {
        publishedProducts.push({
          productId: productResult.productId,
          targetType: 'SHOP',
          targetId: shopId,
          targetName: shopResult.shopName,
          status: productResult.success
            ? productResult.skipped
              ? 'SKIPPED'
              : 'SUCCESS'
            : 'FAILED',
          error: productResult.error,
          // 하위 호환성을 위한 deprecated 필드
          channelId: shopId,
          channelName: `Shop: ${shopResult.shopName}`,
        })

        if (!productResult.success && productResult.error) {
          errors.push({
            itemId: `${productResult.productId}-shop-${shopId}`,
            message: productResult.error,
            timestamp: new Date(),
          })
        }
      }

      currentSuccess += shopResult.successCount
      currentFailed += shopResult.failedCount
      // totalItems는 이미 Line 284에서 추가됨 - 중복 집계 제거

      if (workflowLogId) {
        await updateWorkflowProgress(workflowLogId, totalItems, currentSuccess, currentFailed, {
          publish: {
            totalItems,
            successCount: currentSuccess,
            failedCount: currentFailed,
            currentChannel: `Shop: ${shopResult.shopName}`,
            currentProgress: { current: shopResult.successCount, total: shopResult.total },
            channelResults: channelResults.map(cr => ({
              targetType: cr.targetType,
              targetId: cr.targetId,
              targetName: cr.targetName,
              attempted: cr.attempted,
              success: cr.success,
              failed: cr.failed,
              skipped: cr.skipped,
            })),
            publishedProducts: publishedProducts.slice(-10),
            errors: errors.slice(-5),
          },
        })
      }
    }
  }

  // =============================================
  // 2. 소매채널(Band) 발행
  // =============================================
  // PublishService를 사용하여 각 채널에 순차 발행 (실시간 진행 상황 추적)
  // 각 채널을 순차적으로 처리하면서 진행 상황을 업데이트
  for (const channel of retailChannels) {
    // 취소 체크: 각 채널 발행 전에 확인
    if (await checkCancellation()) {
      console.log(`[Publish Pipeline] Cancelled by user before channel ${channel.id}`)
      cleanup()
      return {
        success: false,
        totalItems,
        successCount: currentSuccess,
        failedCount: currentFailed,
        details: {
          publishedProducts,
          channelResults,
          cancelled: true,
        },
        errors: [...errors, { itemId: 'cancelled', message: '사용자에 의해 취소됨', timestamp: new Date() }],
      }
    }
    // 해당 채널에 아직 발행되지 않은 상품만 필터링
    const unpublishedProductIds = productIds.filter(productId => {
      const publishedChannels = publishedChannelsMap.get(productId)
      return !publishedChannels || !publishedChannels.has(channel.id)
    })

    // 실제 발행 대상 수만 totalItems에 누적
    totalItems += unpublishedProductIds.length

    if (unpublishedProductIds.length === 0) {
      console.log(`[Publish Pipeline] All products already published to channel ${channel.id} (${channel.name})`)
      channelResults.push({
        targetType: 'CHANNEL',
        targetId: channel.id,
        targetName: channel.name,
        attempted: 0,
        success: 0,
        failed: 0,
        skipped: productIds.length,
        errors: [],
        // 하위 호환성을 위한 deprecated 필드
        channelId: channel.id,
        channelName: channel.name,
      })
      continue
    }

    console.log(`[Publish Pipeline] Publishing ${unpublishedProductIds.length} products to channel ${channel.id} (${channel.name})`)

    const result = await publishService.publishBatch({
      userId,
      productIds: unpublishedProductIds,
      channelId: channel.id,
      // 각 상품 발행 후 실시간 진행 상황 업데이트 및 취소 체크
      onProgress: workflowLogId ? async (current, total, productResult) => {
        // 취소 체크
        if (await checkCancellation()) {
          throw new CancellationError()
        }
        // 개별 상품 결과 추가
        publishedProducts.push({
          productId: productResult.productId,
          targetType: 'CHANNEL',
          targetId: productResult.channelId,
          targetName: channel.name,
          postKey: productResult.postKey,
          status: productResult.success
            ? productResult.skipped
              ? 'SKIPPED'
              : 'SUCCESS'
            : 'FAILED',
          error: productResult.error,
          // 하위 호환성을 위한 deprecated 필드
          channelId: productResult.channelId,
          channelName: channel.name,
        })

        // 에러 수집
        if (!productResult.success && productResult.error) {
          errors.push({
            itemId: `${productResult.productId}-${productResult.channelId}`,
            message: productResult.error,
            timestamp: new Date(),
          })
        }

        // 진행 상황 업데이트 (성공/실패 카운트)
        if (productResult.success && !productResult.skipped) {
          currentSuccess++
        } else if (!productResult.success) {
          currentFailed++
        }

        // 실시간 DB 업데이트 (업로드 진행 정보 포함)
        await updateWorkflowProgress(workflowLogId, totalItems, currentSuccess, currentFailed, {
          publish: {
            totalItems,
            successCount: currentSuccess,
            failedCount: currentFailed,
            currentChannel: channel.name,
            currentProgress: { current, total },
            channelResults: channelResults.map(cr => ({
              targetType: cr.targetType,
              targetId: cr.targetId,
              targetName: cr.targetName,
              attempted: cr.attempted,
              success: cr.success,
              failed: cr.failed,
              skipped: cr.skipped,
            })),
            uploadProgress: currentUploadProgress,
            publishedProducts: publishedProducts.slice(-10),
            errors: errors.slice(-5),
          },
        })
      } : undefined,
    })

    // 채널별 결과 변환 (세션 만료 체크 전에 먼저 추가)
    const channelResult: ChannelPublishResult = {
      targetType: 'CHANNEL',
      targetId: result.channelId,
      targetName: result.channelName,
      attempted: result.total,
      success: result.successCount,
      failed: result.failedCount,
      skipped: result.skippedCount,
      errors: result.errors,
      // 하위 호환성을 위한 deprecated 필드
      channelId: result.channelId,
      channelName: result.channelName,
    }
    channelResults.push(channelResult)

    // 세션 만료 에러 감지 - 파이프라인 실패 처리
    const sessionExpiredError = result.errors.find(e => isSessionExpiredError(e))
    if (sessionExpiredError) {
      console.log(`[Publish Pipeline] 세션 만료 감지 - 발행 실패 처리`)

      // 남은 채널들에 대해 실패 처리
      const currentChannelIndex = channelIds.indexOf(channel.id)
      const remainingChannels = channelIds.slice(currentChannelIndex + 1)
      const remainingProductCount = remainingChannels.length * unpublishedProductIds.length

      // 이벤트 리스너 정리
      cleanup()

      // 실패 결과 반환
      return {
        success: false,
        totalItems,
        successCount: currentSuccess,
        failedCount: currentFailed + remainingProductCount,
        details: {
          publishedProducts,
          channelResults,
          sessionExpired: true,
          failedChannel: { id: channel.id, name: channel.name },
        },
        errors: [...errors, { itemId: 'session', message: `세션 만료: ${sessionExpiredError}. Band에 다시 로그인 후 재시도해주세요.`, timestamp: new Date() }],
      }
    }

    // onProgress가 없는 경우 (workflowLogId가 없는 경우) 여기서 결과 처리
    if (!workflowLogId) {
      for (const productResult of result.results) {
        publishedProducts.push({
          productId: productResult.productId,
          targetType: 'CHANNEL',
          targetId: productResult.channelId,
          targetName: channel.name,
          postKey: productResult.postKey,
          status: productResult.success
            ? productResult.skipped
              ? 'SKIPPED'
              : 'SUCCESS'
            : 'FAILED',
          error: productResult.error,
          // 하위 호환성을 위한 deprecated 필드
          channelId: productResult.channelId,
          channelName: channel.name,
        })

        if (!productResult.success && productResult.error) {
          errors.push({
            itemId: `${productResult.productId}-${productResult.channelId}`,
            message: productResult.error,
            timestamp: new Date(),
          })
        }
      }
      currentSuccess += channelResult.success
      currentFailed += channelResult.failed
    }
  }

  // 최종 결과 집계
  const totalSuccess = currentSuccess
  const totalFailed = currentFailed

  // 이벤트 리스너 정리
  cleanup()

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
