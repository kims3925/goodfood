/**
 * Payment Confirm API
 * TossPayments 결제 승인
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { Decimal } from '@prisma/client/runtime/library'

const TOSS_SECRET_KEY = process.env.TOSS_PAYMENTS_SECRET_KEY || ''

/**
 * POST /api/payments/confirm
 * 결제 승인 요청
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { paymentKey, orderId, amount } = body

    // 입력 검증
    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      )
    }

    // 주문 확인
    const order = await prisma.customerOrder.findUnique({
      where: { orderNumber: orderId },
      include: { payment: true },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 이미 결제된 주문인지 확인
    if (order.payment && order.payment.status === 'DONE') {
      return NextResponse.json(
        { success: false, error: '이미 결제가 완료된 주문입니다' },
        { status: 400 }
      )
    }

    // 금액 검증
    if (Number(order.totalAmount) !== amount) {
      return NextResponse.json(
        { success: false, error: '주문 금액과 결제 금액이 일치하지 않습니다' },
        { status: 400 }
      )
    }

    // TossPayments 결제 승인 API 호출
    const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')

    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    })

    const tossResult = await tossResponse.json()

    if (!tossResponse.ok) {
      console.error('TossPayments 결제 승인 실패:', tossResult)
      return NextResponse.json(
        {
          success: false,
          error: tossResult.message || '결제 승인에 실패했습니다',
          code: tossResult.code,
        },
        { status: 400 }
      )
    }

    // 결제 정보 저장
    const payment = await prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        paymentKey: tossResult.paymentKey,
        tossOrderId: tossResult.orderId,
        method: mapPaymentMethod(tossResult.method),
        status: mapPaymentStatus(tossResult.status),
        amount: new Decimal(tossResult.totalAmount),
        cardCompany: tossResult.card?.company || null,
        cardNumber: tossResult.card?.number || null,
        installmentMonth: tossResult.card?.installmentPlanMonths || 0,
        rawResponse: tossResult,
        approvedAt: tossResult.approvedAt ? new Date(tossResult.approvedAt) : null,
      },
      update: {
        paymentKey: tossResult.paymentKey,
        method: mapPaymentMethod(tossResult.method),
        status: mapPaymentStatus(tossResult.status),
        amount: new Decimal(tossResult.totalAmount),
        cardCompany: tossResult.card?.company || null,
        cardNumber: tossResult.card?.number || null,
        installmentMonth: tossResult.card?.installmentPlanMonths || 0,
        rawResponse: tossResult,
        approvedAt: tossResult.approvedAt ? new Date(tossResult.approvedAt) : null,
      },
    })

    // 주문 상태 업데이트
    await prisma.customerOrder.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      payment: {
        paymentKey: payment.paymentKey,
        orderId: order.orderNumber,
        amount: Number(payment.amount),
        method: payment.method,
        status: payment.status,
        approvedAt: payment.approvedAt,
      },
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: 'PAID',
      },
    })
  } catch (error: any) {
    console.error('Payment confirm error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '결제 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// TossPayments method를 DB enum으로 매핑
function mapPaymentMethod(method: string): 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'MOBILE' | 'CULTURE_GIFT' | 'BOOK_GIFT' | 'GAME_GIFT' {
  const methodMap: Record<string, any> = {
    '카드': 'CARD',
    'CARD': 'CARD',
    '가상계좌': 'VIRTUAL_ACCOUNT',
    'VIRTUAL_ACCOUNT': 'VIRTUAL_ACCOUNT',
    '계좌이체': 'TRANSFER',
    'TRANSFER': 'TRANSFER',
    '휴대폰': 'MOBILE',
    'MOBILE': 'MOBILE',
    '문화상품권': 'CULTURE_GIFT',
    '도서문화상품권': 'BOOK_GIFT',
    '게임문화상품권': 'GAME_GIFT',
  }
  return methodMap[method] || 'CARD'
}

// TossPayments status를 DB enum으로 매핑
function mapPaymentStatus(status: string): 'READY' | 'IN_PROGRESS' | 'WAITING_FOR_DEPOSIT' | 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED' {
  const statusMap: Record<string, any> = {
    'READY': 'READY',
    'IN_PROGRESS': 'IN_PROGRESS',
    'WAITING_FOR_DEPOSIT': 'WAITING_FOR_DEPOSIT',
    'DONE': 'DONE',
    'CANCELED': 'CANCELED',
    'PARTIAL_CANCELED': 'PARTIAL_CANCELED',
    'ABORTED': 'ABORTED',
    'EXPIRED': 'EXPIRED',
  }
  return statusMap[status] || 'READY'
}
