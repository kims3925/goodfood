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
      // 먼저 회원 주문 조회 (orderNumber로 조회)
      const order = await prisma.order.findFirst({
        where: {
          orderNumber: id,
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

      // 회원 주문이 있으면 반환
      if (order) {

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
          isGuestOrder: false,
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

      // 회원 주문이 없으면 비회원 주문 조회 (orderNumber로 조회)
      const guestOrder = await prisma.guestOrder.findFirst({
        where: {
          orderNumber: id,
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
          shop: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      if (!guestOrder) {
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
      const formattedGuestOrder = {
        id: guestOrder.id,
        source: 'SHOPPING_MALL' as const,
        orderNumber: guestOrder.orderNumber,
        status: guestOrder.status,
        statusLabel: statusLabels[guestOrder.status] || guestOrder.status,
        isGuestOrder: true,
        customerName: guestOrder.shippingAddress?.recipientName || guestOrder.guestName,
        customerPhone: guestOrder.shippingAddress?.recipientPhone || guestOrder.guestPhone,
        shippingAddress: guestOrder.shippingAddress ? {
          recipientName: guestOrder.shippingAddress.recipientName,
          recipientPhone: guestOrder.shippingAddress.recipientPhone,
          postalCode: guestOrder.shippingAddress.postalCode,
          address: guestOrder.shippingAddress.address,
          addressDetail: guestOrder.shippingAddress.addressDetail,
          deliveryMemo: guestOrder.shippingAddress.deliveryMemo,
        } : null,
        subtotalAmount: Number(guestOrder.subtotalAmount),
        shippingFee: Number(guestOrder.shippingFee),
        discountAmount: Number(guestOrder.discountAmount),
        totalAmount: Number(guestOrder.totalAmount),
        paymentMethod: guestOrder.payment?.method || null,
        createdAt: guestOrder.orderedAt?.toISOString() || guestOrder.createdAt?.toISOString(),
        paidAt: guestOrder.paidAt?.toISOString() || null,
        shippedAt: guestOrder.shippedAt?.toISOString() || null,
        deliveredAt: guestOrder.deliveredAt?.toISOString() || null,
        cancelledAt: guestOrder.cancelledAt?.toISOString() || null,
        items: guestOrder.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          optionSummary: item.optionSummary,
          thumbnailUrl: item.thumbnailUrl || item.publishedProduct?.product?.thumbnailUrl || null,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
        payment: guestOrder.payment ? {
          id: guestOrder.payment.id,
          method: guestOrder.payment.method,
          status: guestOrder.payment.status,
          amount: Number(guestOrder.payment.amount),
          paidAt: guestOrder.payment.approvedAt?.toISOString() || null,
        } : null,
        user: null, // 비회원은 user 정보 없음
        shopId: guestOrder.shopId,
        shopName: guestOrder.shop?.name || null,
      }

      return NextResponse.json({
        success: true,
        data: formattedGuestOrder,
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
      // 먼저 회원 주문 조회 (orderNumber로 조회)
      const order = await prisma.order.findFirst({
        where: {
          orderNumber: id,
          items: {
            some: {
              publishedProduct: {
                userId: user.userId,
              },
            },
          },
        },
      })

      // 회원 주문이 있으면 처리
      if (order) {

      // 유효한 상태인지 확인
      const validStatuses = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 상태입니다.' },
          { status: 400 }
        )
      }

      // 상태 변경 시 관련 날짜 필드도 업데이트
      // 중간 단계를 건너뛸 경우 이전 단계의 날짜도 함께 채움
      const updateData: any = { status }
      const now = new Date()

      switch (status) {
        case 'PAID':
          // paidAt이 없으면 설정
          if (!order.paidAt) {
            updateData.paidAt = now
          }
          break
        case 'SHIPPED':
          // paidAt이 없으면 설정 (중간 단계 채움)
          if (!order.paidAt) {
            updateData.paidAt = now
          }
          // shippedAt 설정
          if (!order.shippedAt) {
            updateData.shippedAt = now
          }
          break
        case 'DELIVERED':
          // paidAt이 없으면 설정 (중간 단계 채움)
          if (!order.paidAt) {
            updateData.paidAt = now
          }
          // shippedAt이 없으면 설정 (중간 단계 채움)
          if (!order.shippedAt) {
            updateData.shippedAt = now
          }
          // deliveredAt 설정
          if (!order.deliveredAt) {
            updateData.deliveredAt = now
          }
          break
        case 'CANCELLED':
          updateData.cancelledAt = now
          updateData.cancelledBy = 'ADMIN'
          break
      }

        await prisma.order.update({
          where: { orderNumber: id },
          data: updateData,
        })

        return NextResponse.json({
          success: true,
          message: '주문 상태가 변경되었습니다.',
        })
      }

      // 회원 주문이 없으면 비회원 주문 조회 (orderNumber로 조회)
      const guestOrder = await prisma.guestOrder.findFirst({
        where: {
          orderNumber: id,
          items: {
            some: {
              publishedProduct: {
                userId: user.userId,
              },
            },
          },
        },
      })

      if (!guestOrder) {
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
      const now = new Date()

      switch (status) {
        case 'PAID':
          if (!guestOrder.paidAt) {
            updateData.paidAt = now
          }
          break
        case 'SHIPPED':
          if (!guestOrder.paidAt) {
            updateData.paidAt = now
          }
          if (!guestOrder.shippedAt) {
            updateData.shippedAt = now
          }
          break
        case 'DELIVERED':
          if (!guestOrder.paidAt) {
            updateData.paidAt = now
          }
          if (!guestOrder.shippedAt) {
            updateData.shippedAt = now
          }
          if (!guestOrder.deliveredAt) {
            updateData.deliveredAt = now
          }
          break
        case 'CANCELLED':
          updateData.cancelledAt = now
          updateData.cancelledBy = 'ADMIN'
          break
      }

      await prisma.guestOrder.update({
        where: { orderNumber: id },
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
