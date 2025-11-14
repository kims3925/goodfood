import { NextRequest, NextResponse } from 'next/server'
import { getAliExpressAPI } from '@/domain/aliexpress/services/api-client.service'

/**
 * POST /api/ali-sourcing/search
 * 알리익스프레스 상품 검색 API
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { keyword, page = 1, pageSize = 20, minPrice, maxPrice, sort } = body

    // 검색어 검증
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '검색어를 입력해주세요' },
        { status: 400 }
      )
    }

    // 알리익스프레스 API 호출
    const api = getAliExpressAPI()
    const result = await api.searchProducts({
      keyword: keyword.trim(),
      page,
      pageSize,
      minPrice,
      maxPrice,
      sort,
    })

    // 결과 변환 (프론트엔드 형식에 맞게)
    const products = result.products.map((product) => ({
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
    }))

    return NextResponse.json({
      success: true,
      products,
      totalResults: result.totalResults,
      currentPage: result.currentPage,
    })
  } catch (error) {
    console.error('알리익스프레스 검색 오류:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '검색 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}
