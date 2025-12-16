/**
 * Order Cancel API
 * 주문 취소 및 토스페이먼츠 결제 취소
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'

const TOSS_SECRET_KEY = process.env.TOSS_PAYMENTS_SECRET_KEY || ''
const TOSS_CANCEL_URL = 'https://api.tosspayments.com/v1/payments'

// 취소 가능한 주문 상태
const CANCELLABLE_STATUSES = ['PENDING', 'PAID']

// 취소 사유 목록
const CANCEL_REASONS = [
  { value: 'CHANGE_MIND', label: '단순 변심' },
  { value: 'WRONG_ORDER', label: '주문 실수' },
  { value: 'FOUND_CHEAPER', label: '다른 곳에서 더 저렴하게 구매' },
  { value: 'DELIVERY_DELAY', label: '배송 지연' },
  { value: 'OUT_OF_STOCK', label: '상품 품절' },
  { value: 'OTHER', label: '기타' },
]

interface CancelRequest {
  reason: string
  customReason?: string
  // 무통장입금/가상계좌 환불 계좌 정보
  refundAccount?: {
    bankName: string
    accountNumber: string
    accountHolder: string
  }
}

/**
 * POST /api/orders/[id]/cancel
 * 주문 취소
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 주문 ID입니다' },
        { status: 400 }
      )
    }

    // 인증 확인
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string'
      ? parseInt(session.user.id)
      : session.user.id

    // 요청 본문 파싱
    const body: CancelRequest = await req.json()
    const { reason, customReason, refundAccount } = body

    if (!reason) {
      return NextResponse.json(
        { success: false, error: '취소 사유를 선택해주세요' },
        { status: 400 }
      )
    }

    // 주문 조회
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        user: true,
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
        { success: false, error: '본인의 주문만 취소할 수 있습니다' },
        { status: 403 }
      )
    }

    // Shop ID 확인 (middleware에서 설정)
    const shopIdHeader = req.headers.get('x-shop-id')
    const shopId = shopIdHeader ? parseInt(shopIdHeader) : null

    // shopId가 있으면 해당 Shop의 주문인지 확인
    if (shopId && order.shopId !== shopId) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 취소 가능한 상태인지 확인
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { success: false, error: `현재 상태(${order.status})에서는 취소할 수 없습니다` },
        { status: 400 }
      )
    }

    // 무통장입금/가상계좌 결제의 경우 환불 계좌 정보 필수 확인
    const isVirtualAccountPayment = order.payment?.method === 'VIRTUAL_ACCOUNT' || order.payment?.method === 'BANK_TRANSFER'
    if (isVirtualAccountPayment && order.status === 'PAID') {
      if (!refundAccount || !refundAccount.bankName || !refundAccount.accountNumber || !refundAccount.accountHolder) {
        return NextResponse.json(
          { success: false, error: '무통장입금 환불을 위해 환불 계좌 정보를 입력해주세요' },
          { status: 400 }
        )
      }
    }

    // 취소 사유 텍스트
    const reasonLabel = CANCEL_REASONS.find(r => r.value === reason)?.label || reason
    const cancelReasonText = reason === 'OTHER' && customReason
      ? `${reasonLabel}: ${customReason}`
      : reasonLabel

    // 결제가 완료된 주문인 경우 토스페이먼츠 결제 취소 (카드결제만)
    // 무통장입금/가상계좌는 토스 API 호출하지 않음 (환불 계좌로 수동 환불)
    const isCardPayment = order.payment?.method === 'CARD'

    if (order.payment && order.payment.paymentKey && order.status === 'PAID' && isCardPayment) {
      try {
        const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')

        const tossResponse = await fetch(
          `${TOSS_CANCEL_URL}/${order.payment.paymentKey}/cancel`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cancelReason: cancelReasonText,
            }),
          }
        )

        const tossResult = await tossResponse.json()

        if (!tossResponse.ok) {
          console.error('토스 결제 취소 실패:', tossResult)
          return NextResponse.json(
            {
              success: false,
              error: tossResult.message || '결제 취소에 실패했습니다',
              code: tossResult.code
            },
            { status: 400 }
          )
        }

        // Payment 상태 업데이트
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            status: 'CANCELED',
            cancelReason: cancelReasonText,
            rawResponse: JSON.stringify(tossResult),
          },
        })

        console.log(`토스 결제 취소 완료: ${order.payment.paymentKey}`)
      } catch (error: any) {
        console.error('토스 결제 취소 API 오류:', error)
        return NextResponse.json(
          { success: false, error: '결제 취소 처리 중 오류가 발생했습니다' },
          { status: 500 }
        )
      }
    }

    // 무통장입금/가상계좌의 경우 Payment 상태만 업데이트
    if (order.payment && isVirtualAccountPayment && order.status === 'PAID') {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: {
          status: 'CANCELED',
          cancelReason: cancelReasonText,
        },
      })
      console.log(`무통장입금 결제 취소 처리: ${order.orderNumber}`)
    }

    // 주문 상태 업데이트
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: cancelReasonText,
        cancelledBy: 'USER',
      },
      include: {
        items: true,
        payment: true,
      },
    })

    // 무통장입금/가상계좌 환불 계좌 정보 저장
    if (isVirtualAccountPayment && refundAccount) {
      await prisma.refundAccount.create({
        data: {
          orderId: updatedOrder.id,
          bankName: refundAccount.bankName,
          accountNumber: refundAccount.accountNumber,
          accountHolder: refundAccount.accountHolder,
        },
      })
      console.log(`환불 계좌 정보 저장: ${refundAccount.bankName} ${refundAccount.accountNumber}`)
    }

    console.log(`주문 취소 완료: ${order.orderNumber}`)

    return NextResponse.json({
      success: true,
      message: '주문이 취소되었습니다',
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        cancelledAt: updatedOrder.cancelledAt,
        cancelReason: updatedOrder.cancelReason,
      },
    })
  } catch (error: any) {
    console.error('Order cancel error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 취소 실패' },
      { status: 500 }
    )
  }
}
