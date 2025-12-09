import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shopId')
    const rating = searchParams.get('rating')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // 기본 where 조건 구성
    const where: any = {}

    // 평점 필터
    if (rating) {
      where.rating = parseInt(rating)
    }

    // 날짜 범위 필터
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // 검색어 필터 (리뷰 내용, 제목)
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ]
    }

    // 쇼핑몰 필터 (orderItem -> order -> shopId)
    if (shopId) {
      where.orderItem = {
        order: {
          shopId: parseInt(shopId)
        }
      }
    }

    // 리뷰 목록 조회
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          orderItem: {
            select: {
              id: true,
              productName: true,
              optionSummary: true,
              thumbnailUrl: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  shop: {
                    select: {
                      id: true,
                      name: true,
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit,
      }),
      prisma.review.count({ where })
    ])

    // 이번 달 리뷰 수 계산
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthlyReviewsCount = await prisma.review.count({
      where: {
        createdAt: {
          gte: startOfMonth
        }
      }
    })

    // 전체 리뷰 통계
    const totalReviews = await prisma.review.count()

    // 평균 평점 계산
    const avgResult = await prisma.review.aggregate({
      _avg: {
        rating: true
      }
    })

    // 쇼핑몰 목록 조회 (필터용)
    const shops = await prisma.shop.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc'
      }
    })

    // 응답 형식 변환
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      content: review.content,
      images: review.images ? JSON.parse(review.images) : null,
      isVisible: review.isVisible,
      createdAt: review.createdAt.toISOString(),
      user: review.user,
      orderItem: review.orderItem ? {
        id: review.orderItem.id,
        productName: review.orderItem.productName,
        optionSummary: review.orderItem.optionSummary,
        thumbnailUrl: review.orderItem.thumbnailUrl,
        order: review.orderItem.order ? {
          id: review.orderItem.order.id,
          orderNumber: review.orderItem.order.orderNumber,
          shop: review.orderItem.order.shop
        } : null
      } : null
    }))

    return NextResponse.json({
      success: true,
      data: {
        reviews: formattedReviews,
        shops,
        stats: {
          totalReviews,
          averageRating: avgResult._avg.rating ? Number(avgResult._avg.rating.toFixed(1)) : 0,
          monthlyReviews: monthlyReviewsCount,
          filteredCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      }
    })
  } catch (error) {
    console.error('Failed to fetch reviews:', error)
    return NextResponse.json(
      { success: false, error: '리뷰 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
