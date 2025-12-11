/**
 * Publish Service
 * 상품을 소매채널(Band 등)에 발행하는 핵심 서비스
 *
 * 이 서비스는 다음에서 사용됩니다:
 * - 발행 페이지 API (/api/shop/publish)
 * - 자동화 파이프라인 (automation/pipelines/publish.ts)
 */

import prisma, { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { NaverBandClient } from '@/modules/sourcing/domain/src/channel'
import { bandPlaywrightService } from '@/modules/band-playwright'
import type {
  PublishToChannelParams,
  PublishToChannelResult,
  PublishBatchParams,
  PublishBatchResult,
  PublishMultiChannelParams,
  PublishMultiChannelResult,
  ProductForPublish,
  ChannelForPublish,
  PublishToShopParams,
  PublishToShopResult,
  PublishShopBatchParams,
  PublishShopBatchResult,
} from './types'

// Band API 쿨다운 지연 시간 (10초)
const DEFAULT_COOLDOWN_MS = 10000

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
 * 밴드에서는 이미지가 본문 아래에 표시되므로,
 * 본문 구조: 상품명 → 상품설명 → [이미지] → 주문링크 형태가 되도록
 * 주문 링크는 하단에만 배치
 */
function buildPostContent(
  product: ProductForPublish,
  options?: { orderLink?: string }
): string {
  const lines: string[] = []

  // 상품명
  lines.push(product.name)
  lines.push('')

  // 상품 설명
  if (product.description) {
    lines.push(product.description)
  } else if (product.collectedProduct?.post?.content) {
    lines.push(product.collectedProduct.post.content)
  }

  // 하단 주문 링크 (Shop 연결된 경우)
  // 밴드에서 이미지는 본문 아래에 자동 배치되므로
  // 주문 링크를 하단에만 두면: 본문 → 이미지 → 주문링크 순서가 됨
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
      // 1. 채널 정보 조회 (연결된 Shop 정보 및 Playwright 자동화용 필드 포함)
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
          productId,
          channelId,
          error: '채널을 찾을 수 없거나 발행 권한이 없습니다.',
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

      // 2. 상품 정보 조회 (이미지 포함)
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

      // 5. 이미지 URL 목록 준비
      const imageUrls: string[] = []
      if (product.thumbnailUrl) {
        imageUrls.push(product.thumbnailUrl)
      }
      if (product.images?.length) {
        imageUrls.push(...product.images.map(img => img.url))
      }

      // 6. 게시물 내용 생성
      const postContent = buildPostContent(product, { orderLink })

      // 7. Band 플랫폼이고 이미지가 있으며 네이버 계정이 설정된 경우 Playwright 사용
      if (
        channel.platform === ChannelPlatform.BAND &&
        imageUrls.length > 0 &&
        channel.naverId &&
        channel.naverPassword
      ) {
        console.log(`[PublishService] Using Playwright for product ${productId} with ${imageUrls.length} images`)

        const playwrightResult = await bandPlaywrightService.publishWithImages(
          {
            channelId,
            bandKey: channel.channelKey,
            bandName: channel.name,  // 밴드 홈에서 채널 찾기용
            content: postContent,
            imageUrls,
          },
          {
            naverId: channel.naverId,
            naverPassword: channel.naverPassword,
          }
        )

        if (!playwrightResult.success) {
          console.error(`[PublishService] Playwright publish failed: ${playwrightResult.error}`)

          // 세션/로그인 관련 에러면 API fallback 스킵 (쿼터 보호)
          const sessionKeywords = ['세션', '로그인', 'SESSION', 'LOGIN', 'CAPTCHA', '인증', '만료']
          const isSessionError = sessionKeywords.some(keyword =>
            playwrightResult.error?.toUpperCase().includes(keyword.toUpperCase())
          )

          if (isSessionError) {
            console.log(`[PublishService] Session error detected, skipping API fallback to protect quota`)
            return {
              success: false,
              productId,
              channelId,
              error: playwrightResult.error,
            }
          }

          // 다른 에러는 기존대로 API fallback
          console.log(`[PublishService] Falling back to API without images`)
        } else {
          // Playwright 성공 - PublishedProduct 레코드 생성
          const publishedProduct = await prisma.publishedProduct.create({
            data: {
              userId,
              productId,
              channelId,
              publishedAt: new Date(),
            },
          })

          console.log(
            `[PublishService] Published product ${productId} via Playwright to channel ${channel.name} -> post_key: ${playwrightResult.postKey} with ${playwrightResult.imageCount} images`
          )

          return {
            success: true,
            productId,
            channelId,
            postKey: playwrightResult.postKey,
            publishedProductId: publishedProduct.id,
          }
        }
      }

      // 8. API 토큰 확인 - 토큰 없으면 실패 처리 (실제 채널에 발행 불가)
      if (!apiConfig?.accessToken) {
        return {
          success: false,
          productId,
          channelId,
          error: 'Band API 토큰이 설정되지 않았습니다. 설정 > API 연동에서 Band API를 설정해주세요.',
        }
      }

      // 9. Band API로 게시물 작성 (이미지 없이 텍스트만)
      const bandClient = new NaverBandClient(apiConfig.accessToken)

      const { postKey } = await bandClient.createPost(channel.channelKey, postContent, {
        doPush: false, // 푸시 알림 비활성화
      })

      // 10. PublishedProduct 레코드 생성
      const publishedProduct = await prisma.publishedProduct.create({
        data: {
          userId,
          productId,
          channelId,
          publishedAt: new Date(),
        },
      })

      console.log(
        `[PublishService] Published product ${productId} to channel ${channel.name} -> post_key: ${postKey}${orderLink ? ` with order link` : ''}`
      )

      return {
        success: true,
        productId,
        channelId,
        postKey,
        publishedProductId: publishedProduct.id,
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
   * Playwright 사용 가능한 경우 배치 발행으로 효율적으로 처리
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

    // Playwright 배치 발행 가능 여부 확인
    const canUsePlaywrightBatch =
      channel.platform === ChannelPlatform.BAND &&
      channel.naverId &&
      channel.naverPassword

    // 상품 정보 조회
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
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
        publishedProducts: {
          where: { channelId },
          select: { id: true },
        },
      },
    })

    // 이미 발행된 상품 필터링
    const unpublishedProducts = products.filter(p => p.publishedProducts.length === 0)

    if (unpublishedProducts.length === 0) {
      console.log(`[PublishService] All products already published to channel ${channel.name}`)
      return {
        success: true,
        channelId,
        channelName: channel.name,
        total: productIds.length,
        successCount: 0,
        failedCount: 0,
        skippedCount: productIds.length,
        results: productIds.map((productId) => ({
          success: true,
          productId,
          channelId,
          skipped: true,
          skipReason: '이미 발행된 상품입니다.',
        })),
        errors: [],
      }
    }

    // 주문 링크 생성 함수 - 경로 기반 URL
    const getOrderLink = (productId: number): string | undefined => {
      if (channel.shop?.subdomain && channel.shop.isActive) {
        const shopBaseUrl = process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'http://localhost:3000'
        return `${shopBaseUrl}/${channel.shop.subdomain}/product/${productId}`
      }
      return undefined
    }

    // Playwright 배치 발행 사용
    if (canUsePlaywrightBatch) {
      console.log(`[PublishService] Using Playwright batch publish for ${unpublishedProducts.length} products`)

      // 배치 발행용 아이템 준비
      const batchItems = unpublishedProducts.map(product => {
        const orderLink = getOrderLink(product.id)
        const imageUrls: string[] = []
        if (product.thumbnailUrl) {
          imageUrls.push(product.thumbnailUrl)
        }
        if (product.images?.length) {
          imageUrls.push(...product.images.map(img => img.url))
        }

        return {
          productId: product.id,
          content: buildPostContent(product, { orderLink }),
          imageUrls,
        }
      })

      const results: PublishToChannelResult[] = []
      const errors: string[] = []
      let successCount = 0
      let failedCount = 0
      let skippedCount = products.length - unpublishedProducts.length

      // 이미 발행된 상품들 결과 추가
      for (const product of products) {
        if (product.publishedProducts.length > 0) {
          results.push({
            success: true,
            productId: product.id,
            channelId,
            skipped: true,
            skipReason: '이미 발행된 상품입니다.',
          })
        }
      }

      // Playwright 배치 발행 실행
      // 중요: onItemSuccess 콜백에서 Band API 성공 직후 즉시 DB 저장 수행
      // 이렇게 하면 페이지 새로고침 시에도 밴드 발행 결과가 DB에 반영됨
      const batchResult = await bandPlaywrightService.publishBatchWithImages(
        {
          channelId,
          bandKey: channel.channelKey,
          bandName: channel.name,
          items: batchItems,
          // Band API 성공 직후 즉시 호출되는 콜백 - DB 저장 수행
          onItemSuccess: async (itemResult) => {
            if (!itemResult.success || !itemResult.postKey) {
              return undefined
            }

            try {
              const publishedProduct = await prisma.publishedProduct.create({
                data: {
                  userId,
                  productId: itemResult.productId,
                  channelId,
                  publishedAt: new Date(),
                },
              })
              console.log(`[PublishService] DB saved immediately after Band API success: product ${itemResult.productId} -> publishedProductId ${publishedProduct.id}`)
              return publishedProduct.id
            } catch (dbError: any) {
              // 이미 존재하는 경우 (중복 발행) - 기존 레코드 조회
              if (dbError.code === 'P2002') {
                console.log(`[PublishService] PublishedProduct already exists: product ${itemResult.productId} -> channel ${channelId}`)
                const existing = await prisma.publishedProduct.findFirst({
                  where: { productId: itemResult.productId, channelId },
                  select: { id: true },
                })
                return existing?.id
              }
              throw dbError
            }
          },
          // 진행 상황 UI 업데이트 콜백 (onItemSuccess 이후에 호출됨)
          onProgress: async (current, total, itemResult) => {
            const result: PublishToChannelResult = {
              success: itemResult.success,
              productId: itemResult.productId,
              channelId,
              postKey: itemResult.postKey,
              error: itemResult.error,
            }

            // 성공/실패 카운트 업데이트 (DB 저장은 onItemSuccess에서 이미 완료)
            if (itemResult.success) {
              successCount++
            } else {
              failedCount++
              if (itemResult.error) {
                errors.push(`Product ${itemResult.productId}: ${itemResult.error}`)
              }
            }

            results.push(result)

            // 외부 onProgress 콜백 호출 (있는 경우)
            if (onProgress) {
              await onProgress(results.length, productIds.length, result)
            }
          },
        },
        {
          naverId: channel.naverId!,
          naverPassword: channel.naverPassword!,
        }
      )

      // 참고: DB 저장은 onItemSuccess 콜백에서 Band API 성공 직후 즉시 처리됨
      // 이렇게 하면 페이지 새로고침 시에도 이미 저장된 데이터는 유지됨

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

    // Playwright 사용 불가 - 기존 방식 (개별 발행)
    console.log(`[PublishService] Using individual publish for ${productIds.length} products`)

    // 사용자의 Band API 설정 조회
    const apiConfig = await prisma.sourcingApiConfig.findFirst({
      where: {
        userId,
        platform: 'BAND',
        isActive: true,
      },
    })

    const results: PublishToChannelResult[] = []
    const errors: string[] = []
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i]

      // 첫 번째가 아니면 쿨다운 대기 (Band API 제한)
      if (i > 0 && apiConfig) {
        console.log(`[PublishService] Waiting ${DEFAULT_COOLDOWN_MS / 1000}s for Band API cooldown...`)
        await delay(DEFAULT_COOLDOWN_MS)
      }

      const result = await this.publishToChannel({ userId, productId, channelId })
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
    const { userId, productIds, channelIds, cooldownMs = DEFAULT_COOLDOWN_MS } = params

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
}

// 싱글톤 인스턴스
export const publishService = new PublishService()
