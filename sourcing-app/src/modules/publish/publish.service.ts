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
import { resetSessionFailureCount } from '@/modules/band-playwright/band-session-manager'
import type { CrossPostInfo } from '@/modules/band-playwright/types'
import {
  resolveTierUnitPrice,
  normalizePriceTier,
  type PublishPriceTier,
} from '@/modules/pricing/publish-tier-pricing'
import { markPriceImagesOnProduct } from '@/modules/utils/priceImageFilter'
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

/**
 * 크로스포스트 파라미터 구성 (2026-06-06, 2026-06-07 보강).
 * - 채널(RETAIL)이 bandPublishMethod='CROSSPOST' opt-in 이고 tier=RETAIL 이며
 * - 원본 도매밴드 + 매칭 제목 + 변형 도매가가 있을 때만 반환.
 *
 * ⚠️ AI 가공 시 CollectedPost 가 삭제되어 product.collectedPost 가 null 이 되는 경우가 많다
 *    (collectedPostId onDelete:SetNull). 그래서 도매 출처는 **살아남는 Product.channel**
 *    (가공상품의 channelId = 도매 소스 채널)을 폴백으로 쓰고, 매칭 제목도
 *    collectedPost.title → sourceProductName → 상품명 순으로 폴백한다.
 *    (못 찾으면 crossPostToBand 가 throw → createPostWithImages 로 자동 폴백되므로 안전)
 */
function buildCrossPostInfo(
  channel: { bandPublishMethod?: string | null },
  product: {
    name?: string
    sourceProductName?: string | null
    variants?: { price: number; wholesalePrice: unknown }[]
    channel?: { name: string; channelKey: string; kind?: string } | null
    collectedPost?: { title: string | null; channel?: { name: string; channelKey: string } | null } | null
  },
  tier: string
): CrossPostInfo | undefined {
  if ((channel.bandPublishMethod || 'COMPOSE') !== 'CROSSPOST') return undefined
  if (tier !== 'RETAIL') return undefined // 도매(WHOLESALE) tier 는 기존 방식 유지
  // 원본 도매밴드: collectedPost.channel 우선, 없으면 Product.channel(도매)로 폴백
  const srcChannel =
    product.collectedPost?.channel ??
    (product.channel && (product.channel.kind === undefined || product.channel.kind === 'WHOLESALE')
      ? product.channel
      : null)
  // 매칭 제목: 원본글 제목 → 도매원본품명 → (최후) 가공 상품명
  const matchTitle = product.collectedPost?.title ?? product.sourceProductName ?? product.name ?? null
  if (!srcChannel?.channelKey || !srcChannel?.name || !matchTitle) return undefined
  const priceMap = (product.variants || [])
    .map((v) => ({ from: Math.round(Number(v.wholesalePrice ?? 0)), to: Math.round(Number(v.price ?? 0)) }))
    .filter((p) => p.from > 0 && p.to > 0)
  return {
    sourceBandKey: srcChannel.channelKey,
    sourceBandName: srcChannel.name,
    sourceMatchTitle: matchTitle,
    priceMap,
  }
}
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
 * - RETAIL tier(소매밴드/기존): 옵션별 판매가(소매가+배송비) + 쇼핑몰 주문 링크
 * - WHOLESALE tier(가족도매방밴드): 옵션별 도매가(INHERIT_SOURCE) + 쇼핑몰 CTA 숨김
 *   (지시서 §4.1: showMargin=도매가 노출 / hideRetailCTA=소매 링크 숨김)
 *
 * tier 별 가격은 resolveTierUnitPrice 로 선택만 한다(머니 수학 재계산 X — 이미 저장된 값 사용).
 */
