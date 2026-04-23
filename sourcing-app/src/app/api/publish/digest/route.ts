/**
 * 종합 발행 API (Digest Publish)
 *
 * GET  /api/publish/digest?categoryId=SEA          — 카테고리별 발행 후보 상품 조회
 * POST /api/publish/digest                          — 선택한 상품들을 하나의 종합 게시글로 발행
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { bandPlaywrightService } from '@/modules/band-playwright/band-playwright.service'
import { buildDigest, type DigestProduct } from '@/modules/publish/digest-builder.service'
import {
  renderDigestCards,
  cleanupDigestCards,
  type DigestCardProduct,
} from '@/modules/publish/digest-card-renderer'
import { shiftDeadlineEarlier } from '@/modules/publish/deadline-utils'
import { CATEGORY_MAP, CATEGORY_CODES, CATEGORY_LIST, type CategoryCode } from '@/modules/category/category.keywords'

export const dynamic = 'force-dynamic'

// ───────────────────────────────────────────────────────────
// GET — 카테고리별 발행 후보 상품 조회
// ───────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoryParam = searchParams.get('categoryId') // all | SEA | AGR | ...
    const daysWithin = searchParams.get('daysWithin')

    const where: any = {
      userId: user.userId,
      deletedAt: null,
      isActive: true,
    }

    if (categoryParam && categoryParam !== 'all') {
      if (!(CATEGORY_CODES as readonly string[]).includes(categoryParam)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 카테고리 코드입니다.' },
          { status: 400 }
        )
      }
      where.categoryId = categoryParam
    }

    if (daysWithin) {
      const days = parseInt(daysWithin)
      if (!isNaN(days) && days > 0) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        cutoff.setHours(0, 0, 0, 0)
        where.createdAt = { gte: cutoff }
      }
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { where: { deletedAt: null }, orderBy: { id: 'asc' } },
        channel: {
          select: { id: true, name: true, platform: true, kind: true, orderDeadline: true },
        },
        shopProducts: {
          where: { deletedAt: null },
          include: { shop: { select: { id: true, subdomain: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    // 카테고리별 분포 집계
    const categoryCounts: Record<string, number> = {}
    const allUserProducts = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { userId: user.userId, deletedAt: null, isActive: true },
      _count: { _all: true },
    })
    for (const row of allUserProducts) {
      const key = row.categoryId || 'ETC'
      categoryCounts[key] = (categoryCounts[key] || 0) + row._count._all
    }

    const categories = CATEGORY_LIST.map((cat) => ({
      code: cat.code,
      name: cat.name,
      emoji: cat.emoji,
      label: cat.label,
      count: categoryCounts[cat.code] || 0,
    }))

    const shaped = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      thumbnailUrl: p.thumbnailUrl,
      price: p.price,
      createdAt: p.createdAt,
      lastDigestPublishedAt: p.lastDigestPublishedAt,
      channel: p.channel
        ? {
            id: p.channel.id,
            name: p.channel.name,
            platform: p.channel.platform,
            kind: p.channel.kind,
            orderDeadline: p.channel.orderDeadline || null,
          }
        : null,
      variants: p.variants.map((v) => ({
        id: v.id,
        optionSummary: v.optionSummary,
        price: v.price,
      })),
      images: p.images.map((img) => ({ url: img.url, sortOrder: img.sortOrder })),
      shopProducts: p.shopProducts.map((sp) => ({
        id: sp.id,
        shopId: sp.shopId,
        shopName: sp.shop?.name,
        shopSubdomain: sp.shop?.subdomain,
      })),
    }))

    return NextResponse.json({
      success: true,
      data: { categories, products: shaped },
    })
  } catch (error: any) {
    console.error('[digest GET] 오류:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// ───────────────────────────────────────────────────────────
// POST — 종합 발행 실행
// ───────────────────────────────────────────────────────────
interface DigestPublishRequest {
  categoryId: CategoryCode
  productIds: number[]       // 사용자가 선택한 순서 유지
  channelId: number          // 단일 채널에 발행 (클라이언트가 채널별로 순차 호출)
  headerText?: string
  footerText?: string
  maxImagesPerProduct?: number
  date?: string              // ISO 날짜. 없으면 오늘
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = (await request.json()) as DigestPublishRequest
    const { categoryId, productIds, channelId, headerText, footerText, maxImagesPerProduct, date } = body

    if (!categoryId || !(CATEGORY_CODES as readonly string[]).includes(categoryId)) {
      return NextResponse.json({ success: false, error: '유효한 categoryId가 필요합니다.' }, { status: 400 })
    }
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ success: false, error: '발행할 상품을 선택하세요.' }, { status: 400 })
    }
    if (!channelId || typeof channelId !== 'number') {
      return NextResponse.json({ success: false, error: '발행할 소매밴드(channelId)를 지정하세요.' }, { status: 400 })
    }

    // 상품 조회 (선택 순서 유지)
    const fetched = await prisma.product.findMany({
      where: { id: { in: productIds }, userId: user.userId, deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { where: { deletedAt: null } },
        channel: { select: { orderDeadline: true } },
        shopProducts: {
          where: { deletedAt: null },
          include: { shop: { select: { id: true, subdomain: true } } },
        },
      },
    })
    const productMap = new Map(fetched.map((p) => [p.id, p]))
    const orderedProducts = productIds.map((id) => productMap.get(id)).filter(Boolean) as typeof fetched

    const shopDomain = process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'shop.abcpharm.net'
    const digestProducts: DigestProduct[] = orderedProducts.map((p) => {
      const firstShopProduct = p.shopProducts[0]
      const subdomain = firstShopProduct?.shop?.subdomain
      const shopProductUrl = subdomain
        ? `https://${shopDomain}/${subdomain}/product/${p.id}`
        : undefined
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        variants: p.variants.map((v) => ({ optionSummary: v.optionSummary || '', price: v.price })),
        images: p.images.map((img) => ({ url: img.url, sortOrder: img.sortOrder })),
        shopProductUrl,
        deadline: p.channel?.orderDeadline || undefined,
      }
    })

    const digest = buildDigest({
      category: categoryId,
      products: digestProducts,
      date: date ? new Date(date) : undefined,
      headerText,
      footerText,
      maxImagesPerProduct: typeof maxImagesPerProduct === 'number' ? maxImagesPerProduct : 1,
    })

    // 채널 조회 (단일)
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId: user.userId,
        kind: ChannelKind.RETAIL,
        isActive: true,
      },
      select: { id: true, name: true, channelKey: true },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없거나 발행 권한이 없습니다.' },
        { status: 404 }
      )
    }

    if (!channel.channelKey) {
      return NextResponse.json(
        { success: false, error: '채널에 bandKey(channelKey)가 없습니다.' },
        { status: 400 }
      )
    }

    // ── 상품별 "사진(최대 4장 2×2 그리드) + 번호/제목/가격/마감/주문링크" 카드를
    //    PNG 1장으로 렌더링하고, Band에 20장까지 첨부. 본문 텍스트는 카드 밑에 첨부.
    const cardProducts: DigestCardProduct[] = orderedProducts.slice(0, 20).map((p) => {
      const firstShop = p.shopProducts[0]
      const orderUrl = firstShop?.shop?.subdomain
        ? `https://${shopDomain}/${firstShop.shop.subdomain}/product/${p.id}`
        : undefined
      const variantPrices = p.variants.map((v) => v.price).filter((x) => x > 0)
      let priceText: string | undefined
      if (variantPrices.length > 1) {
        const min = Math.min(...variantPrices)
        const max = Math.max(...variantPrices)
        priceText = min === max ? `${min.toLocaleString()}원` : `${min.toLocaleString()}원 ~ ${max.toLocaleString()}원`
      } else if (p.price) {
        priceText = `${p.price.toLocaleString()}원`
      }
      // 도매방 마감시간의 30분 전을 쇼핑몰 주문 마감으로 표시
      const displayDeadline = shiftDeadlineEarlier(p.channel?.orderDeadline, 30)
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        priceText,
        deadline: displayDeadline,
        orderUrl,
        imageUrls: p.images
          .slice(0, 4)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((i) => i.url),
      }
    })

    let status: 'SUCCESS' | 'FAILED' = 'FAILED'
    let postKey: string | undefined
    let message: string | undefined
    const renderedCards = await renderDigestCards({ products: cardProducts }).catch((err) => {
      message = `카드 이미지 렌더링 실패: ${err?.message || err}`
      return []
    })

    if (renderedCards.length === 0 && !message) {
      message = '카드 이미지 0장 생성됨'
    }

    // 클립보드 paste 방식으로 이미지-텍스트 교차 삽입
    // blocks: [헤더] + [카드이미지 + 상품 URL 한 줄] × N + [푸터]
    const topHeader = [
      digest.title,
      (headerText || '').trim(),
      `총 ${digest.productCount}개 상품 | 신선 직송`,
      '━━━━━━━━━━━━━━━━━━━━',
    ].filter(Boolean).join('\n')

    const footer = '━━━━━━━━━━━━━━━━━━━━\n' +
      ((footerText || '').trim() ||
        '📦 배송: 마감 전 주문시 당일 출고, 마감 이후 익일 출고\n💳 결제: 카드결제 / 무통장입금')

    const blocks: Array<{ type: 'text'; content: string } | { type: 'image'; filePath: string }> = []
    blocks.push({ type: 'text', content: topHeader })

    renderedCards.forEach((card, i) => {
      const cp = cardProducts.find((c) => c.id === card.productId) || cardProducts[i]
      blocks.push({ type: 'image', filePath: card.filePath })
      // 이미지 바로 아래에 번호 + 상품명 + URL 한 줄 → Band 자동 하이퍼링크 + 프리뷰
      const lineParts: string[] = []
      lineParts.push(`${i + 1}. ${cp?.name || ''}`)
      if (cp?.orderUrl) lineParts.push(`🛒 ${cp.orderUrl}`)
      blocks.push({ type: 'text', content: lineParts.join('\n') })
    })

    blocks.push({ type: 'text', content: footer })

    try {
      if (renderedCards.length > 0) {
        const r = await bandPlaywrightService.publishInterleaved({
          channelId: channel.id,
          bandKey: channel.channelKey,
          bandName: channel.name,
          blocks,
        })
        status = r.success ? 'SUCCESS' : 'FAILED'
        postKey = r.postKey
        message = r.error || message
      }
    } catch (err: any) {
      status = 'FAILED'
      message = err?.message || '발행 중 오류'
    } finally {
      cleanupDigestCards(renderedCards)
    }

    // 발행 성공 시 선택된 상품들에 lastDigestPublishedAt 기록
    if (status === 'SUCCESS') {
      await prisma.product.updateMany({
        where: { id: { in: productIds }, userId: user.userId },
        data: { lastDigestPublishedAt: new Date() },
      })
    }

    return NextResponse.json({
      success: status === 'SUCCESS',
      digest: {
        title: digest.title,
        productCount: digest.productCount,
        imageCount: digest.imageUrls.length,
        truncated: digest.truncated,
      },
      result: {
        channelId: channel.id,
        channelName: channel.name,
        status,
        postKey,
        message,
      },
      categoryMeta: {
        code: categoryId,
        ...CATEGORY_MAP[categoryId],
      },
    })
  } catch (error: any) {
    console.error('[digest POST] 오류:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '발행 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
