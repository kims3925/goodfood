export const dynamic = 'force-dynamic'

/**
 * 비회원 주문 조회 API
 * 주문번호 + 휴대폰번호로 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { generateGuestAccessToken } from '@/lib/guest-token'

// GuestOrder include 옵션
const guestOrderIncludeOptions = {
  shippingAddress: true,
  items: {
    include: {
      shopProduct: {
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
 * POST /api/guest-orders/lookup
 * 비회원 주문 조회 (주문번호 + 휴대폰번호)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderNumber, phone } = body

    // 입력 검증
    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: '주문번호를 입력해주세요' },
        { status: 400 }
      )
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, error: '휴대폰번호를 입력해주세요' },
        { status: 400 }
      )
    }

    // 휴대폰번호 정규화 (하이픈 제거)
    const normalizedPhone = phone.replace(/-/g, '')

    // 비회원 주문 조회
    const guestOrder = await prisma.guestOrder.findFirst({
      where: {
        orderNumber,
        guestPhone: normalizedPhone,
      },
      include: guestOrderIncludeOptions,
    })

    if (!guestOrder) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다. 주문번호와 휴대폰번호를 확인해주세요.' },
        { status: 404 }
      )
    }

    // 접근 토큰 발급 (1시간 유효)
    const accessToken = generateGuestAccessToken(
      guestOrder.id,
      normalizedPhone,
      orderNumber
    )

    // 무통장입금 정보 (해당하는 경우)
    let bankTransferInfo = null
    if (guestOrder.payment?.method === 'BANK_TRANSFER' && guestOrder.shop) {
      // 입금기한: 주문일로부터 3일 후
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
      // 주문자 정보
      customer: {
        name: guestOrder.guestName,
        phone: guestOrder.guestPhone,
        email: guestOrder.guestEmail,
      },
      // 배송지 정보
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
      // 금액 정보
      subtotalAmount: Number(guestOrder.subtotalAmount),
      shippingFee: Number(guestOrder.shippingFee),
      discountAmount: Number(guestOrder.discountAmount),
      totalAmount: Number(guestOrder.totalAmount),
      // 일시 정보
      orderedAt: guestOrder.orderedAt.toISOString(),
      paidAt: guestOrder.paidAt?.toISOString() || null,
      shippedAt: guestOrder.shippedAt?.toISOString() || null,
      deliveredAt: guestOrder.deliveredAt?.toISOString() || null,
      cancelledAt: guestOrder.cancelledAt?.toISOString() || null,
      // 주문 상품
      items: guestOrder.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        optionSummary: item.optionSummary,
        thumbnailUrl: item.thumbnailUrl || item.shopProduct?.product?.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      // 결제 정보
      payment: guestOrder.payment
        ? {
            status: guestOrder.payment.status,
            method: guestOrder.payment.method,
            amount: Number(guestOrder.payment.amount),
            paidAt: guestOrder.payment.approvedAt?.toISOString() || null,
          }
        : null,
      // 무통장입금 정보
      bankTransferInfo,
    }

    return NextResponse.json({
      success: true,
      order: formattedOrder,
      accessToken,
      expiresIn: 3600, // 1시간 (초)
    })
  } catch (error: any) {
    console.error('Guest order lookup error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 조회 실패' },
      { status: 500 }
    )
  }
}
