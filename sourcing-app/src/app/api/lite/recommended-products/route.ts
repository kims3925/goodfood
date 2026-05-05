/**
 * GET /api/lite/recommended-products
 * Lite Manager — 셀러에게 추천할 상품 풀 (F5)
 *
 * 추천 기준 (Phase 1 minimal):
 *  - active=true, deletedAt=null
 *  - 최근 createdAt desc (신선도)
 *  - 변형/이미지 보유한 상품만 (셀러가 그대로 업로드 가능한 수준)
 *  - default limit=20 (Phase 1 명세)
 *
 * Phase 2 확장 예정:
 *  - 카테고리별 균형
 *  - 마진 우수 상품 가중치
 *  - 시즌 태그 (계절/명절)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const categoryId = searchParams.get('categoryId') // 'SEA' | 'AGR' | 'MEA' | 'MKT' | 'PRC' | 'HLT' | 'ETC'

    const where: any = {
      isActive: true,
      deletedAt: null,
    }
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId
    }

    const products = await prisma.product.findMany({
      where: {
        ...where,
        // 이미지/변형 둘 다 있는 상품만 — 셀러가 업로드 시 깨지지 않도록
        images: { some: {} },
        variants: { some: { deletedAt: null } },
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
        variants: {
          where: { deletedAt: null },
          orderBy: { id: 'asc' },
          take: 3,
          select: { optionSummary: true, price: true, wholesalePrice: true },
        },
        channel: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })

    // 셀러가 이미 자기 shop 에 게재 중인 상품은 제외 — User.shops 의 ShopProduct
    const userShops = await prisma.shop.findMany({
      where: { userId: user.userId, isActive: true },
      select: { id: true },
    })
    const userShopIds = userShops.map((s) => s.id)

    let alreadyListedProductIds = new Set<number>()
    if (userShopIds.length > 0) {
      const existing = await prisma.shopProduct.findMany({
        where: {
          shopId: { in: userShopIds },
          deletedAt: null,
          productId: { in: products.map((p) => p.id) },
        },
        select: { productId: true },
      })
      alreadyListedProductIds = new Set(
        existing.map((e) => e.productId).filter((id): id is number => id !== null)
      )
    }

    const shaped = products.map((p) => {
      const variantPrices = p.variants.map((v) => v.price).filter((x) => x > 0)
      const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : (p.price ?? 0)
      const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : (p.price ?? 0)
      const wholesalePrice = p.variants[0]?.wholesalePrice
        ? Number(p.variants[0].wholesalePrice)
        : (p.wholesalePrice ? Number(p.wholesalePrice) : null)

      // 마진 추정 (셀러 학습용 — 정확한 수수료 등은 Phase 2 D2에서)
      let marginPct: number | null = null
      if (wholesalePrice && wholesalePrice > 0 && minPrice > 0) {
        marginPct = Math.round(((minPrice - wholesalePrice) / minPrice) * 100)
      }

      return {
        id: p.id,
        name: p.name,
        description: p.description?.slice(0, 200) || null,
        categoryId: p.categoryId,
        thumbnailUrl: p.images[0]?.url || null,
        price: p.price,
        priceRange: minPrice === maxPrice ? minPrice : { min: minPrice, max: maxPrice },
        wholesalePrice,
        marginPct,
        channel: p.channel ? { id: p.channel.id, name: p.channel.name } : null,
        alreadyListed: alreadyListedProductIds.has(p.id),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        products: shaped,
        total: shaped.length,
        recommendedSelection: { min: 5, max: 10 },
      },
    })
  } catch (error: any) {
    console.error('[Lite Recommended] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
