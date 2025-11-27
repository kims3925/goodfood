/**
 * Retail Band Products API
 * 소매밴드별 상품 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma, PublishStatus } from '@bandauto/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bandId = parseInt(params.id)
    const { searchParams } = new URL(req.url)

    // 필터 파라미터
    const minPrice = searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!) : undefined
    const maxPrice = searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : undefined
    const sort = searchParams.get('sort') || 'latest' // latest, price_asc, price_desc, discount
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // 1. 소매밴드 정보 조회
    const retailBand = await prisma.retailBand.findUnique({
      where: { id: bandId },
    })

    if (!retailBand) {
      return NextResponse.json(
        { success: false, error: '소매밴드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 2. 해당 소매밴드에 발행된 상품 조회 (product_publish 테이블 사용)
    const productPublishes = await prisma.productPublish.findMany({
      where: {
        retailBandId: bandId,
        status: PublishStatus.SUCCESS,
      },
      include: {
        product: {
          include: {
            variants: {
              orderBy: { id: 'asc' },
              take: 1,
            },
            post: {
              include: {
                images: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    })

    // 3. 상품 포맷팅
    const allProducts = productPublishes
      .filter((pp) => pp.product)
      .map((pp) => {
        const product = pp.product
        const mainVariant = product.variants[0]
        const images = product.post?.images?.map((img) => img.imageUrl) || []

        const salePrice = mainVariant?.price || product.price || 0
        const originalPrice = mainVariant?.wholesalePrice || product.wholesalePrice || salePrice
        const discount = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0

        return {
          id: product.id.toString(),
          title: product.name,
          description: product.description,
          originalPrice,
          salePrice,
          discount,
          images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
          category: product.categoryId || '',
          rating: 4.5,
          reviews: 100,
          stock: mainVariant?.stock || 100,
          createdAt: product.createdAt,
        }
      })

    // 4. 가격 범위 계산 (필터링 전 전체 상품 기준)
    const allPrices = allProducts.map((p) => p.salePrice).filter(p => p > 0)
    const priceRange = {
      min: allPrices.length > 0 ? Math.min(...allPrices) : 0,
      max: allPrices.length > 0 ? Math.max(...allPrices) : 100000,
    }

    // 5. 가격 필터 적용
    let products = [...allProducts]
    if (minPrice !== undefined) {
      products = products.filter((p) => p.salePrice >= minPrice)
    }
    if (maxPrice !== undefined) {
      products = products.filter((p) => p.salePrice <= maxPrice)
    }

    // 6. 정렬
    switch (sort) {
      case 'price_asc':
        products.sort((a, b) => a.salePrice - b.salePrice)
        break
      case 'price_desc':
        products.sort((a, b) => b.salePrice - a.salePrice)
        break
      case 'discount':
        products.sort((a, b) => b.discount - a.discount)
        break
      case 'latest':
      default:
        products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
    }

    // 7. 페이지네이션
    const total = products.length
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const paginatedProducts = products.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      band: {
        id: retailBand.id,
        name: retailBand.name,
        coverUrl: retailBand.coverUrl,
        formUrl: retailBand.formUrl,
      },
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      priceRange,
    })
  } catch (error: any) {
    console.error('Retail band products GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '상품 조회 실패' },
      { status: 500 }
    )
  }
}
