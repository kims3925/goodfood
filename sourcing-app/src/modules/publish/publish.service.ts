/**
 * Publish Service
 * 상품을 소매채널(Band 등)에 발행하는 핵심 서비스
 *
 * 발행 방식:
 * 1. Playwright (세션 있을 때): 이미지 포함 발행
 * 2. Band API (폴백): 텍스트만 발행
 *
 * 이 서비스는 다음에서 사용됩니다:
 * - 발행 페이지 API (/api/shop/publish)
 * - 자동화 파이프라인 (automation/pipelines/publish.ts)
 */

import prisma, { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { NaverBandClient } from '@/modules/sourcing/domain/src/channel'
import { bandPlaywrightService } from '@/modules/band-playwright/band-playwright.service'
import { calculateSellingPrice } from '@/lib/price-calculator'
import type {
  PublishToChannelParams,
  PublishToChannelResult,
  PublishBatchParams,
  PublishBatchResult,
  PublishMultiChannelParams,
  PublishMultiChannelResult,
  ProductForPublish,
  PublishToShopParams,
  PublishToShopResult,
  PublishShopBatchParams,
  PublishShopBatchResult,
  PublishDetailedProgress,
  PublishSSEEvent,
  PublishStageCallback,
} from './types'

// Band API 쿨다운 지연 시간 (10초)
const BAND_API_COOLDOWN_MS = 10000
// Playwright 발행 쿨다운 지연 시간 (2초)
const PLAYWRIGHT_COOLDOWN_MS = 2000

// 쿼터 에러 재시도 설정
const MAX_QUOTA_RETRIES = 3
const QUOTA_RETRY_BASE_DELAY_MS = 30000  // 30초 (30s, 60s, 120s 지연)

// 이미지 업로드 재시도 설정
const MAX_IMAGE_UPLOAD_RETRIES = 2  // 최대 2회 재시도 (총 3회 시도)
const IMAGE_UPLOAD_RETRY_DELAY_MS = 5000  // 5초 대기 후 재시도

// 지연 함수
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// 쿼터 에러 확인 함수
function isQuotaError(error: any): boolean {
  const message = error?.message || ''
  return (
    message.includes('쿼터') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429') ||
    (error?.status === 429)
  )
}

/**
 * 가격 포맷팅 (1000 → "1,000")
 */
function formatPrice(price: number): string {
  return price.toLocaleString('ko-KR')
}

/**
 * 게시글 내용 생성
 * 소매밴드 발행용 - 옵션별 판매가 포함
 * 본문 구조: 쇼핑몰URL → 상품명 → 옵션별 판매가 → 상품설명 → 쇼핑몰URL
 */
function buildPostContent(
  product: ProductForPublish,
  options?: { orderLink?: string }
): string {
  const lines: string[] = []

  // 상품명 (맨 위에 노출)
  lines.push(product.name)
  lines.push('')

  // 옵션별 판매가 표시
  if (product.variants && product.variants.length > 0) {
    const shippingFee = product.shippingFee || 0
    const bundleShippingType = product.bundleShippingType || null

    lines.push('💰 판매가')
    for (const variant of product.variants) {
      const sellingPrice = calculateSellingPrice(
        variant.price,
        shippingFee,
        bundleShippingType
      )
      const optionName = variant.optionSummary || '기본'
      lines.push(`• ${optionName}: ${formatPrice(sellingPrice)}원`)
    }
    lines.push('')
  }

  // 상품 설명
  if (product.description) {
    lines.push(product.description)
  }

  // 하단 쇼핑몰 링크
  if (options?.orderLink) {
    lines.push('')
    lines.push(`🛒 주문하기 👉 ${options.orderLink}`)
  }

  return lines.join('\n')
}

function toProductForPublish(product: {
  id: number
  name: string
  description: string | null
  shippingFee: number | null
  bundleShippingType: string | null
  variants: Array<{
    id: number
    optionSummary: string | null
    price: number
    wholesalePrice: unknown
  }>
}): ProductForPublish {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    shippingFee: product.shippingFee ?? null,
    bundleShippingType: product.bundleShippingType ?? null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      optionSummary: variant.optionSummary,
      price: variant.price,
      wholesalePrice: variant.wholesalePrice == null ? null : Number(variant.wholesalePrice),
    })),
  }
}

