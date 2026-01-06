export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@modules/common/utils/src/database/client'
import { calculateSellingPrice } from '@/lib/price-calculator'

// 찜한 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const wishlists = await prisma.wishlist.findMany({
      where: {
        userId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            thumbnailUrl: true,
            currency: true,
            shippingFee: true,
            bundleShippingType: true,
            variants: {
              orderBy: { id: 'asc' },
              take: 1,
              select: { price: true },
            },
            images: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
      orderBy: {
        addedAt: 'desc',
      },
    })

    // 응답 형식 변환 (price를 variants에서, thumbnailUrl을 images에서 가져오기)
    // 공통 가격 모듈(calculateSellingPrice)을 사용하여 배송비 타입에 따른 실제 판매가 계산
    const formattedWishlists = wishlists.map((w) => {
      const thumbnailUrl = w.product.thumbnailUrl || w.product.images[0]?.url || null
      const basePrice = w.product.variants[0]?.price || null
      const shippingFee = w.product.shippingFee ?? 0
      const bundleShippingType = w.product.bundleShippingType || null

      // 공통 모듈로 판매가 계산 (배송비 타입에 따라 자동 처리)
      const sellingPrice = basePrice !== null
        ? calculateSellingPrice(basePrice, shippingFee, bundleShippingType)
        : null

      return {
        id: w.id,
        addedAt: w.addedAt,
        product: {
          id: w.product.id,
          name: w.product.name,
          description: w.product.description,
          thumbnailUrl,
          price: sellingPrice,
          currency: w.product.currency,
        },
      }
    })

    return NextResponse.json({
      success: true,
      wishlists: formattedWishlists,
    })
  } catch (error) {
    console.error('Failed to fetch wishlists:', error)
    return NextResponse.json(
      { success: false, error: '찜한 상품을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 찜한 상품 추가
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const { productId } = await request.json()

    console.log('[Wishlist API] Add request:', { productId, userId })

    if (!productId) {
      return NextResponse.json(
        { success: false, error: '상품 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // 상품 존재 여부 확인 (선택적 - 상품이 없어도 찜하기 허용)
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      console.log('[Wishlist API] Product not found in DB, but allowing wishlist:', productId)
      // 상품이 DB에 없어도 찜하기는 허용 (외부 상품일 수 있음)
    }

    // 이미 찜한 상품인지 확인
    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 찜한 상품입니다' },
        { status: 400 }
      )
    }

    const wishlist = await prisma.wishlist.create({
      data: {
        userId,
        productId,
      },
      include: {
        product: true,
      },
    })

    console.log('[Wishlist API] Added successfully:', wishlist.id)

    return NextResponse.json({
      success: true,
      message: '찜한 상품에 추가되었습니다',
      wishlist,
    })
  } catch (error) {
    console.error('[Wishlist API] Failed to add to wishlist:', error)
    // 에러 상세 정보 반환
    const errorMessage = error instanceof Error ? error.message : '찜하기에 실패했습니다'
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
