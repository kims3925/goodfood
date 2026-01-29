export const dynamic = 'force-dynamic'

/**
 * 비회원 주문 취소 API
 * 토큰 검증 후 취소 처리
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { verifyGuestAccessToken, extractGuestTokenFromHeader } from '@/lib/guest-token'
import { sendOrderCancelledWebhook } from '@/services/order-webhook.service'

/**
 * POST /api/guest-orders/[id]/cancel
 * 비회원 주문 취소 (토큰 필요)
 */
export async function POST(
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

    // 요청 본문 파싱
    const body = await req.json()
    const { reason, refundAccount } = body

    if (!reason) {
      return NextResponse.json(
        { success: false, error: '취소 사유를 입력해주세요' },
        { status: 400 }
      )
    }

    // 비회원 주문 조회
    const guestOrder = await prisma.guestOrder.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        items: true,
      },
    })

    if (!guestOrder) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 취소 가능한 상태인지 확인
    const cancellableStatuses = ['PENDING', 'PAID']
    if (!cancellableStatuses.includes(guestOrder.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `현재 주문 상태(${guestOrder.status})에서는 취소할 수 없습니다`,
        },
        { status: 400 }
      )
    }

    // 배송 중이거나 배송 완료된 경우 취소 불가
    if (guestOrder.shippedAt) {
      return NextResponse.json(
        { success: false, error: '배송이 시작된 주문은 취소할 수 없습니다. 반품 신청을 이용해주세요.' },
        { status: 400 }
      )
    }

    // 무통장입금/가상계좌 결제의 경우 환불 계좌 정보 필수 확인
    const isVirtualAccountPayment = guestOrder.payment?.method === 'VIRTUAL_ACCOUNT' || guestOrder.payment?.method === 'BANK_TRANSFER'
    if (isVirtualAccountPayment && guestOrder.status === 'PAID') {
      if (!refundAccount || !refundAccount.bankName || !refundAccount.accountNumber || !refundAccount.accountHolder) {
        return NextResponse.json(
          { success: false, error: '무통장입금 환불을 위해 환불 계좌 정보를 입력해주세요' },
          { status: 400 }
        )
      }
    }

    // 주문 취소 처리
    const cancelledOrder = await prisma.$transaction(async (tx) => {
      // 주문 상태 업데이트
      const updatedOrder = await tx.guestOrder.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
          cancelledBy: 'GUEST',
          updatedAt: new Date(),
        },
      })

      // 결제 상태도 업데이트 (있는 경우)
      if (guestOrder.payment) {
        await tx.guestPayment.update({
          where: { id: guestOrder.payment.id },
          data: {
            status: 'CANCELED',  // TossPaymentStatus enum 값 (미국식)
            updatedAt: new Date(),
          },
        })
      }

      // 무통장입금/가상계좌 환불 계좌 정보 저장
      if (isVirtualAccountPayment && refundAccount) {
        await tx.refundAccount.create({
          data: {
            guestOrderId: updatedOrder.id,
            bankName: refundAccount.bankName,
            accountNumber: refundAccount.accountNumber,
            accountHolder: refundAccount.accountHolder,
          },
        })
        console.log(`비회원 환불 계좌 정보 저장: ${refundAccount.bankName} ${refundAccount.accountNumber}`)
      }

      return updatedOrder
    })

    // 취소 웹훅 알림 전송 (비동기, 실패해도 무시)
    sendOrderCancelledWebhook({
      orderNumber: guestOrder.orderNumber,
      customerName: guestOrder.guestName,
      totalAmount: Number(guestOrder.totalAmount),
      items: guestOrder.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        options: item.optionSummary || undefined,
      })),
      cancelReason: reason,
      cancelledBy: 'GUEST',
      phone: guestOrder.guestPhone || undefined,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: '주문이 취소되었습니다',
      order: {
        id: cancelledOrder.id,
        orderNumber: cancelledOrder.orderNumber,
        status: cancelledOrder.status,
        cancelledAt: cancelledOrder.cancelledAt?.toISOString(),
        cancelReason: cancelledOrder.cancelReason,
      },
    })
  } catch (error: any) {
    console.error('Guest order cancel error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 취소 실패' },
      { status: 500 }
    )
  }
}
