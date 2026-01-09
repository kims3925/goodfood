export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
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
    const shopId = searchParams.get('shopId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // 조회 조건 구성
    const where: any = {
      userId: user.userId,
      deletedAt: null, // Soft Delete 제외
      publishedAt: { not: null }, // 발행된 상품만
    }

    if (shopId) {
      where.shopId = parseInt(shopId)
    }

    if (search) {
      where.product = {
        name: { contains: search },
      }
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
            variants: {
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

/**
 * PATCH /api/shop-product
 *
 * ShopProduct 활성화 상태 토글
 *
 * Body:
 * - id: number - ShopProduct ID
 * - isActive: boolean - 활성화 상태
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, isActive } = body

    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'id와 isActive는 필수 값입니다.' },
        { status: 400 }
      )
    }

    // 해당 ShopProduct가 현재 사용자 소유인지 확인
    const shopProduct = await prisma.shopProduct.findFirst({
      where: {
        id: id,
        userId: user.userId,
        deletedAt: null,
      },
    })

    if (!shopProduct) {
      return NextResponse.json(
        { success: false, error: 'ShopProduct를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 활성화 상태 업데이트
    const updated = await prisma.shopProduct.update({
      where: { id },
      data: { isActive },
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: isActive ? '상품이 활성화되었습니다.' : '상품이 비활성화되었습니다.',
    })
  } catch (error) {
    console.error('ShopProduct 상태 업데이트 실패:', error)
    return NextResponse.json(
      { success: false, error: 'ShopProduct 상태 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}
