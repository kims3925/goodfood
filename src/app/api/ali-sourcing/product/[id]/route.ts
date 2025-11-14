import { NextRequest, NextResponse } from 'next/server'
import { getAliExpressAPI } from '@/domain/aliexpress/services/api-client.service'

/**
 * GET /api/ali-sourcing/product/[id]
 * 알리익스프레스 상품 상세 조회 API
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: '상품 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // 알리익스프레스 API 호출
    const api = getAliExpressAPI()
    const product = await api.getProductDetail(id)

    if (!product) {
      return NextResponse.json(
        { error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      product: {
        id: product.productId,
        title: product.productTitle,
        price: product.salePrice,
        imageUrl: product.productImage,
        productUrl: product.productUrl,
        rating: product.rating,
        orders: product.totalOrders,
        shippingPrice: product.shippingPrice,
        originalPrice: product.originalPrice,
        discount: product.discount,
      },
    })
  } catch (error) {
    console.error('상품 상세 조회 오류:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '상품 조회 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}
