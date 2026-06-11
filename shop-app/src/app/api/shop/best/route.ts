/**
 * GET /api/shop/best — 판매데이터 기반 베스트 상품 (STEP 5-2, 공개)
 *
 * 쿼리: window=7|30 (기본 7), category(코드), limit(기본 10, 최대 50)
 * 해당 Shop(x-shop-id)에 발행된 활성 상품 중 판매량 상위를 반환.
 * 데이터 원천: ProductSalesDaily (일배치). 판매 데이터가 없으면 빈 배열.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { calculateSellingPrice } from '@/lib/price-calculator'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const windowDays = searchParams.get('window') === '30' ? 30 : 7
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const category = searchParams.get('category')

    const shopIdHeader = req.headers.get('x-shop-id')
    const shopId = shopIdHeader ? parseInt(shopIdHeader) : null

    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    const ranked = await prisma.productSalesDaily.groupBy({
      by: ['productId'],
      where: { date: { gte: since } },
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 200,
    })
    if (ranked.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const where: any = {
      id: { in: ranked.map((r) => r.productId) },
      deletedAt: null,
      isActive: true,
      shopProducts: { some: { deletedAt: null, ...(shopId ? { shopId } : {}) } },
    }
    if (category) {
      where.OR = [{ categoryId: category }, { categoryId: { startsWith: `${category}_` } }]
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        thumbnailUrl: true,
        categoryId: true,
        shippingFee: true,
        bundleShippingType: true,
        variants: { where: { deletedAt: null }, orderBy: { id: 'asc' }, take: 1, select: { price: true } },
      },
    })
    const productById = new Map(products.map((p) => [p.id, p]))
    const qtyById = new Map(ranked.map((r) => [r.productId, r._sum.qty ?? 0]))

    const data = ranked
      .filter((r) => productById.has(r.productId))
      .slice(0, limit)
      .map((r) => {
        const p = productById.get(r.productId)!
        const basePrice = p.variants[0]?.price ?? 0
        return {
          id: p.id,
          name: p.name,
          thumbnailUrl: p.thumbnailUrl,
          categoryId: p.categoryId,
          price: calculateSellingPrice(basePrice, p.shippingFee ?? 0, p.bundleShippingType),
          salesQty: qtyById.get(p.id) ?? 0,
          windowDays,
        }
      })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[Shop Best]', error)
    return NextResponse.json({ success: false, error: '베스트 상품 조회 실패' }, { status: 500 })
  }
}