function buildPostContent(
  product: ProductForPublish,
  options?: { orderLink?: string; tier?: PublishPriceTier }
): string {
  const tier = options?.tier ?? 'RETAIL'
  const lines: string[] = []

  // 상품명 (맨 위에 노출)
  lines.push(product.name)
  lines.push('')

  // 옵션별 단가 표시 (tier 에 따라 도매가/판매가)
  if (product.variants && product.variants.length > 0) {
    const shippingFee = product.shippingFee || 0
    const bundleShippingType = product.bundleShippingType || null

    lines.push(tier === 'WHOLESALE' ? '🏷️ 도매가' : '💰 판매가')
    for (const variant of product.variants) {
      const { unitPrice } = resolveTierUnitPrice({
        tier,
        wholesalePrice: variant.wholesalePrice,
        retailPrice: variant.price,
        shippingFee,
        bundleShippingType,
      })
      const optionName = variant.optionSummary || '기본'
      lines.push(`• ${optionName}: ${formatPrice(unitPrice)}원`)
    }
    lines.push('')
  }

  // 상품 설명
  if (product.description) {
    lines.push(product.description)
  }

  // 하단 쇼핑몰 링크 — 소매(RETAIL) 발행에만. 도매(WHOLESALE)는 소매 CTA 숨김.
  if (tier !== 'WHOLESALE' && options?.orderLink) {
    lines.push('')
    lines.push(`🛒 주문하기 👉 ${options.orderLink}`)
  }

  return lines.join('\n')
}

/**
 * 발행 시점 가격 스냅샷 생성 — ChannelProduct.priceSnapshot 에 저장.
 * 정책이 사후에 바뀌어도 발행 당시 옵션별 단가 근거가 보존된다(지시서 §2.2 / 골든 G8).
 */
