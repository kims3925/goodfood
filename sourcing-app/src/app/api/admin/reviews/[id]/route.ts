export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const reviewId = parseInt(id)

    if (isNaN(reviewId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 리뷰 ID입니다' },
        { status: 400 }
      )
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        orderItem: {
          select: {
            id: true,
            productName: true,
            optionSummary: true,
            thumbnailUrl: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
                deliveredAt: true,
                shop: {
                  select: {
                    id: true,
                    name: true,
                    subdomain: true,
                  }
                }
              }
            },
            publishedProduct: {
              select: {
                id: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    thumbnailUrl: true,
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!review) {
      return NextResponse.json(
        { success: false, error: '리뷰를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 응답 형식 변환
    const formattedReview = {
      id: review.id,
      rating: review.rating,
      title: review.title,
      content: review.content,
      images: review.images ? JSON.parse(review.images) : null,
      isVisible: review.isVisible,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      user: review.user,
      orderItem: review.orderItem ? {
        id: review.orderItem.id,
        productName: review.orderItem.productName,
        optionSummary: review.orderItem.optionSummary,
        thumbnailUrl: review.orderItem.thumbnailUrl,
        quantity: review.orderItem.quantity,
        unitPrice: Number(review.orderItem.unitPrice),
        totalPrice: Number(review.orderItem.totalPrice),
        order: review.orderItem.order ? {
          id: review.orderItem.order.id,
          orderNumber: review.orderItem.order.orderNumber,
          status: review.orderItem.order.status,
          createdAt: review.orderItem.order.createdAt.toISOString(),
          deliveredAt: review.orderItem.order.deliveredAt?.toISOString() || null,
          shop: review.orderItem.order.shop
        } : null,
        publishedProduct: review.orderItem.publishedProduct
      } : null
    }

    return NextResponse.json({
      success: true,
      data: formattedReview
    })
  } catch (error) {
    console.error('Failed to fetch review:', error)
    return NextResponse.json(
      { success: false, error: '리뷰를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
