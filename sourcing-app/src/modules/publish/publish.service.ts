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
 * 게시글 내용 생성
 * Band API로 텍스트만 발행 (이미지 없음)
 * 본문 구조: 쇼핑몰URL → 상품명 → 상품설명 → 쇼핑몰URL
 */
function buildPostContent(
  product: ProductForPublish,
  options?: { orderLink?: string }
): string {
  const lines: string[] = []

  // 상단 쇼핑몰 링크
  if (options?.orderLink) {
    lines.push(`🛒 주문하기 👉 ${options.orderLink}`)
    lines.push('')
  }

  // 상품명
  lines.push(product.name)
  lines.push('')

  // 상품 설명
  if (product.description) {
    lines.push(product.description)
  } else if (product.collectedProduct?.post?.content) {
    lines.push(product.collectedProduct.post.content)
  }

  // 하단 쇼핑몰 링크
  if (options?.orderLink) {
    lines.push('')
    lines.push(`🛒 주문하기 👉 ${options.orderLink}`)
  }

  return lines.join('\n')
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

      // 2. 상품 정보 조회
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          userId,
        },
        include: {
          variants: {
            select: {
              id: true,
              price: true,
              wholesalePrice: true,
            },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            select: { url: true },
          },
          collectedProduct: {
            include: {
              post: {
                select: {
                  content: true,
                },
              },
            },
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

      // 3. 이미 발행 여부 확인
      const existingPublish = await prisma.publishedProduct.findFirst({
        where: {
          productId,
          channelId,
        },
      })

      if (existingPublish) {
        return {
          success: true,
          productId,
          channelId,
          publishedProductId: existingPublish.id,
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
      const postContent = buildPostContent(product, { orderLink })

      // 이미지 URL 추출 (최대 20개)
      const imageUrls = (product.images?.map(img => img.url) || []).slice(0, 20)

      // 6. 발행 방식 결정 및 실행
      let postKey: string | undefined
      let publishMethod: 'playwright' | 'api' = 'api'
      let imageCount = 0

      // Playwright 세션 유효성 확인
      const hasValidSession = channelSession?.bandSessionCookie &&
        channelSession.sessionExpiresAt &&
        new Date(channelSession.sessionExpiresAt) > new Date()

      // 6-1. Playwright 발행 시도 (세션이 유효하고 이미지가 있는 경우)
      // 소매밴드 발행은 Playwright로만 진행 - 실패 시 API 폴백 없이 즉시 실패 처리
      if (hasValidSession && imageUrls.length > 0) {
        console.log(`[PublishService] Playwright 발행 시도 (${imageUrls.length}개 이미지)`)

        const playwrightResult = await bandPlaywrightService.publishWithImages({
          channelId,
          bandKey: channel.channelKey,
          bandName: channel.name,
          content: postContent,
          imageUrls,
        })

        if (playwrightResult.success && playwrightResult.postKey) {
          postKey = playwrightResult.postKey
          publishMethod = 'playwright'
          imageCount = imageUrls.length
          console.log(`[PublishService] Playwright 발행 성공: ${postKey} (${imageCount}개 이미지)`)
        } else {
          // Playwright 발행 실패 시 즉시 실패 반환 (API 폴백 없음)
          console.error(`[PublishService] Playwright 발행 실패: ${playwrightResult.error}`)
          return {
            success: false,
            productId,
            channelId,
            error: playwrightResult.error || '소매밴드 발행에 실패했습니다. (이미지 업로드 또는 게시글 등록 실패)',
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

      // 7. PublishedProduct 레코드 생성
      const publishedProduct = await prisma.publishedProduct.create({
        data: {
          userId,
          productId,
          channelId,
          publishedAt: new Date(),
        },
      })

      console.log(
        `[PublishService] Published product ${productId} to channel ${channel.name} -> post_key: ${postKey} (${publishMethod}${orderLink ? ', with order link' : ''})`
      )

      return {
        success: true,
        productId,
        channelId,
        postKey,
        publishedProductId: publishedProduct.id,
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

      // 2. 상품 정보 조회
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          userId,
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

      // 3. 이미 발행 여부 확인
      const existingPublish = await prisma.publishedProduct.findFirst({
        where: {
          productId,
          shopId,
        },
      })

      if (existingPublish) {
        return {
          success: true,
          productId,
          shopId,
          publishedProductId: existingPublish.id,
          skipped: true,
          skipReason: '이미 발행된 상품입니다.',
        }
      }

      // 4. PublishedProduct 레코드 생성
      const publishedProduct = await prisma.publishedProduct.create({
        data: {
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
        publishedProductId: publishedProduct.id,
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
    },
    retryCount: number = 0
  ): Promise<PublishToChannelResult> {
    const { userId, productId, channelId, onStageProgress } = params

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

      // 2. 상품 정보 조회
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          userId,
        },
        include: {
          variants: {
            select: {
              id: true,
              price: true,
              wholesalePrice: true,
            },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            select: { url: true },
          },
          collectedProduct: {
            include: {
              post: {
                select: {
                  content: true,
                },
              },
            },
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

      // 3. 이미 발행 여부 확인
      const existingPublish = await prisma.publishedProduct.findFirst({
        where: {
          productId,
          channelId,
        },
      })

      if (existingPublish) {
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
          publishedProductId: existingPublish.id,
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
      const postContent = buildPostContent(product, { orderLink })
      const imageUrls = (product.images?.map(img => img.url) || []).slice(0, 20)

      // 6. 발행 방식 결정 및 실행
      let postKey: string | undefined
      let publishMethod: 'playwright' | 'api' = 'api'
      let imageCount = 0

      const hasValidSession = channelSession?.bandSessionCookie &&
        channelSession.sessionExpiresAt &&
        new Date(channelSession.sessionExpiresAt) > new Date()

      // Playwright 발행 시도 (세션 유효하고 이미지 있을 때)
      // 소매밴드 발행은 Playwright로만 진행 - 실패 시 API 폴백 없이 즉시 실패 처리
      if (hasValidSession && imageUrls.length > 0) {
        console.log(`[PublishService] Playwright 발행 시도 (${imageUrls.length}개 이미지) - 진행률 추적`)

        const playwrightResult = await bandPlaywrightService.publishWithImages({
          channelId,
          bandKey: channel.channelKey,
          bandName: channel.name,
          content: postContent,
          imageUrls,
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
          console.log(`[PublishService] Playwright 발행 성공: ${postKey} (${imageCount}개 이미지)`)
        } else {
          // Playwright 발행 실패 시 즉시 실패 반환 (API 폴백 없음)
          const errorMessage = playwrightResult.error || '소매밴드 발행에 실패했습니다. (이미지 업로드 또는 게시글 등록 실패)'
          console.error(`[PublishService] Playwright 발행 실패: ${errorMessage}`)

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

      // 7. PublishedProduct 레코드 생성
      const publishedProduct = await prisma.publishedProduct.create({
        data: {
          userId,
          productId,
          channelId,
          publishedAt: new Date(),
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
        postKey,
        publishedProductId: publishedProduct.id,
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
        await delay(delayMs)
        return this.publishToChannelWithProgress({ userId, productId, channelId, onStageProgress }, retryCount + 1)
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
   */
  async *publishBatchWithStream(params: {
    userId: number
    productIds: number[]
    channelId: number
  }): AsyncGenerator<PublishSSEEvent, void, unknown> {
    const { userId, productIds, channelId } = params

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
      const productId = productIds[i]

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
            productName: `상품 ${productId}`,
            stage: 'preparing',
            stageLabel: '준비 중',
          },
        },
      }

      // 쿨다운 대기
      if (i > 0 && lastPublishMethod) {
        const cooldownMs = lastPublishMethod === 'playwright' ? PLAYWRIGHT_COOLDOWN_MS : BAND_API_COOLDOWN_MS
        await delay(cooldownMs)
      }

      // 발행 진행 - 진행 콜백으로 각 단계 전달
      const result = await this.publishToChannelWithProgress({
        userId,
        productId,
        channelId,
        onStageProgress: async (progress) => {
          // 단계 변경 이벤트를 yield할 수 없으므로 개별 발행 함수에서 처리
          // 여기서는 빈 처리 (이벤트는 product_complete에서 종합)
        },
      })

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
            productName: `상품 ${productId}`,
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
