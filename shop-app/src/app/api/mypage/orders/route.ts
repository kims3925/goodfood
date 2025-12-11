/**
 * MyPage Orders API
 * 마이페이지 주문 내역 조회 (회원 주문 + 비회원 주문 통합)
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

    // 현재 사용자 정보 조회 (이메일, 전화번호로 비회원 주문 매칭)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // Shop ID 확인 (middleware에서 설정)
    const shopIdHeader = request.headers.get('x-shop-id')
    const shopId = shopIdHeader ? parseInt(shopIdHeader) : null

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // 1. 회원 주문 조회
    const memberOrderWhere: any = {
      userId,
    }

    if (shopId) {
      memberOrderWhere.shopId = shopId
    }

    if (status) {
      memberOrderWhere.status = status
    }

    const memberOrders = await prisma.order.findMany({
      where: memberOrderWhere,
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
    })

    // 2. 비회원 주문 조회 (이메일 또는 전화번호 매칭)
    const guestOrderWhere: any = {
      OR: [
        { guestEmail: user.email },
        ...(user.phone ? [{ guestPhone: user.phone }] : []),
      ],
    }

    if (shopId) {
      guestOrderWhere.shopId = shopId
    }

    if (status) {
      guestOrderWhere.status = status
    }

    const guestOrders = await prisma.guestOrder.findMany({
      where: guestOrderWhere,
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
    })

    // 3. 두 주문 타입을 통합 형식으로 변환
    const allOrders = [
      // 회원 주문
      ...memberOrders.map(order => ({
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
      })),
      // 비회원 주문
      ...guestOrders.map(order => ({
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
        isGuestOrder: true,
        items: order.items.map(item => ({
          id: item.id,
          productName: item.productName,
          optionSummary: item.optionSummary,
          thumbnailUrl: item.thumbnailUrl || item.publishedProduct?.product?.thumbnailUrl,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          hasReview: false, // 비회원 주문은 리뷰 불가
          product: item.publishedProduct?.product ? {
            id: item.publishedProduct.product.id,
            name: item.publishedProduct.product.name,
            thumbnailUrl: item.publishedProduct.product.thumbnailUrl,
          } : null,
        })),
        hasWritableReview: false, // 비회원 주문은 리뷰 작성 불가
        payment: order.payment ? {
          status: order.payment.status,
          method: order.payment.method,
          approvedAt: order.payment.approvedAt?.toISOString() || null,
        } : null,
      })),
    ]

    // 4. 주문일시 기준 정렬
    allOrders.sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())

    // 5. 페이지네이션 적용
    const total = allOrders.length
    const offset = (page - 1) * limit
    const paginatedOrders = allOrders.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      orders: paginatedOrders,
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
