import { NextRequest, NextResponse } from 'next/server'
import { getTossPaymentsService } from '@/lib/payments/toss-payments'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await request.json()

    // 입력값 검증
    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 토스페이먼츠 서비스 인스턴스 생성 (DB에서 키 조회)
    const tossService = await getTossPaymentsService()

    // 금액 유효성 검증
    if (!tossService.validateAmount(amount)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 결제 금액입니다.' },
        { status: 400 }
      )
    }

    // 주문 ID 유효성 검증
    if (!tossService.validateOrderId(orderId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 주문 ID입니다.' },
        { status: 400 }
      )
    }

    // 주문 존재 확인
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: { customer: true, product: true }
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 주문 금액과 결제 금액 일치 확인
    if (order.totalAmount !== amount) {
      return NextResponse.json(
        { success: false, error: '주문 금액과 결제 금액이 일치하지 않습니다.' },
        { status: 400 }
      )
    }

    // Mock 결제 처리 (개발 환경)
    let paymentResult: any

    if (paymentKey.startsWith('mock_payment_')) {
      console.log('Mock 결제 승인 처리:', { paymentKey, orderId, amount })

      // Mock 결제 응답 생성
      paymentResult = {
        paymentKey,
        orderId,
        orderName: `Mock Payment - ${orderId}`,
        totalAmount: amount,
        method: 'CARD',
        status: 'DONE',
        approvedAt: new Date().toISOString(),
        type: 'NORMAL',
        currency: 'KRW',
        mId: 'mock_merchant',
        useEscrow: false,
        lastTransactionKey: null,
        suppliedAmount: amount,
        vat: Math.floor(amount / 11),
        isPartialCancelable: true,
        country: 'KR',
        balanceAmount: amount,
        cultureBenefit: false,
        taxFreeAmount: 0,
        taxExemptionAmount: 0
      }
    } else {
      // 실제 토스페이먼츠 결제 승인 요청
      paymentResult = await tossService.confirmPayment({
        paymentKey,
        orderId,
        amount
      })
    }

    // 결제 정보를 데이터베이스에 저장
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { name: '토스페이먼츠' }
    }) || await prisma.paymentMethod.create({
      data: {
        name: '토스페이먼츠',
        config: JSON.stringify({ provider: 'tosspayments' })
      }
    })

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentKey,
        method: paymentResult.method || 'UNKNOWN',
        amount: paymentResult.totalAmount,
        status: paymentResult.status,
        approvedAt: paymentResult.approvedAt ? new Date(paymentResult.approvedAt) : null,
        webhookData: JSON.stringify(paymentResult),
        paymentMethodId: paymentMethod.id
      }
    })

    // 주문 상태 업데이트
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        updatedAt: new Date()
      }
    })

    console.log('결제 승인 성공:', {
      orderId,
      paymentKey,
      amount: paymentResult.totalAmount
    })

    return NextResponse.json({
      success: true,
      payment: paymentResult,
      message: '결제가 성공적으로 승인되었습니다.'
    })

  } catch (error: any) {
    console.error('결제 승인 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || '결제 승인 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}