export const dynamic = 'force-dynamic'

/**
 * Popular Products API
 * 주문량 기준 인기상품 조회
 * - OrderItem 테이블에서 shopProductId별 주문 수량 집계
 * - 주문량 많은 순으로 정렬하여 반환
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { calculateSellingPrice } from '@/lib/price-calculator'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    // Shop ID 확인 (middleware에서 설정)
    const shopIdHeader = req.headers.get('x-shop-id')
    const currentShopId = shopIdHeader ? parseInt(shopIdHeader) : null

    if (!currentShopId) {
      return NextResponse.json({
        success: true,
        products: [],
        message: 'Shop ID가 필요합니다.',
      })
    }

    // Shop 정보 조회
    const shop = await prisma.shop.findUnique({
      where: { id: currentShopId },
    })

    if (!shop || !shop.isActive) {
      return NextResponse.json({
        success: true,
        products: [],
        shop: null,
      })
    }

    // 1. 해당 Shop의 주문에서 상품별 주문 수량 집계
    // OrderItem -> Order(shopId) -> shopProductId 기준 그룹핑
    const orderStats = await prisma.orderItem.groupBy({
      by: ['shopProductId'],
      where: {
        order: {
          shopId: currentShopId,
          status: {
            notIn: ['CANCELLED', 'REFUNDED'],
          },
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    })

    // 주문이 있는 shopProductId 목록
    const shopProductIds = orderStats.map((stat) => stat.shopProductId)

    if (shopProductIds.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        shop: {
          id: shop.id,
          name: shop.name,
        },
        message: '아직 주문된 상품이 없습니다.',
      })
    }

    // 2. 해당 상품들의 상세 정보 조회
    const shopProducts = await prisma.shopProduct.findMany({
      where: {
        id: { in: shopProductIds },
        shopId: currentShopId,
      },
      include: {
        product: {
          include: {
            variants: {
              orderBy: { id: 'asc' },
              take: 1,
            },
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    })

    // 3. 주문량 순서대로 정렬 및 순위 부여
    const orderStatsMap = new Map(
      orderStats.map((stat, index) => [
        stat.shopProductId,
        { totalQuantity: stat._sum.quantity || 0, rank: index + 1 },
      ])
    )

    const products = shopProductIds
      .map((shopProductId) => {
        const sp = shopProducts.find((p) => p.id === shopProductId)
        if (!sp || !sp.product) return null

        const product = sp.product
        const mainVariant = product.variants[0]
        const images = product.images?.map((img) => img.url) || []
        const stats = orderStatsMap.get(shopProductId)

        // 공통 모듈로 판매가 계산
        const basePrice = mainVariant?.price || 0
        const shippingFee = product.shippingFee || 0
        const bundleShippingType = product.bundleShippingType || null
        const salePrice = calculateSellingPrice(basePrice, shippingFee, bundleShippingType)
        const originalPrice = salePrice
        const discount = 0

        return {
          id: product.id,
          shopProductId: sp.id,
          title: product.name,
          description: product.description,
          originalPrice,
          salePrice,
          discount,
          images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
          category: product.categoryId || '',
          // 인기상품 전용 필드
          rank: stats?.rank || 0,
          totalOrdered: stats?.totalQuantity || 0,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      success: true,
      products,
      shop: {
        id: shop.id,
        name: shop.name,
      },
      totalCount: products.length,
    })
  } catch (error: any) {
    console.error('Popular products GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '인기상품 조회 실패' },
      { status: 500 }
    )
  }
}
