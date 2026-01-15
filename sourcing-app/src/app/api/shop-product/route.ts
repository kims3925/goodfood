export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { Prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/shop-product
 *
 * ShopProduct 목록 조회 (외부 주문 상품 선택용)
 *
 * Query Parameters:
 * - shopId?: number - 쇼핑몰 ID 필터
 * - search?: string - 상품명 검색
 * - page?: number - 페이지 (기본값: 1)
 * - limit?: number - 페이지당 개수 (기본값: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const shopIdParam = searchParams.get('shopId')
    const search = searchParams.get('search')
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')

    // shopId 검증: 있으면 유효한 양의 정수여야 함 (숫자만 허용, "1abc" 같은 입력 거부)
    let validatedShopId: number | null = null
    if (shopIdParam) {
      // 숫자로만 구성되었는지 먼저 검증
      if (!/^\d+$/.test(shopIdParam)) {
        return NextResponse.json(
          { success: false, error: 'shopId는 유효한 양의 정수여야 합니다.' },
          { status: 400 }
        )
      }
      const parsed = Number(shopIdParam)
      if (parsed <= 0) {
        return NextResponse.json(
          { success: false, error: 'shopId는 유효한 양의 정수여야 합니다.' },
          { status: 400 }
        )
      }
      validatedShopId = parsed
    }

    // page 검증: 기본값 1, 최소값 1
    let page = parseInt(pageParam || '1', 10)
    if (isNaN(page) || page < 1) {
      page = 1
    }

    // limit 검증: 기본값 20, 범위 1~100
    const MAX_LIMIT = 100
    const DEFAULT_LIMIT = 20
    let limit = parseInt(limitParam || String(DEFAULT_LIMIT), 10)
    if (isNaN(limit) || limit < 1) {
      limit = DEFAULT_LIMIT
    } else if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT
    }

    // 조회 조건 구성
    const where: Prisma.ShopProductWhereInput = {
      userId: user.userId,
      deletedAt: null, // Soft Delete 제외
      publishedAt: { not: null }, // 발행된 상품만
      ...(validatedShopId && { shopId: validatedShopId }),
      // Product 필터: optional relation이므로 'is' wrapper 사용
      product: {
        is: {
          isActive: true,
          deletedAt: null,
          ...(search && { name: { contains: search } }),
        },
      },
    }

    // 전체 개수 조회
    const total = await prisma.shopProduct.count({ where })

    // 상품 목록 조회
    const shopProducts = await prisma.shopProduct.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
            price: true,
            shippingFee: true,
            bundleShippingType: true,
            variants: {
              where: {
                deletedAt: null,
              },
              select: {
                id: true,
                optionSummary: true,
                price: true,
              },
              orderBy: { id: 'asc' },
            },
          },
        },
        shop: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: shopProducts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('ShopProduct 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: 'ShopProduct 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