export class PublishService {
  /**
   * 단일 상품을 단일 채널에 발행 (쿼터 에러 시 재시도)
   */
  async publishToChannel(params: PublishToChannelParams, retryCount: number = 0): Promise<PublishToChannelResult> {
    const { userId, productId, channelId } = params

    try {
      // 1. 채널 정보 조회 (연결된 Shop 정보 + Playwright 세션 포함)
      const channel = await prisma.channel.findFirst({
        where: {
          id: channelId,
          userId,
          kind: ChannelKind.RETAIL,
          isActive: true,
        },
        include: {
          shop: {
            select: {
              id: true,
              subdomain: true,
              name: true,
              isActive: true,
            },
          },
        },
      })

      // Playwright 세션 정보 별도 조회 (bandSessionCookie, sessionExpiresAt)
      const channelSession = await prisma.channel.findFirst({
        where: { id: channelId },
        select: {
          bandSessionCookie: true,
          sessionExpiresAt: true,
        },
      })

      if (!channel) {
        return {
          success: false,
          productId,
          channelId,
          error: '채널을 찾을 수 없거나 발행 권한이 없습니다.',
        }
      }

      // 소매채널에 쇼핑몰이 연결되어 있는지 확인
      if (!channel.shop || !channel.shop.isActive) {
        return {
          success: false,
          productId,
          channelId,
          error: '소매채널에 쇼핑몰이 연결되어 있지 않습니다. 채널 설정에서 쇼핑몰을 연결해주세요.',
        }
      }

      // 쇼핑몰에 subdomain이 설정되어 있는지 확인 (주문 링크 생성에 필요)
      if (!channel.shop.subdomain) {
        return {
          success: false,
          productId,
          channelId,
          error: '쇼핑몰에 도메인이 설정되어 있지 않습니다. 쇼핑몰 설정에서 도메인을 설정해주세요.',
        }
      }

      // 사용자의 Band API 설정 조회
      const apiConfig = await prisma.sourcingApiConfig.findFirst({
        where: {
          userId,
          platform: 'BAND',
          isActive: true,
        },
      })

      // 2. 상품 정보 조회 (스냅샷용 필드 포함)
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          userId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          thumbnailUrl: true,
          shippingFee: true,
          bundleShippingType: true,
          variants: {
            select: {
              id: true,
              optionSummary: true,
              price: true,
              wholesalePrice: true,
            },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            select: { url: true },
          },
        },
      })

      if (!product) {
        return {
          success: false,
          productId,
          channelId,
          error: '상품을 찾을 수 없습니다.',
        }
      }

      // 3. 이미 발행 여부 확인 (활성 레코드만 - deletedAt: null)
      const existingActivePublish = await prisma.channelProduct.findFirst({
        where: {
          productId,
          channelId,
          deletedAt: null,
        },
      })

      if (existingActivePublish) {
        return {
          success: true,
          productId,
          channelId,
          publishedProductId: existingActivePublish.id,
          skipped: true,
          skipReason: '이미 발행된 상품입니다.',
        }
      }

      // 4. 주문 링크 생성 (연결된 Shop이 있는 경우) - 경로 기반 URL
      let orderLink: string | undefined
      if (channel.shop?.subdomain && channel.shop.isActive) {
        const shopBaseUrl = process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'http://localhost:3000'
        orderLink = `${shopBaseUrl}/${channel.shop.subdomain}/product/${productId}`
      }

      // 5. 게시물 내용 생성 (쇼핑몰URL → 상품내용 → 쇼핑몰URL)
      const postContent = buildPostContent(toProductForPublish(product), { orderLink })

      // 이미지 URL 추출 (최대 20개)
      const imageUrls = (product.images?.map(img => img.url).filter((url): url is string => !!url && url.length > 0) || []).slice(0, 20)

      // 6. 발행 방식 결정 및 실행
      let postKey: string | undefined
      let publishMethod: 'playwright' | 'api' = 'api'
      let imageCount = 0

      // Playwright 세션 유효성 확인
      // bandSessionCookie가 존재하면 유효한 것으로 간주 (sessionExpiresAt는 보조 지표)
      // - sessionExpiresAt이 null인 경우에도 쿠키가 있으면 시도 (배포 시점 차이로 null일 수 있음)
      // - sessionExpiresAt이 있고 만료된 경우에만 무효로 처리
      const hasValidSession = !!channelSession?.bandSessionCookie &&
        (channelSession.sessionExpiresAt === null ||
         new Date(channelSession.sessionExpiresAt) > new Date())

      // 6-1. Playwright 발행 시도 (세션이 유효하고 이미지가 있는 경우)
      // 소매밴드 발행은 Playwright로만 진행 - 이미지 업로드 실패 시 재시도
      if (hasValidSession && imageUrls.length > 0) {
        let playwrightSuccess = false
        let lastError: string | undefined

        // 이미지 업로드 재시도 루프 (최대 MAX_IMAGE_UPLOAD_RETRIES + 1 회 시도)
        for (let attempt = 0; attempt <= MAX_IMAGE_UPLOAD_RETRIES; attempt++) {
          if (attempt > 0) {
            console.log(`[PublishService] 이미지 업로드 재시도 ${attempt}/${MAX_IMAGE_UPLOAD_RETRIES} (${IMAGE_UPLOAD_RETRY_DELAY_MS / 1000}초 대기)`)
            await delay(IMAGE_UPLOAD_RETRY_DELAY_MS)
          }

          console.log(`[PublishService] Playwright 발행 시도 ${attempt + 1}/${MAX_IMAGE_UPLOAD_RETRIES + 1} (${imageUrls.length}개 이미지)`)

          const playwrightResult = await bandPlaywrightService.publishWithImages({
            channelId,
            bandKey: channel.channelKey,
            bandName: channel.name,
            content: postContent,
            imageUrls,
            commentContent: orderLink ? `주문하기 👉 ${orderLink}` : undefined,
          })

          if (playwrightResult.success && playwrightResult.postKey) {
            postKey = playwrightResult.postKey
            publishMethod = 'playwright'
            imageCount = imageUrls.length
            playwrightSuccess = true
            console.log(`[PublishService] Playwright 발행 성공: ${postKey} (${imageCount}개 이미지)`)

            break
          } else {
            lastError = playwrightResult.error
            console.error(`[PublishService] Playwright 발행 실패 (시도 ${attempt + 1}): ${lastError}`)

            // 재시도 불가능한 에러인 경우 즉시 중단
            // - 세션 만료: 재시도해도 실패
            // - 밴드를 찾을 수 없음: 설정 문제
            if (lastError?.includes('세션') || lastError?.includes('로그인') || lastError?.includes('밴드를 찾을 수 없습니다')) {
              console.log(`[PublishService] 재시도 불가능한 에러, 중단`)
              break
            }
          }
        }

        if (!playwrightSuccess) {
          // 모든 재시도 실패 - 글만 올라가는 것 방지
          console.error(`[PublishService] Playwright 발행 최종 실패 (${MAX_IMAGE_UPLOAD_RETRIES + 1}회 시도): ${lastError}`)
          return {
            success: false,
            productId,
            channelId,
            error: lastError || '소매밴드 발행에 실패했습니다. (이미지 업로드 또는 게시글 등록 실패)',
          }
        }
      } else if (imageUrls.length > 0 && !hasValidSession) {
        // 이미지가 있지만 세션이 없는 경우 - 발행 불가
        console.error(`[PublishService] 세션 없음 - 이미지 포함 발행 불가`)
        return {
          success: false,
          productId,
          channelId,
          error: '밴드 세션이 없거나 만료되었습니다. 채널 설정에서 밴드 로그인을 해주세요.',
        }
      } else if (imageUrls.length === 0) {
        // 이미지가 없는 경우 - Band API로 텍스트만 발행
        if (!apiConfig?.accessToken) {
          return {
            success: false,
            productId,
            channelId,
            error: 'Band API 토큰이 설정되지 않았습니다. 설정 > API 연동에서 Band API를 설정해주세요.',
          }
        }

        const bandClient = new NaverBandClient(apiConfig.accessToken)
        const result = await bandClient.createPost(channel.channelKey, postContent, {
          doPush: false, // 푸시 알림 비활성화
        })
        postKey = result.postKey
        publishMethod = 'api'
        console.log(`[PublishService] Band API 발행 성공: ${postKey} (텍스트만, 이미지 없음)`)
      }

      // 7. ChannelProduct 레코드 생성 또는 복원 (soft-deleted 레코드가 있으면 복원, postKey 저장)
      const channelProduct = await prisma.channelProduct.upsert({
        where: {
          productId_channelId: { productId, channelId },
        },
        update: {
          // soft-deleted 레코드 복원
          deletedAt: null,
          publishedAt: new Date(),
          postKey: postKey || undefined,
        },
        create: {
          userId,
          productId,
          channelId,
          publishedAt: new Date(),
          postKey: postKey || undefined,
        },
      })

      console.log(
        `[PublishService] Published product ${productId} to channel ${channel.name} (${publishMethod}${orderLink ? ', with order link' : ''})`
      )

      return {
        success: true,
        productId,
        channelId,
        publishedProductId: channelProduct.id,
        imageCount,
        publishMethod,
      }
    } catch (error: any) {
      console.error(`[PublishService] Error publishing product ${productId} to channel ${channelId}:`, error)

      // 쿼터 에러이고 재시도 가능한 경우
      if (isQuotaError(error) && retryCount < MAX_QUOTA_RETRIES) {
        const retryDelay = Math.pow(2, retryCount) * QUOTA_RETRY_BASE_DELAY_MS  // 30s, 60s, 120s
        console.log(`[PublishService] Quota error, retrying in ${retryDelay / 1000}s (attempt ${retryCount + 1}/${MAX_QUOTA_RETRIES})`)
        await delay(retryDelay)
        return this.publishToChannel(params, retryCount + 1)
      }

      return {
        success: false,
        productId,
        channelId,
        error: error.message || '발행 중 오류가 발생했습니다.',
      }
    }
  }

  /**
   * 여러 상품을 단일 채널에 발행 (배치)
   * Playwright 세션이 있으면 이미지 포함, 없으면 Band API로 텍스트만 발행
   */
  async publishBatch(params: PublishBatchParams): Promise<PublishBatchResult> {
    const { userId, productIds, channelId, onProgress } = params

    // 채널 정보 조회 (Shop 정보 포함)
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId,
        kind: ChannelKind.RETAIL,
        isActive: true,
      },
      include: {
        shop: {
          select: {
            id: true,
            subdomain: true,
            name: true,
            isActive: true,
          },
        },
      },
    })

    if (!channel) {
      return {
        success: false,
        channelId,
        channelName: 'Unknown',
        total: productIds.length,
        successCount: 0,
        failedCount: productIds.length,
        skippedCount: 0,
        results: productIds.map((productId) => ({
          success: false,
          productId,
          channelId,
          error: '채널을 찾을 수 없습니다.',
        })),
        errors: ['채널을 찾을 수 없습니다.'],
      }
    }

    // 사용자의 Band API 설정 조회
    const apiConfig = await prisma.sourcingApiConfig.findFirst({
      where: {
        userId,
        platform: 'BAND',
        isActive: true,
      },
    })

    console.log(`[PublishService] Batch publishing ${productIds.length} products to channel ${channel.name}`)

    const results: PublishToChannelResult[] = []
    const errors: string[] = []
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0
    let lastPublishMethod: 'playwright' | 'api' | null = null

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i]

      // 첫 번째가 아니면 쿨다운 대기 (발행 방식에 따라 다름)
      if (i > 0 && lastPublishMethod) {
        const cooldownMs = lastPublishMethod === 'playwright' ? PLAYWRIGHT_COOLDOWN_MS : BAND_API_COOLDOWN_MS
        console.log(`[PublishService] Waiting ${cooldownMs / 1000}s for ${lastPublishMethod} cooldown...`)
        await delay(cooldownMs)
      }

      const result = await this.publishToChannel({ userId, productId, channelId })
      results.push(result)

      // 다음 쿨다운을 위해 발행 방식 저장
      if (result.publishMethod) {
        lastPublishMethod = result.publishMethod
      }

      if (result.success) {
        if (result.skipped) {
          skippedCount++
        } else {
          successCount++
        }
      } else {
        failedCount++
        if (result.error) {
          errors.push(`Product ${productId}: ${result.error}`)
        }
      }

      // 진행 상황 콜백 호출
      if (onProgress) {
        await onProgress(i + 1, productIds.length, result)
      }
    }

    return {
      success: failedCount === 0,
      channelId,
      channelName: channel.name,
      total: productIds.length,
      successCount,
      failedCount,
      skippedCount,
      results,
      errors,
    }
  }

  /**
   * 여러 상품을 여러 채널에 발행
   */
  async publishMultiChannel(params: PublishMultiChannelParams): Promise<PublishMultiChannelResult> {
    const { userId, productIds, channelIds } = params

    const channelResults: PublishBatchResult[] = []
    let totalSuccess = 0
    let totalFailed = 0
    let totalSkipped = 0

    for (const channelId of channelIds) {
      const result = await this.publishBatch({ userId, productIds, channelId })
      channelResults.push(result)
      totalSuccess += result.successCount
      totalFailed += result.failedCount
      totalSkipped += result.skippedCount
    }

    return {
      success: totalFailed === 0,
      totalItems: productIds.length * channelIds.length,
      successCount: totalSuccess,
      failedCount: totalFailed,
      skippedCount: totalSkipped,
      channelResults,
    }
  }

  /**
   * 단일 상품을 Shop에 발행
   */
  async publishToShop(params: PublishToShopParams): Promise<PublishToShopResult> {
    const { userId, productId, shopId } = params

    try {
      // 1. Shop 정보 조회
      const shop = await prisma.shop.findFirst({
        where: {
          id: shopId,
          userId,
          isActive: true,
        },
      })

      if (!shop) {
        return {
          success: false,
          productId,
          shopId,
          error: 'Shop을 찾을 수 없거나 권한이 없습니다.',
        }
      }

      // 2. 상품 정보 조회 (스냅샷용 필드 포함)
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          userId,
        },
        select: {
          id: true,
          name: true,
          thumbnailUrl: true,
          images: {
            orderBy: { sortOrder: 'asc' },
            select: { url: true },
          },
        },
      })

      if (!product) {
        return {
          success: false,
          productId,
          shopId,
          error: '상품을 찾을 수 없습니다.',
        }
      }

      // 3. 이미 발행 여부 확인 (활성 레코드만 - deletedAt: null)
      const existingActivePublish = await prisma.shopProduct.findFirst({
        where: {
          productId,
          shopId,
          deletedAt: null, // Soft Delete 필터링
        },
      })

      if (existingActivePublish) {
        return {
          success: true,
          productId,
          shopId,
          publishedProductId: existingActivePublish.id,
          skipped: true,
          skipReason: '이미 발행된 상품입니다.',
        }
      }

      // 4. ShopProduct 레코드 생성 또는 복원 (soft-deleted 레코드가 있으면 복원)
      const shopProduct = await prisma.shopProduct.upsert({
        where: {
          productId_shopId: { productId, shopId },
        },
        update: {
          // soft-deleted 레코드 복원
          deletedAt: null,
          publishedAt: new Date(),
        },
        create: {
          userId,
          productId,
          shopId,
          publishedAt: new Date(),
        },
      })

      console.log(
        `[PublishService] Published product ${productId} to shop ${shop.name} (id: ${shop.id})`
      )

      return {
        success: true,
        productId,
        shopId,
        publishedProductId: shopProduct.id,
      }
    } catch (error: any) {
      console.error(`[PublishService] Error publishing product ${productId} to shop ${shopId}:`, error)

      return {
        success: false,
        productId,
        shopId,
        error: error.message || '발행 중 오류가 발생했습니다.',
      }
    }
  }

  /**
   * 여러 상품을 단일 Shop에 발행 (배치)
   */
  async publishShopBatch(params: PublishShopBatchParams): Promise<PublishShopBatchResult> {
    const { userId, productIds, shopId } = params

    // Shop 정보 조회
    const shop = await prisma.shop.findFirst({
      where: {
        id: shopId,
        userId,
        isActive: true,
      },
    })

    if (!shop) {
      return {
        success: false,
        shopId,
        shopName: 'Unknown',
        total: productIds.length,
        successCount: 0,
        failedCount: productIds.length,
        skippedCount: 0,
        results: productIds.map((productId) => ({
          success: false,
          productId,
          shopId,
          error: 'Shop을 찾을 수 없습니다.',
        })),
        errors: ['Shop을 찾을 수 없습니다.'],
      }
    }

    const results: PublishToShopResult[] = []
    const errors: string[] = []
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    for (const productId of productIds) {
      const result = await this.publishToShop({ userId, productId, shopId })
      results.push(result)

      if (result.success) {
        if (result.skipped) {
          skippedCount++
        } else {
          successCount++
        }
      } else {
        failedCount++
        if (result.error) {
          errors.push(`Product ${productId}: ${result.error}`)
        }
      }
    }

    return {
      success: failedCount === 0,
      shopId,
      shopName: shop.name,
      total: productIds.length,
      successCount,
      failedCount,
      skippedCount,
      results,
      errors,
    }
  }

  /**
   * 단일 상품을 단일 채널에 발행 (상세 진행 콜백 포함)
   * SSE 스트리밍을 위한 메서드
   */
  async publishToChannelWithProgress(
    params: PublishToChannelParams & {
      onStageProgress?: PublishStageCallback
      signal?: AbortSignal // 취소 신호
    },
    retryCount: number = 0
  ): Promise<PublishToChannelResult> {
    const { userId, productId, channelId, onStageProgress, signal } = params

    // 취소 신호 확인
    if (signal?.aborted) {
      console.log(`[PublishService] 발행 취소됨 (상품 ${productId} 시작 전)`)
      return {
        success: false,
        productId,
        channelId,
        error: '발행이 취소되었습니다.',
      }
    }

    try {
      // 1. 채널 정보 조회
      const channel = await prisma.channel.findFirst({
        where: {
          id: channelId,
          userId,
          kind: ChannelKind.RETAIL,
          isActive: true,
        },
        include: {
          shop: {
            select: {
              id: true,
              subdomain: true,
              name: true,
              isActive: true,
            },
          },
        },
      })

      const channelSession = await prisma.channel.findFirst({
        where: { id: channelId },
        select: {
          bandSessionCookie: true,
          sessionExpiresAt: true,
        },
      })

      if (!channel) {
        return {
          success: false,
          productId,
          channelId,
          error: '채널을 찾을 수 없거나 발행 권한이 없습니다.',
        }
      }

      // 소매채널에 쇼핑몰이 연결되어 있는지 확인
      if (!channel.shop || !channel.shop.isActive) {
        if (onStageProgress) {
          await onStageProgress({
            productId,
            productName: `상품 ${productId}`,
            stage: 'failed',
            stageLabel: '실패',
            error: '소매채널에 쇼핑몰이 연결되어 있지 않습니다.',
          })
        }
        return {
          success: false,
          productId,
          channelId,
          error: '소매채널에 쇼핑몰이 연결되어 있지 않습니다. 채널 설정에서 쇼핑몰을 연결해주세요.',
        }
      }

      // 쇼핑몰에 subdomain이 설정되어 있는지 확인 (주문 링크 생성에 필요)
      if (!channel.shop.subdomain) {
        if (onStageProgress) {
          await onStageProgress({
            productId,
            productName: `상품 ${productId}`,
            stage: 'failed',
            stageLabel: '실패',
            error: '쇼핑몰에 도메인이 설정되어 있지 않습니다.',
          })
        }
        return {
          success: false,
          productId,
          channelId,
          error: '쇼핑몰에 도메인이 설정되어 있지 않습니다. 쇼핑몰 설정에서 도메인을 설정해주세요.',
        }
      }

      const apiConfig = await prisma.sourcingApiConfig.findFirst({
        where: {
          userId,
          platform: 'BAND',
          isActive: true,
        },
      })

      // 2. 상품 정보 조회 (스냅샷용 필드 포함)
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          userId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          thumbnailUrl: true,
          shippingFee: true,
          bundleShippingType: true,
          variants: {
            select: {
              id: true,
              optionSummary: true,
              price: true,
              wholesalePrice: true,
            },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            select: { url: true },
          },
        },
      })

      if (!product) {
        return {
          success: false,
          productId,
          channelId,
          error: '상품을 찾을 수 없습니다.',
        }
      }

      // 3. 이미 발행 여부 확인 (활성 레코드만 - deletedAt: null)
      const existingActivePublish = await prisma.channelProduct.findFirst({
        where: {
          productId,
          channelId,
          deletedAt: null,
        },
      })

      if (existingActivePublish) {
        // 건너뜀 상태 알림
        if (onStageProgress) {
          await onStageProgress({
            productId,
            productName: product.name,
            stage: 'skipped',
            stageLabel: '건너뜀 (이미 발행됨)',
          })
        }
        return {
          success: true,
          productId,
          channelId,
          publishedProductId: existingActivePublish.id,
          skipped: true,
          skipReason: '이미 발행된 상품입니다.',
        }
      }

      // 4. 주문 링크 생성
      let orderLink: string | undefined
      if (channel.shop?.subdomain && channel.shop.isActive) {
        const shopBaseUrl = process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'http://localhost:3000'
        orderLink = `${shopBaseUrl}/${channel.shop.subdomain}/product/${productId}`
      }

      // 5. 게시물 내용 생성
      const postContent = buildPostContent(toProductForPublish(product), { orderLink })
      const imageUrls = (product.images?.map(img => img.url).filter((url): url is string => !!url && url.length > 0) || []).slice(0, 20)

      // 6. 발행 방식 결정 및 실행
      let postKey: string | undefined
      let publishMethod: 'playwright' | 'api' = 'api'
      let imageCount = 0

      // bandSessionCookie가 존재하면 유효한 것으로 간주 (sessionExpiresAt는 보조 지표)
      const hasValidSession = !!channelSession?.bandSessionCookie &&
        (channelSession.sessionExpiresAt === null ||
         new Date(channelSession.sessionExpiresAt) > new Date())

      // Playwright 발행 시도 (세션 유효하고 이미지 있을 때)
      // 소매밴드 발행은 Playwright로만 진행 - 이미지 업로드 실패 시 재시도
      if (hasValidSession && imageUrls.length > 0) {
        let playwrightSuccess = false
        let lastError: string | undefined

        // 이미지 업로드 재시도 루프 (최대 MAX_IMAGE_UPLOAD_RETRIES + 1 회 시도)
        for (let attempt = 0; attempt <= MAX_IMAGE_UPLOAD_RETRIES; attempt++) {
          if (attempt > 0) {
            console.log(`[PublishService] 이미지 업로드 재시도 ${attempt}/${MAX_IMAGE_UPLOAD_RETRIES} (${IMAGE_UPLOAD_RETRY_DELAY_MS / 1000}초 대기)`)

            // 재시도 상태 콜백
            if (onStageProgress) {
              await onStageProgress({
                productId,
                productName: product.name,
                stage: 'retrying',
                stageLabel: `재시도 중 (${attempt}/${MAX_IMAGE_UPLOAD_RETRIES})`,
              })
            }

            await delay(IMAGE_UPLOAD_RETRY_DELAY_MS)
          }

          // 취소 신호 확인
          if (signal?.aborted) {
            console.log(`[PublishService] Playwright 발행 취소됨 (시도 ${attempt + 1} 전)`)
            return {
              success: false,
              productId,
              channelId,
              error: '발행이 취소되었습니다.',
            }
          }

          console.log(`[PublishService] Playwright 발행 시도 ${attempt + 1}/${MAX_IMAGE_UPLOAD_RETRIES + 1} (${imageUrls.length}개 이미지) - 진행률 추적`)

          const playwrightResult = await bandPlaywrightService.publishWithImages({
            channelId,
            bandKey: channel.channelKey,
            bandName: channel.name,
            content: postContent,
            imageUrls,
            commentContent: orderLink ? `주문하기 👉 ${orderLink}` : undefined,
            signal, // 취소 신호 전달
            // 진행률 콜백 전달
            onStageProgress: onStageProgress
              ? (progress) => onStageProgress({
                  productId,
                  productName: product.name,
                  ...progress,
                })
              : undefined,
          })

          if (playwrightResult.success && playwrightResult.postKey) {
            postKey = playwrightResult.postKey
            publishMethod = 'playwright'
            imageCount = imageUrls.length
            playwrightSuccess = true
            console.log(`[PublishService] Playwright 발행 성공: ${postKey} (${imageCount}개 이미지)`)

            break
          } else {
            lastError = playwrightResult.error
            console.error(`[PublishService] Playwright 발행 실패 (시도 ${attempt + 1}): ${lastError}`)

            // 재시도 불가능한 에러인 경우 즉시 중단
            if (lastError?.includes('세션') || lastError?.includes('로그인') || lastError?.includes('밴드를 찾을 수 없습니다')) {
              console.log(`[PublishService] 재시도 불가능한 에러, 중단`)
              break
            }
          }
        }

        if (!playwrightSuccess) {
          // 모든 재시도 실패 - 글만 올라가는 것 방지
          const errorMessage = lastError || '소매밴드 발행에 실패했습니다. (이미지 업로드 또는 게시글 등록 실패)'
          console.error(`[PublishService] Playwright 발행 최종 실패 (${MAX_IMAGE_UPLOAD_RETRIES + 1}회 시도): ${errorMessage}`)

          // 실패 상태 콜백 호출
          if (onStageProgress) {
            await onStageProgress({
              productId,
              productName: product.name,
              stage: 'failed',
              stageLabel: '실패',
              error: errorMessage,
              publishMethod: 'playwright',
            })
          }

          return {
            success: false,
            productId,
            channelId,
            error: errorMessage,
          }
        }
      } else if (imageUrls.length > 0 && !hasValidSession) {
        // 이미지가 있지만 세션이 없는 경우 - 발행 불가
        const errorMessage = '밴드 세션이 없거나 만료되었습니다. 채널 설정에서 밴드 로그인을 해주세요.'
        console.error(`[PublishService] 세션 없음 - 이미지 포함 발행 불가`)

        if (onStageProgress) {
          await onStageProgress({
            productId,
            productName: product.name,
            stage: 'failed',
            stageLabel: '실패',
            error: errorMessage,
          })
        }

        return {
          success: false,
          productId,
          channelId,
          error: errorMessage,
        }
      } else if (imageUrls.length === 0) {
        // 이미지가 없는 경우 - Band API로 텍스트만 발행
        if (!apiConfig?.accessToken) {
          if (onStageProgress) {
            await onStageProgress({
              productId,
              productName: product.name,
              stage: 'failed',
              stageLabel: '실패',
              error: 'Band API 토큰이 설정되지 않았습니다.',
            })
          }
          return {
            success: false,
            productId,
            channelId,
            error: 'Band API 토큰이 설정되지 않았습니다. 설정 > API 연동에서 Band API를 설정해주세요.',
          }
        }

        // API 발행 진행 상태 알림
        if (onStageProgress) {
          await onStageProgress({
            productId,
            productName: product.name,
            stage: 'submitting',
            stageLabel: '게시물 등록 중 (API)',
            publishMethod: 'api',
          })
        }

        const bandClient = new NaverBandClient(apiConfig.accessToken)
        const result = await bandClient.createPost(channel.channelKey, postContent, {
          doPush: false,
        })
        postKey = result.postKey
        publishMethod = 'api'
        console.log(`[PublishService] Band API 발행 성공: ${postKey} (텍스트만, 이미지 없음)`)
      }

      // 7. ChannelProduct 레코드 생성 또는 복원 (soft-deleted 레코드가 있으면 복원, postKey 저장)
      const channelProduct = await prisma.channelProduct.upsert({
        where: {
          productId_channelId: { productId, channelId },
        },
        update: {
          // soft-deleted 레코드 복원
          deletedAt: null,
          publishedAt: new Date(),
          postKey: postKey || undefined,
        },
        create: {
          userId,
          productId,
          channelId,
          publishedAt: new Date(),
          postKey: postKey || undefined,
        },
      })

      // 완료 상태 알림
      if (onStageProgress) {
        await onStageProgress({
          productId,
          productName: product.name,
          stage: 'completed',
          stageLabel: '완료',
          imageProgress: { current: imageCount, total: imageCount },
          publishMethod,
        })
      }

      return {
        success: true,
        productId,
        channelId,
        publishedProductId: channelProduct.id,
        imageCount,
        publishMethod,
      }
    } catch (error: any) {
      console.error(`[PublishService] Error publishing product ${productId} to channel ${channelId}:`, error)

      // 실패 상태 알림
      if (onStageProgress) {
        await onStageProgress({
          productId,
          productName: `Product ${productId}`,
          stage: 'failed',
          stageLabel: '실패',
          error: error.message,
        })
      }

      // 쿼터 에러 재시도
      if (isQuotaError(error) && retryCount < MAX_QUOTA_RETRIES) {
        const delayMs = QUOTA_RETRY_BASE_DELAY_MS * Math.pow(2, retryCount)
        console.log(`[PublishService] 쿼터 에러 발생, ${delayMs / 1000}초 후 재시도 (${retryCount + 1}/${MAX_QUOTA_RETRIES})...`)
        // 500ms 단위로 분할하여 취소 신호 확인
        const chunks = Math.ceil(delayMs / 500)
        for (let j = 0; j < chunks; j++) {
          if (signal?.aborted) {
            console.log(`[PublishService] 재시도 대기 중 취소됨`)
            return {
              success: false,
              productId,
              channelId,
              error: '발행이 취소되었습니다.',
            }
          }
          await delay(Math.min(500, delayMs - j * 500))
        }
        return this.publishToChannelWithProgress({ userId, productId, channelId, onStageProgress, signal }, retryCount + 1)
      }

      return {
        success: false,
        productId,
        channelId,
        error: error.message || '발행 중 오류가 발생했습니다.',
      }
    }
  }

  /**
   * 배치 발행 (SSE 스트리밍용)
   * Generator 함수로 각 상품 발행 시 SSE 이벤트를 yield
   * 이벤트 큐를 사용하여 콜백에서 발생한 진행률 이벤트도 전달
   */
  async *publishBatchWithStream(params: {
    userId: number
    productIds: number[]
    channelId: number
    signal?: AbortSignal // 취소 신호
  }): AsyncGenerator<PublishSSEEvent, void, unknown> {
    const { userId, productIds, channelId, signal } = params

    // 이벤트 큐 (콜백에서 발생한 이벤트 저장)
    const eventQueue: PublishSSEEvent[] = []

    // 채널 정보 조회
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId,
        kind: ChannelKind.RETAIL,
        isActive: true,
      },
    })

    if (!channel) {
      yield {
        type: 'error',
        timestamp: Date.now(),
        data: {
          error: '채널을 찾을 수 없습니다.',
        },
      }
      return
    }

    // 상품 정보 미리 조회 (이름 표시용)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, userId },
      select: { id: true, name: true },
    })
    const productNameMap = new Map(products.map(p => [p.id, p.name]))

    // 배치 시작 이벤트
    yield {
      type: 'batch_start',
      timestamp: Date.now(),
      data: {
        channelId,
        channelName: channel.name,
        totalProducts: productIds.length,
      },
    }

    let successCount = 0
    let failedCount = 0
    let skippedCount = 0
    let lastPublishMethod: 'playwright' | 'api' | null = null

    for (let i = 0; i < productIds.length; i++) {
      // 취소 신호 확인
      if (signal?.aborted) {
        console.log(`[PublishService] 발행 취소됨 (${i}/${productIds.length} 처리 후)`)
        yield {
          type: 'cancelled',
          timestamp: Date.now(),
          data: {
            message: '발행이 취소되었습니다.',
            processedCount: i,
            totalCount: productIds.length,
            successCount,
            failedCount,
            skippedCount,
          },
        }
        return
      }

      const productId = productIds[i]
      const productName = productNameMap.get(productId) || `상품 ${productId}`

      // 상품 발행 시작 이벤트
      yield {
        type: 'product_start',
        timestamp: Date.now(),
        data: {
          channelId,
          channelName: channel.name,
          totalProducts: productIds.length,
          currentIndex: i,
          progress: {
            productId,
            productName,
            stage: 'preparing',
            stageLabel: '준비 중',
          },
        },
      }

      // 쿨다운 대기 (취소 가능하도록 분할)
      if (i > 0 && lastPublishMethod) {
        const cooldownMs = lastPublishMethod === 'playwright' ? PLAYWRIGHT_COOLDOWN_MS : BAND_API_COOLDOWN_MS
        // 500ms 단위로 분할하여 취소 신호 확인
        const chunks = Math.ceil(cooldownMs / 500)
        for (let j = 0; j < chunks; j++) {
          if (signal?.aborted) break
          await delay(Math.min(500, cooldownMs - j * 500))
        }
        if (signal?.aborted) continue // 다음 반복에서 취소 처리
      }

      // 이벤트 큐 초기화
      eventQueue.length = 0

      // 발행 진행 - 진행 콜백에서 이벤트 큐에 추가
      const publishPromise = this.publishToChannelWithProgress({
        userId,
        productId,
        channelId,
        signal, // 취소 신호 전달
        onStageProgress: async (progress) => {
          // 콜백에서 이벤트 큐에 추가
          eventQueue.push({
            type: 'stage_update',
            timestamp: Date.now(),
            data: {
              channelId,
              channelName: channel.name,
              totalProducts: productIds.length,
              currentIndex: i,
              progress: {
                productId,
                productName,
                stage: progress.stage,
                stageLabel: progress.stageLabel,
                imageProgress: progress.imageProgress,
                uploadProgress: progress.uploadProgress,
                publishMethod: progress.publishMethod,
                error: progress.error,
              },
            },
          })
        },
      })

      // 발행 진행 중 이벤트 큐 폴링 (100ms 간격)
      let result: PublishToChannelResult | null = null
      let publishDone = false

      publishPromise.then(r => {
        result = r
        publishDone = true
      }).catch(err => {
        result = { success: false, productId, channelId, error: err.message }
        publishDone = true
      })

      // 발행 완료까지 이벤트 큐 체크
      while (!publishDone) {
        // 취소 신호 확인
        if (signal?.aborted) {
          console.log(`[PublishService] 발행 취소됨 (상품 ${productId} 처리 중)`)
          // 현재 진행 중인 발행은 완료될 때까지 기다림 (graceful shutdown)
          // 하지만 다음 상품은 처리하지 않음
          break
        }

        await delay(100)

        // 큐에 있는 이벤트 모두 yield
        while (eventQueue.length > 0) {
          const event = eventQueue.shift()!
          yield event
        }
      }

      // 남은 이벤트 처리
      while (eventQueue.length > 0) {
        const event = eventQueue.shift()!
        yield event
      }

      if (!result) {
        result = { success: false, productId, channelId, error: '알 수 없는 오류' }
      }

      if (result.publishMethod) {
        lastPublishMethod = result.publishMethod
      }

      // 결과 집계
      if (result.success) {
        if (result.skipped) {
          skippedCount++
        } else {
          successCount++
        }
      } else {
        failedCount++
      }

      // 상품 완료 이벤트
      yield {
        type: 'product_complete',
        timestamp: Date.now(),
        data: {
          channelId,
          channelName: channel.name,
          totalProducts: productIds.length,
          currentIndex: i,
          successCount,
          failedCount,
          skippedCount,
          progress: {
            productId,
            productName,
            stage: result.success ? (result.skipped ? 'skipped' : 'completed') : 'failed',
            stageLabel: result.success ? (result.skipped ? '건너뜀' : '완료') : '실패',
            imageProgress: result.imageCount
              ? { current: result.imageCount, total: result.imageCount }
              : undefined,
            error: result.error,
            publishMethod: result.publishMethod,
          },
        },
      }
    }

    // 배치 완료 이벤트
    yield {
      type: 'batch_complete',
      timestamp: Date.now(),
      data: {
        channelId,
        channelName: channel.name,
        totalProducts: productIds.length,
        successCount,
        failedCount,
        skippedCount,
      },
    }
  }
}

// 싱글톤 인스턴스
export const publishService = new PublishService()
