export const dynamic = 'force-dynamic'

/**
 * 비회원 주문 상세 API
 * 토큰 검증 후 주문 상세 반환
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { verifyGuestAccessToken, extractGuestTokenFromHeader } from '@/lib/guest-token'

// GuestOrder include 옵션
const guestOrderIncludeOptions = {
  shippingAddress: true,
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
    },
  },
  payment: true,
  shop: {
    select: {
      id: true,
      name: true,
      bankName: true,
      bankAccount: true,
      accountHolder: true,
    },
  },
}

/**
 * GET /api/guest-orders/[id]
 * 비회원 주문 상세 조회 (토큰 필요)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 주문 ID입니다' },
        { status: 400 }
      )
    }

    // 토큰 검증
    const authHeader = req.headers.get('authorization')
    const token = extractGuestTokenFromHeader(authHeader)

    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증 토큰이 필요합니다' },
        { status: 401 }
      )
    }

    const payload = verifyGuestAccessToken(token)

    if (!payload) {
      return NextResponse.json(
        { success: false, error: '유효하지 않거나 만료된 토큰입니다' },
        { status: 401 }
      )
    }

    // 토큰의 주문 ID와 요청 ID가 일치하는지 확인
    if (payload.guestOrderId !== orderId) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      )
    }

    // 비회원 주문 조회
    const guestOrder = await prisma.guestOrder.findUnique({
      where: { id: orderId },
      include: guestOrderIncludeOptions,
    })

    if (!guestOrder) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 무통장입금 정보 (해당하는 경우)
    let bankTransferInfo = null
    if (guestOrder.payment?.method === 'BANK_TRANSFER' && guestOrder.shop) {
      const deadline = new Date(guestOrder.orderedAt)
      deadline.setDate(deadline.getDate() + 3)

      bankTransferInfo = {
        bankName: guestOrder.shop.bankName,
        bankAccount: guestOrder.shop.bankAccount,
        accountHolder: guestOrder.shop.accountHolder,
        depositDeadline: deadline.toISOString(),
      }
    }

    // 응답 형식 변환
    const formattedOrder = {
      id: guestOrder.id,
      orderNumber: guestOrder.orderNumber,
      status: guestOrder.status,
      customer: {
        name: guestOrder.guestName,
        phone: guestOrder.guestPhone,
        email: guestOrder.guestEmail,
      },
      shippingAddress: guestOrder.shippingAddress
        ? {
            recipientName: guestOrder.shippingAddress.recipientName,
            recipientPhone: guestOrder.shippingAddress.recipientPhone,
            postalCode: guestOrder.shippingAddress.postalCode,
            address: guestOrder.shippingAddress.address,
            addressDetail: guestOrder.shippingAddress.addressDetail,
            deliveryMemo: guestOrder.shippingAddress.deliveryMemo,
          }
        : null,
      subtotalAmount: Number(guestOrder.subtotalAmount),
      shippingFee: Number(guestOrder.shippingFee),
      discountAmount: Number(guestOrder.discountAmount),
      totalAmount: Number(guestOrder.totalAmount),
      orderedAt: guestOrder.orderedAt.toISOString(),
      paidAt: guestOrder.paidAt?.toISOString() || null,
      shippedAt: guestOrder.shippedAt?.toISOString() || null,
      deliveredAt: guestOrder.deliveredAt?.toISOString() || null,
      cancelledAt: guestOrder.cancelledAt?.toISOString() || null,
      cancelReason: guestOrder.cancelReason,
      items: guestOrder.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        optionSummary: item.optionSummary,
        thumbnailUrl: item.thumbnailUrl || item.publishedProduct?.product?.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      payment: guestOrder.payment
        ? {
            status: guestOrder.payment.status,
            method: guestOrder.payment.method,
            amount: Number(guestOrder.payment.amount),
            paidAt: guestOrder.payment.approvedAt?.toISOString() || null,
          }
        : null,
      bankTransferInfo,
    }

    return NextResponse.json({
      success: true,
      order: formattedOrder,
    })
  } catch (error: any) {
    console.error('Guest order detail error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 상세 조회 실패' },
      { status: 500 }
    )
  }
}
