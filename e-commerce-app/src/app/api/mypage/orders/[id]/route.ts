/**
 * MyPage Order Detail API
 * 마이페이지 주문 상세 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id
    const orderId = parseInt(params.id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 주문 ID입니다' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            productPublish: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    thumbnailUrl: true,
                  },
                },
                retailBand: {
                  select: {
                    id: true,
                    name: true,
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
        payment: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 본인 주문인지 확인
    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      )
    }

    // 응답 형식 변환
    const formattedOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      // 배송 정보
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      postalCode: order.postalCode,
      address: order.address,
      addressDetail: order.addressDetail,
      deliveryMemo: order.deliveryMemo,
      // 금액 정보
      subtotalAmount: Number(order.subtotalAmount),
      shippingFee: Number(order.shippingFee),
      discountAmount: Number(order.discountAmount),
      totalAmount: Number(order.totalAmount),
      // 일시 정보
      orderedAt: order.orderedAt.toISOString(),
      paidAt: order.paidAt?.toISOString() || null,
      shippedAt: order.shippedAt?.toISOString() || null,
      deliveredAt: order.deliveredAt?.toISOString() || null,
      cancelledAt: order.cancelledAt?.toISOString() || null,
      // 고객 정보
      customer: {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone,
      },
      // 주문 상품
      items: order.items.map(item => ({
        id: item.id,
        productName: item.productName,
        optionSummary: item.optionSummary,
        thumbnailUrl: item.thumbnailUrl || item.productPublish?.product?.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        hasReview: !!item.review,
        product: item.productPublish?.product ? {
          id: item.productPublish.product.id,
          name: item.productPublish.product.name,
          thumbnailUrl: item.productPublish.product.thumbnailUrl,
        } : null,
        retailBand: item.productPublish?.retailBand ? {
          id: item.productPublish.retailBand.id,
          name: item.productPublish.retailBand.name,
        } : null,
      })),
      // 후기 작성 가능 여부 (배송완료 + 미작성 리뷰가 있는 경우)
      hasWritableReview: order.status === 'DELIVERED' && order.items.some(item => !item.review),
      // 결제 정보
      payment: order.payment ? {
        id: order.payment.id,
        paymentKey: order.payment.paymentKey,
        status: order.payment.status,
        method: order.payment.method,
        amount: Number(order.payment.amount),
        cardCompany: order.payment.cardCompany,
        cardNumber: order.payment.cardNumber,
        installmentMonth: order.payment.installmentMonth,
        virtualAccountNumber: order.payment.virtualAccountNumber,
        virtualAccountBank: order.payment.virtualAccountBank,
        virtualAccountDueDate: order.payment.virtualAccountDueDate?.toISOString() || null,
        approvedAt: order.payment.approvedAt?.toISOString() || null,
      } : null,
    }

    return NextResponse.json({
      success: true,
      order: formattedOrder,
    })
  } catch (error) {
    console.error('Failed to fetch order detail:', error)
    return NextResponse.json(
      { success: false, error: '주문 상세를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
