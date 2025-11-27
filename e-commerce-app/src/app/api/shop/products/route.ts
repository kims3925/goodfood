/**
 * Shop Products API
 * 쇼핑몰 상품 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma, PublishStatus } from '@bandauto/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const filter = searchParams.get('filter')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')
    const bandId = searchParams.get('bandId')

    // 기본 조건: 발행된 상품만 (product_publish 테이블을 통해)
    const where: any = {
      productPublishes: {
        some: {
          status: PublishStatus.SUCCESS,
          ...(bandId ? { retailBandId: parseInt(bandId) } : {}),
        },
      },
    }

    // 카테고리 필터
    if (category && category !== '더보기') {
      where.categoryId = category
    }

    // 검색어 필터
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    // 정렬 조건: createdAt 기준 최신순, 동일하면 updatedAt 기준 최신순
    let orderBy: any = [
      { createdAt: 'desc' },
      { updatedAt: 'desc' }
    ]

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
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
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.product.count({ where }),
    ])

    // 프론트엔드 형식으로 변환
    const formattedProducts = products.map((product) => {
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
        isTimeSale: filter === 'sale' || discount >= 30,
        isBest: filter === 'best',
        isNew: filter === 'new',
      }
    })

    return NextResponse.json({
      success: true,
      products: formattedProducts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error: any) {
    console.error('Shop products GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '상품 목록 조회 실패' },
      { status: 500 }
    )
  }
}
