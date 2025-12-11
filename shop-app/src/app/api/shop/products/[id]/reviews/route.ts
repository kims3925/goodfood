import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

// 상품별 리뷰 목록 조회 (공개 API - 로그인 불필요)
// [id]는 publishedProductId를 의미함 (OrderItem.publishedProductId를 통해 조회)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const publishedProductId = parseInt(id)

    if (isNaN(publishedProductId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 상품 ID입니다' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'recent' // recent, rating_high, rating_low
    const offset = (page - 1) * limit

    // 정렬 옵션 설정
    let orderBy: any = { createdAt: 'desc' }
    if (sortBy === 'rating_high') {
      orderBy = { rating: 'desc' }
    } else if (sortBy === 'rating_low') {
      orderBy = { rating: 'asc' }
    }

    // 리뷰 목록 조회 (orderItem.publishedProductId를 통해 조회)
    const [reviews, total, ratingStats] = await Promise.all([
      prisma.review.findMany({
        where: {
          orderItem: {
            publishedProductId,
          },
          isVisible: true,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          orderItem: {
            select: {
              productName: true,
              optionSummary: true,
            },
          },
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.review.count({
        where: {
          orderItem: {
            publishedProductId,
          },
          isVisible: true,
        },
      }),
      // 별점 통계 조회
      prisma.review.groupBy({
        by: ['rating'],
        where: {
          orderItem: {
            publishedProductId,
          },
          isVisible: true,
        },
        _count: {
          rating: true,
        },
      }),
    ])

    // 평균 별점 계산
    const avgRating = await prisma.review.aggregate({
      where: {
        orderItem: {
          publishedProductId,
        },
        isVisible: true,
      },
      _avg: {
        rating: true,
      },
    })

    // 별점별 개수 정리 (1~5점)
    const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    ratingStats.forEach(stat => {
      ratingCounts[stat.rating] = stat._count.rating
    })

    // 응답 형식 변환
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      content: review.content,
      images: review.images ? JSON.parse(review.images) : null,
      createdAt: review.createdAt.toISOString(),
      user: {
        id: review.user.id,
        name: maskUserName(review.user.name || '익명'),
      },
      optionSummary: review.orderItem?.optionSummary || null,
    }))

    return NextResponse.json({
      success: true,
      reviews: formattedReviews,
      stats: {
        totalCount: total,
        averageRating: avgRating._avg.rating ? Number(avgRating._avg.rating.toFixed(1)) : 0,
        ratingCounts,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch product reviews:', error)
    return NextResponse.json(
      { success: false, error: '리뷰를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 사용자 이름 마스킹 (예: 홍길동 -> 홍*동)
function maskUserName(name: string): string {
  if (!name || name.length <= 1) return name || '익명'
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}
