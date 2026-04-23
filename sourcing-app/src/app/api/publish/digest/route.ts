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

    let status: 'SUCCESS' | 'FAILED' = 'FAILED'
    let postKey: string | undefined
    let message: string | undefined

    try {
      const r = await bandPlaywrightService.publishWithImages({
        channelId: channel.id,
        bandKey: channel.channelKey,
        bandName: channel.name,
        content: digest.content,
        imageUrls: digest.imageUrls,
      })
      status = r.success ? 'SUCCESS' : 'FAILED'
      postKey = r.postKey
      message = r.error
    } catch (err: any) {
      status = 'FAILED'
      message = err?.message || '발행 중 오류'
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
