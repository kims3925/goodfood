/**
 * Toss Payments Confirm API
 * 토스페이먼츠 결제 승인 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTossPaymentsService } from '@/modules/payments/domain/src/payments/services/toss-payments.service'
import prisma from '@/lib/database/client'

/**
 * POST /api/payments/confirm
 * 결제 승인 요청
 * Body: { paymentKey: string, orderId: string, amount: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { paymentKey, orderId, amount } = body

    // 입력 검증
    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다 (paymentKey, orderId, amount)' },
        { status: 400 }
      )
    }

    // 토스페이먼츠 서비스 인스턴스 생성
    const tossService = await getTossPaymentsService()

    // 금액 유효성 검증
    if (!tossService.validateAmount(amount)) {
      return NextResponse.json(
        { error: '유효하지 않은 결제 금액입니다 (1원 ~ 10,000,000원)' },
        { status: 400 }
      )
    }

    // 주문 ID 유효성 검증
    if (!tossService.validateOrderId(orderId)) {
      return NextResponse.json(
        { error: '유효하지 않은 주문 ID입니다' },
        { status: 400 }
      )
    }

    // 주문 존재 여부 확인
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 주문 금액 검증
    if (order.totalAmount !== amount) {
      return NextResponse.json(
        { error: '주문 금액과 결제 금액이 일치하지 않습니다' },
        { status: 400 }
      )
    }

    // 토스페이먼츠 결제 승인 요청
    const paymentResult = await tossService.confirmPayment({
      paymentKey,
      orderId,
      amount
    })

    // 결제 정보 DB 저장
    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentKey: paymentResult.paymentKey,
        method: paymentResult.method,
        amount: paymentResult.totalAmount,
        status: paymentResult.status,
        approvedAt: paymentResult.approvedAt ? new Date(paymentResult.approvedAt) : null,
        receiptUrl: paymentResult.receipt?.url || null,
        metadata: JSON.stringify(paymentResult)
      }
    })

    // 주문 상태 업데이트
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CONFIRMED',
        paidAt: new Date()
      }
    })

    console.log('결제 승인 성공:', {
      orderId,
      paymentKey,
      amount,
      method: paymentResult.method
    })

    return NextResponse.json({
      success: true,
      payment: paymentResult,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: 'CONFIRMED'
      }
    })
  } catch (error: any) {
    console.error('결제 승인 오류:', error)

    // 토스페이먼츠 API 오류 처리
    if (error.message?.includes('결제 승인 실패')) {
      return NextResponse.json(
        {
          error: '결제 승인에 실패했습니다',
          details: error.message
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: '결제 처리 중 오류가 발생했습니다',
        details: error.message
      },
      { status: 500 }
    )
  }
}
