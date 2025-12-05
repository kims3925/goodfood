/**
 * Publish Service
 * 상품을 소매채널(Band 등)에 발행하는 핵심 서비스
 *
 * 이 서비스는 다음에서 사용됩니다:
 * - 발행 페이지 API (/api/shop/publish)
 * - 자동화 파이프라인 (automation/pipelines/publish.ts)
 */

import prisma, { ChannelKind } from '@bandauto/db'
import { NaverBandClient } from '@/modules/sourcing/domain/src/channel'
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

// 지연 함수
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 게시글 내용 생성
 */
function buildPostContent(
  product: ProductForPublish,
  options?: { orderLink?: string }
): string {
  const lines: string[] = []

  // 상단 주문 링크 (Shop 연결된 경우)
  if (options?.orderLink) {
    lines.push(`🛒 주문하기 👉 ${options.orderLink}`)
    lines.push('')
  }

  // 상품명
  lines.push(`🛍️ ${product.name}`)
  lines.push('')

  // 상품 설명
  if (product.description) {
    lines.push(product.description)
  } else if (product.collectedProduct?.post?.content) {
    lines.push(product.collectedProduct.post.content)
  }

  // 하단 주문 링크 (Shop 연결된 경우)
  if (options?.orderLink) {
    lines.push('')
    lines.push(`🛒 주문하기 👉 ${options.orderLink}`)
  }

  return lines.join('\n')
}

export class PublishService {
  /**
   * 단일 상품을 단일 채널에 발행
   */
  async publishToChannel(params: PublishToChannelParams): Promise<PublishToChannelResult> {
    const { userId, productId, channelId } = params

    try {
      // 1. 채널 정보 조회 (연결된 Shop 정보 포함)
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

      // 4. API 토큰 확인
      if (!apiConfig?.accessToken) {
        // API 토큰이 없으면 DB 기록만 생성 (수동 발행용)
        const publishedProduct = await prisma.publishedProduct.create({
          data: {
            userId,
            productId,
            channelId,
            publishedAt: new Date(),
          },
        })

        return {
          success: true,
          productId,
          channelId,
          publishedProductId: publishedProduct.id,
          skipped: true,
          skipReason: 'API 토큰이 없어 DB 기록만 생성되었습니다.',
        }
      }

      // 5. 주문 링크 생성 (연결된 Shop이 있는 경우)
      let orderLink: string | undefined
      if (channel.shop?.subdomain && channel.shop.isActive) {
        const baseDomain = process.env.NEXT_PUBLIC_DOMAIN || 'bandauto.com'
        const protocol = baseDomain.includes('lvh.me') || baseDomain.includes('localhost') ? 'http' : 'https'
        const shopUrl = `${protocol}://${channel.shop.subdomain}.${baseDomain}`
        orderLink = `${shopUrl}/product/${productId}`
      }

      // 6. Band API로 게시물 작성 (본문에 링크 포함)
      const bandClient = new NaverBandClient(apiConfig.accessToken)
      const postContent = buildPostContent(product, { orderLink })

      const { postKey } = await bandClient.createPost(channel.channelKey, postContent, {
        doPush: false, // 푸시 알림 비활성화
      })

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
   */
  async publishBatch(params: PublishBatchParams): Promise<PublishBatchResult> {
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

    // 사용자의 Band API 설정 조회
    const apiConfig = await prisma.sourcingApiConfig.findFirst({
      where: {
        userId,
        platform: 'BAND',
        isActive: true,
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
