import { NextRequest, NextResponse } from 'next/server'
import { getTossPaymentsService } from '@/lib/payments/toss-payments'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { paymentKey, cancelReason, cancelAmount } = await request.json()

    // 입력값 검증
    if (!paymentKey || !cancelReason) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 토스페이먼츠 서비스 인스턴스 생성 (DB에서 키 조회)
    const tossService = await getTossPaymentsService()

    // 결제 정보 조회
    const payment = await prisma.payment.findFirst({
      where: { paymentKey },
      include: {
        order: {
          include: {
            customer: true,
            product: true
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: '결제 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 이미 취소된 결제인지 확인
    if (payment.status === 'CANCELED') {
      return NextResponse.json(
        { success: false, error: '이미 취소된 결제입니다.' },
        { status: 400 }
      )
    }

    // 취소 금액 검증 (부분 취소인 경우)
    if (cancelAmount !== undefined) {
      if (!tossService.validateAmount(cancelAmount)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 취소 금액입니다.' },
          { status: 400 }
        )
      }

      if (cancelAmount > payment.amount) {
        return NextResponse.json(
          { success: false, error: '취소 금액이 결제 금액을 초과합니다.' },
          { status: 400 }
        )
      }
    }

    // 토스페이먼츠 결제 취소 요청
    const cancelResult = await tossService.cancelPayment(
      paymentKey,
      cancelReason,
      cancelAmount
    )

    // 취소 정보를 데이터베이스에 저장
    await prisma.refund.create({
      data: {
        paymentId: payment.id,
        amount: cancelAmount || payment.amount,
        reason: cancelReason,
        status: 'COMPLETED',
        refundData: JSON.stringify(cancelResult)
      }
    })

    // 결제 상태 업데이트
    const newStatus = cancelAmount && cancelAmount < payment.amount ? 'PARTIAL_CANCELED' : 'CANCELED'

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        webhookData: JSON.stringify(cancelResult),
        updatedAt: new Date()
      }
    })

    // 주문 상태 업데이트
    const orderStatus = newStatus === 'CANCELED' ? 'CANCELED' : 'PARTIAL_REFUND'
    const paymentStatus = newStatus === 'CANCELED' ? 'REFUNDED' : 'PARTIAL_REFUND'

    await prisma.order.update({
      where: { id: payment.orderId },
      data: {
        status: orderStatus,
        paymentStatus: paymentStatus,
        updatedAt: new Date()
      }
    })

    console.log('결제 취소 성공:', {
      paymentKey,
      cancelAmount: cancelAmount || payment.amount,
      reason: cancelReason
    })

    return NextResponse.json({
      success: true,
      cancellation: cancelResult,
      message: '결제가 성공적으로 취소되었습니다.'
    })

  } catch (error: any) {
    console.error('결제 취소 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '결제 취소 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}