function buildPriceSnapshot(
  product: ProductForPublish,
  tier: PublishPriceTier
): { snapshot: Record<string, unknown>; wholesaleFallback: boolean } {
  const shippingFee = product.shippingFee || 0
  const bundleShippingType = product.bundleShippingType || null
  let wholesaleFallback = false

  const items = (product.variants || []).map((variant) => {
    const r = resolveTierUnitPrice({
      tier,
      wholesalePrice: variant.wholesalePrice,
      retailPrice: variant.price,
      shippingFee,
      bundleShippingType,
    })
    if (r.wholesaleFallback) wholesaleFallback = true
    return {
      variantId: variant.id,
      optionSummary: variant.optionSummary,
      wholesalePrice: variant.wholesalePrice,
      retailPrice: variant.price,
      unitPrice: r.unitPrice,
    }
  })

  return {
    snapshot: {
      tier,
      shippingFee,
      bundleShippingType,
      items,
      snapshotAt: new Date().toISOString(),
    },
    wholesaleFallback,
  }
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

/**
 * Band 발행 직전 ProductImage 의 가격이미지 여부 분석.
 * - userId 의 Gemini 키 사용. 없으면 분석 스킵 (이미지 그대로 발행)
 * - markPriceImagesOnProduct 가 isPriceBanner=NULL 인 것만 분석 → 재발행 시 캐시 활용
 */
async function maybeMarkPriceImagesForRetailPublish(userId: number, productId: number): Promise<void> {
  try {
    const gemini = await prisma.aiApiConfig.findFirst({
      where: { userId, provider: 'GEMINI', isActive: true },
      select: { apiKey: true },
    })
    if (!gemini?.apiKey) {
      // Gemini 키 없으면 분석 스킵 (가격이미지 필터 무력화 — 옛 동작과 동일)
      return
    }
    await markPriceImagesOnProduct(gemini.apiKey, productId)
  } catch (err) {
    // 분석 실패는 발행을 막지 않음 (옛 동작 보존)
    console.error(`[Publish] 가격이미지 마킹 실패 (무시, productId=${productId}):`, (err as Error).message)
  }
}

/**
 * ProductImage 목록에서 isPriceBanner=true 를 제외, 단 결과가 0장이면 원본을 그대로 사용 (최소 1장 보존).
 */
function filterOutPriceBanners<T extends { url: string | null; isPriceBanner?: boolean | null }>(
  images: T[]
): T[] {
  const nonBanners = images.filter((i) => i.isPriceBanner !== true)
  return nonBanners.length > 0 ? nonBanners : images
}

export class PublishService {
  /**
   * 단일 상품을 단일 채널에 발행 (쿼터 에러 시 재시도)
   */
  async publishToChannel(params: PublishToChannelParams, retryCount: number = 0): Promise<PublishToChannelResult> {
    const { userId, productId, channelId, publishBatchId } = params

    // 가격이미지 검출/마킹 (Gemini Vision, isPriceBanner=NULL 인 것만 첫 발행 시 분석)
    await maybeMarkPriceImagesForRetailPublish(userId, productId)

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

      // 다단계 발행: 이 발행 대상의 가격 tier (RETAIL 기본 / WHOLESALE=가족도매방)
      const tier = normalizePriceTier(channel.publishPriceTier)

      // 쇼핑몰 연결은 소매(RETAIL) tier 에만 필수 — 주문 링크 생성용.
      // 도매(WHOLESALE) tier(가족도매방밴드)는 쇼핑몰 없이 도매가만 발행한다.
      if (tier === 'RETAIL') {
        if (!channel.shop || !channel.shop.isActive) {
          return {
            success: false,
            productId,
            channelId,
            error: '소매채널에 쇼핑몰이 연결되어 있지 않습니다. 채널 설정에서 쇼핑몰을 연결해주세요.',
          }
        }
        if (!channel.shop.subdomain) {
          return {
            success: false,
            productId,
            channelId,
            error: '쇼핑몰에 도메인이 설정되어 있지 않습니다. 쇼핑몰 설정에서 도메인을 설정해주세요.',
          }
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
          // 크로스포스트용: 원본 도매글 제목(매칭키) + 도매밴드(name/key).
          // 가공 후 collectedPost 가 삭제되어도 Product.channel(도매 소스)·sourceProductName 으로 폴백.
          sourceProductName: true,
          channel: { select: { name: true, channelKey: true, kind: true } },
          collectedPost: {
            select: {
              title: true,
              channel: { select: { name: true, channelKey: true } },
            },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            select: { url: true, isPriceBanner: true },
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

      // 4. 주문 링크 생성 (소매 tier + 연결된 Shop이 있는 경우) - 경로 기반 URL
      // 도매(WHOLESALE) tier 는 쇼핑몰 링크를 붙이지 않는다.
      let orderLink: string | undefined
      if (tier === 'RETAIL' && channel.shop?.subdomain && channel.shop.isActive) {
        const shopBaseUrl = process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'http://localhost:3000'
        orderLink = `${shopBaseUrl}/${channel.shop.subdomain}/product/${productId}`
      }

      // 5. 게시물 내용 생성 (tier 별 가격/CTA)
      const productForPublish = toProductForPublish(product)
      const postContent = buildPostContent(productForPublish, { orderLink, tier })
      // 발행 시점 가격 스냅샷 (감사·정산 분리용)
      const { snapshot: priceSnapshot, wholesaleFallback } = buildPriceSnapshot(productForPublish, tier)
      if (wholesaleFallback) {
        console.warn(`[PublishService] product ${productId}: WHOLESALE tier 인데 도매가 누락 — 소매가로 폴백 발행 (channel ${channelId})`)
      }

      // 이미지 URL 추출 — 가격이미지 (isPriceBanner=true) 제외, 결과 0장이면 원본 사용
      // 채널 푸터 이미지가 있으면 1자리 예약하여 상품 이미지를 19개로 자르고 푸터를 마지막에 추가.
      // 푸터 없으면 기존대로 최대 20개. 푸터 추가는 상품 이미지가 1장 이상일 때만 (텍스트만 발행 차단 보존).
      const usableImages = filterOutPriceBanners(product.images || [])
      const productImageUrls = usableImages
        .map(img => img.url)
        .filter((url): url is string => !!url && url.length > 0)
        .slice(0, channel.footerImageUrl ? 19 : 20)
      const imageUrls = channel.footerImageUrl && productImageUrls.length > 0
        ? [...productImageUrls, channel.footerImageUrl]
        : productImageUrls

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
            // 크로스포스트 opt-in (CROSSPOST 채널만). 실패 시 위 본문작성으로 자동 폴백.
            // 미설정 채널은 undefined → 기존 동작 100% 동일.
            crossPost: buildCrossPostInfo(channel, product, tier),
          })

          if (playwrightResult.success && playwrightResult.postKey) {
            postKey = playwrightResult.postKey
            publishMethod = 'playwright'
            imageCount = imageUrls.length
            playwrightSuccess = true
            // 발행 성공 — 누적된 일시 실패 카운터 리셋 (옛 hiccup 의 NULL 처리 방지)
            resetSessionFailureCount(channelId)
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
        // 이미지가 없으면 발행 차단 — 옛날엔 Band API 텍스트로 폴백 발행했으나,
        // 그러면 사용자에게는 "이미지 안 붙은 게시글" 사고로 보였음 (자동발행이 4채널 ×
        // 반복 호출까지 결합되면 더 두드러짐). 이미지 누락은 보통 수집 단계에서
        // Band CDN fetch가 거부된 결과이므로, 발행을 막아 상위 워크플로우에 가시화한다.
        const errorMessage = '발행할 이미지가 없습니다 (Product 의 ProductImage 가 0건). 게시물을 다시 수집하거나 수동으로 이미지를 첨부 후 재발행해주세요.'
        console.error(`[PublishService] product ${productId}: ${errorMessage}`)
        return {
          success: false,
          productId,
          channelId,
          error: errorMessage,
        }
      }

      // 7. ChannelProduct 레코드 생성 또는 복원 (soft-deleted 레코드가 있으면 복원, postKey 저장)
      // 다단계 발행: priceTier / publishBatchId / priceSnapshot 스냅샷 동시 저장.
      const channelProduct = await prisma.channelProduct.upsert({
        where: {
          productId_channelId: { productId, channelId },
        },
        update: {
          // soft-deleted 레코드 복원
          deletedAt: null,
          publishedAt: new Date(),
          postKey: postKey || undefined,
          priceTier: tier,
          publishBatchId: publishBatchId || undefined,
          priceSnapshot: priceSnapshot as any,
        },
        create: {
          userId,
          productId,
          channelId,
          publishedAt: new Date(),
          postKey: postKey || undefined,
          priceTier: tier,
          publishBatchId: publishBatchId || undefined,
          priceSnapshot: priceSnapshot as any,
        },
      })

      console.log(
        `[PublishService] Published product ${productId} to channel ${channel.name} (${publishMethod}, tier=${tier}${orderLink ? ', with order link' : ''})`
      )

      return {
        success: true,
        productId,
        channelId,
        publishedProductId: channelProduct.id,
        imageCount,
        publishMethod,
        priceTier: tier,
        wholesaleFallback,
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
    const { userId, productIds, channelId, onProgress, publishBatchId } = params

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

      const result = await this.publishToChannel({ userId, productId, channelId, publishBatchId })
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
    const { userId, productId, channelId, onStageProgress, signal, publishBatchId } = params

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

    // 가격이미지 검출/마킹 (Gemini Vision, isPriceBanner=NULL 인 것만 첫 발행 시 분석)
    await maybeMarkPriceImagesForRetailPublish(userId, productId)

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

      // 다단계 발행: 이 발행 대상의 가격 tier (RETAIL 기본 / WHOLESALE=가족도매방)
      const tier = normalizePriceTier(channel.publishPriceTier)

      // 쇼핑몰 연결은 소매(RETAIL) tier 에만 필수. 도매(WHOLESALE)는 쇼핑몰 없이 발행.
      if (tier === 'RETAIL') {
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
          // 크로스포스트용: 원본 도매글 제목(매칭키) + 도매밴드(name/key).
          // 가공 후 collectedPost 가 삭제되어도 Product.channel(도매 소스)·sourceProductName 으로 폴백.
          sourceProductName: true,
          channel: { select: { name: true, channelKey: true, kind: true } },
          collectedPost: {
            select: {
              title: true,
              channel: { select: { name: true, channelKey: true } },
            },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            select: { url: true, isPriceBanner: true },
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

      // 4. 주문 링크 생성 (소매 tier + 연결된 Shop 있을 때). 도매(WHOLESALE)는 링크 미생성.
      let orderLink: string | undefined
      if (tier === 'RETAIL' && channel.shop?.subdomain && channel.shop.isActive) {
        const shopBaseUrl = process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'http://localhost:3000'
        orderLink = `${shopBaseUrl}/${channel.shop.subdomain}/product/${productId}`
      }

      // 5. 게시물 내용 생성 (tier 별 가격/CTA) + 가격 스냅샷
      const productForPublish = toProductForPublish(product)
      const postContent = buildPostContent(productForPublish, { orderLink, tier })
      const { snapshot: priceSnapshot, wholesaleFallback } = buildPriceSnapshot(productForPublish, tier)
      if (wholesaleFallback) {
        console.warn(`[PublishService] product ${productId}: WHOLESALE tier 인데 도매가 누락 — 소매가로 폴백 발행 (channel ${channelId})`)
      }
      // 가격이미지 (isPriceBanner=true) 제외, 결과 0장이면 원본 사용 (최소 1장 보존)
      // 채널 푸터 이미지가 있으면 1자리 예약 — 상품 이미지 최대 19개 + 푸터 1장 = Band 20개 한도 유지.
      // 상품 이미지가 0건이면 푸터를 붙이지 않음 (텍스트만 발행 차단 보존).
      const usableImagesProgress = filterOutPriceBanners(product.images || [])
      const productImageUrls = usableImagesProgress
        .map(img => img.url)
        .filter((url): url is string => !!url && url.length > 0)
        .slice(0, channel.footerImageUrl ? 19 : 20)
      const imageUrls = channel.footerImageUrl && productImageUrls.length > 0
        ? [...productImageUrls, channel.footerImageUrl]
        : productImageUrls

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
            // 크로스포스트 opt-in (CROSSPOST 채널만). 실패 시 본문작성으로 자동 폴백.
            crossPost: buildCrossPostInfo(channel, product, tier),
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
            // 발행 성공 — 누적된 일시 실패 카운터 리셋 (옛 hiccup 의 NULL 처리 방지)
            resetSessionFailureCount(channelId)
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
        // 이미지 0개면 발행 차단 (publishToChannel 과 동일 정책 — 텍스트만 발행되는 사고 방지)
        const errorMessage = '발행할 이미지가 없습니다 (Product 의 ProductImage 가 0건). 게시물을 다시 수집하거나 수동으로 이미지를 첨부 후 재발행해주세요.'
        console.error(`[PublishService] product ${productId}: ${errorMessage}`)
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
      }

      // 7. ChannelProduct 레코드 생성 또는 복원 (soft-deleted 레코드가 있으면 복원, postKey 저장)
      // 다단계 발행: priceTier / publishBatchId / priceSnapshot 스냅샷 동시 저장.
      const channelProduct = await prisma.channelProduct.upsert({
        where: {
          productId_channelId: { productId, channelId },
        },
        update: {
          // soft-deleted 레코드 복원
          deletedAt: null,
          publishedAt: new Date(),
          postKey: postKey || undefined,
          priceTier: tier,
          publishBatchId: publishBatchId || undefined,
          priceSnapshot: priceSnapshot as any,
        },
        create: {
          userId,
          productId,
          channelId,
          publishedAt: new Date(),
          postKey: postKey || undefined,
          priceTier: tier,
          publishBatchId: publishBatchId || undefined,
          priceSnapshot: priceSnapshot as any,
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
        priceTier: tier,
        wholesaleFallback,
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
