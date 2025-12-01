import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus } from '@bandauto/db'

/**
 * GET /api/order/band/products
 * 소매밴드에 발행된 상품 목록 조회
 *
 * Query Parameters:
 * - retailBandId: number (필수)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const retailBandId = searchParams.get('retailBandId')

    if (!retailBandId) {
      return NextResponse.json(
        { success: false, error: 'retailBandId가 필요합니다.' },
        { status: 400 }
      )
    }

    const publishedProducts = await prisma.productPublish.findMany({
      where: {
        retailBandId: parseInt(retailBandId),
        status: PublishStatus.SUCCESS,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 응답 형식 변환
    const products = publishedProducts.map((pp) => ({
      id: pp.id,
      productId: pp.product.id,
      name: pp.product.name,
      price: pp.product.price,
      thumbnailUrl: pp.product.thumbnailUrl,
      status: pp.status,
    }))

    return NextResponse.json({
      success: true,
      data: products,
    })
  } catch (error) {
    console.error('[Band Order] 상품 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
