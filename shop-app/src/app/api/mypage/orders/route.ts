/**
 * MyPage Orders API
 * 마이페이지 주문 내역 조회 (회원 주문만)
 * 비회원 주문은 주문번호로 별도 조회 (/api/guest-orders/lookup)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'

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

    // Shop ID 확인 (middleware에서 설정)
    const shopIdHeader = request.headers.get('x-shop-id')
    const shopId = shopIdHeader ? parseInt(shopIdHeader) : null

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // 회원 주문만 조회
    const where: any = {
      userId,
    }

    if (shopId) {
      where.shopId = shopId
    }

    if (status) {
      where.status = status
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              publishedProduct: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      thumbnailUrl: true,
                    },
                  },
                },
              },
              variant: {
                select: {
                  id: true,
                  optionSummary: true,
                },
              },
              review: {
                select: {
                  id: true,
                },
              },
            },
          },
          payment: {
            select: {
              id: true,
              status: true,
              method: true,
              approvedAt: true,
            },
          },
        },
        orderBy: {
          orderedAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    // 응답 형식으로 변환
    const formattedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      subtotalAmount: Number(order.subtotalAmount),
      shippingFee: Number(order.shippingFee),
      discountAmount: Number(order.discountAmount),
      orderedAt: order.orderedAt.toISOString(),
      paidAt: order.paidAt?.toISOString() || null,
      shippedAt: order.shippedAt?.toISOString() || null,
      deliveredAt: order.deliveredAt?.toISOString() || null,
      isGuestOrder: false,
      items: order.items.map(item => ({
        id: item.id,
        productName: item.productName,
        optionSummary: item.optionSummary,
        thumbnailUrl: item.thumbnailUrl || item.publishedProduct?.product?.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        hasReview: !!item.review,
        product: item.publishedProduct?.product ? {
          id: item.publishedProduct.product.id,
          name: item.publishedProduct.product.name,
          thumbnailUrl: item.publishedProduct.product.thumbnailUrl,
        } : null,
      })),
      hasWritableReview: order.status === 'DELIVERED' && order.items.some(item => !item.review),
      payment: order.payment ? {
        status: order.payment.status,
        method: order.payment.method,
        approvedAt: order.payment.approvedAt?.toISOString() || null,
      } : null,
    }))

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    return NextResponse.json(
      { success: false, error: '주문 내역을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
