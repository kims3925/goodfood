import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/order/unified/[id]
 * 주문 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') // SHOPPING_MALL or GOOGLE_FORM

    if (source === 'SHOPPING_MALL') {
      const order = await prisma.order.findFirst({
        where: {
          id: parseInt(id),
          items: {
            some: {
              publishedProduct: {
                userId: user.userId,
              },
            },
          },
        },
        include: {
          shippingAddress: true,
          items: {
            include: {
              publishedProduct: {
                include: {
                  product: true,
                },
              },
            },
          },
          payment: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          shop: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      if (!order) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      // 상태 레이블 매핑
      const statusLabels: Record<string, string> = {
        PENDING: '결제대기',
        PAID: '결제완료',
        PREPARING: '상품준비',
        SHIPPED: '배송중',
        DELIVERED: '배송완료',
        CANCELLED: '취소됨',
        REFUNDED: '환불됨',
      }

      // 통합 형식으로 변환
      const formattedOrder = {
        id: order.id,
        source: 'SHOPPING_MALL' as const,
        orderNumber: order.orderNumber,
        status: order.status,
        statusLabel: statusLabels[order.status] || order.status,
        customerName: order.shippingAddress?.recipientName || order.user?.name || '정보없음',
        customerPhone: order.shippingAddress?.recipientPhone || null,
        shippingAddress: order.shippingAddress ? {
          recipientName: order.shippingAddress.recipientName,
          recipientPhone: order.shippingAddress.recipientPhone,
          postalCode: order.shippingAddress.postalCode,
          address: order.shippingAddress.address,
          addressDetail: order.shippingAddress.addressDetail,
          deliveryMemo: order.shippingAddress.deliveryMemo,
        } : null,
        subtotalAmount: Number(order.subtotalAmount),
        shippingFee: Number(order.shippingFee),
        discountAmount: Number(order.discountAmount),
        totalAmount: Number(order.totalAmount),
        paymentMethod: order.payment?.method || null,
        createdAt: order.orderedAt?.toISOString() || order.createdAt?.toISOString(),
        paidAt: order.paidAt?.toISOString() || null,
        shippedAt: order.shippedAt?.toISOString() || null,
        deliveredAt: order.deliveredAt?.toISOString() || null,
        cancelledAt: order.cancelledAt?.toISOString() || null,
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          optionSummary: item.optionSummary,
          thumbnailUrl: item.thumbnailUrl || item.publishedProduct?.product?.thumbnailUrl || null,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
        payment: order.payment ? {
          id: order.payment.id,
          method: order.payment.method,
          status: order.payment.status,
          amount: Number(order.payment.amount),
          paidAt: order.payment.approvedAt?.toISOString() || null,
        } : null,
        user: order.user ? {
          id: order.user.id,
          name: order.user.name,
          email: order.user.email,
        } : null,
        shopId: order.shopId,
        shopName: order.shop?.name || null,
      }

      return NextResponse.json({
        success: true,
        data: formattedOrder,
      })
    }

    return NextResponse.json(
      { success: false, error: 'source 파라미터가 필요하거나 유효하지 않습니다.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('주문 상세 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/order/unified/[id]
 * 주문 상태 변경
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { source, status } = body

    if (!source || !status) {
      return NextResponse.json(
        { success: false, error: 'source와 status가 필요합니다.' },
        { status: 400 }
      )
    }

    if (source === 'SHOPPING_MALL') {
      // 권한 확인: 관리자가 발행한 상품이 포함된 주문인지
      const order = await prisma.order.findFirst({
        where: {
          id: parseInt(id),
          items: {
            some: {
              publishedProduct: {
                userId: user.userId,
              },
            },
          },
        },
      })

      if (!order) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없거나 권한이 없습니다.' },
          { status: 404 }
        )
      }

      // 유효한 상태인지 확인
      const validStatuses = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 상태입니다.' },
          { status: 400 }
        )
      }

      // 상태 변경 시 관련 날짜 필드도 업데이트
      const updateData: any = { status }

      switch (status) {
        case 'PAID':
          updateData.paidAt = new Date()
          break
        case 'SHIPPED':
          updateData.shippedAt = new Date()
          break
        case 'DELIVERED':
          updateData.deliveredAt = new Date()
          break
        case 'CANCELLED':
          updateData.cancelledAt = new Date()
          updateData.cancelledBy = 'ADMIN'
          break
      }

      await prisma.order.update({
        where: { id: parseInt(id) },
        data: updateData,
      })

      return NextResponse.json({
        success: true,
        message: '주문 상태가 변경되었습니다.',
      })
    }

    return NextResponse.json(
      { success: false, error: '유효하지 않은 source입니다.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('주문 상태 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '상태 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
