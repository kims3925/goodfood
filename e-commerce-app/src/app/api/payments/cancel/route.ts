/**
 * Toss Payments Cancel API
 * 토스페이먼츠 결제 취소 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTossPaymentsService } from '@/modules/payments/domain/src/payments/services/toss-payments.service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/database/client'

/**
 * POST /api/payments/cancel
 * 결제 취소 요청
 * Body: { paymentKey: string, cancelReason: string, cancelAmount?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // 관리자 권한 확인 (또는 본인 주문만 취소 가능)
    if (!session?.user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { paymentKey, cancelReason, cancelAmount } = body

    // 입력 검증
    if (!paymentKey || !cancelReason) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다 (paymentKey, cancelReason)' },
        { status: 400 }
      )
    }

    // 결제 정보 조회
    const payment = await prisma.payment.findUnique({
      where: { paymentKey },
      include: {
        order: true
      }
    })

    if (!payment) {
      return NextResponse.json(
        { error: '결제 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 권한 확인 (본인 주문이거나 관리자인 경우만)
    const userId = session.user.id ? parseInt(session.user.id) : 0
    if (payment.order.customerId !== userId && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '취소 권한이 없습니다' },
        { status: 403 }
      )
    }

    // 이미 취소된 결제인지 확인
    if (payment.status === 'CANCELED' || payment.status === 'PARTIAL_CANCELED') {
      return NextResponse.json(
        { error: '이미 취소된 결제입니다' },
        { status: 400 }
      )
    }

    // 토스페이먼츠 서비스 인스턴스 생성
    const tossService = await getTossPaymentsService()

    // 토스페이먼츠 결제 취소 요청
    const cancelResult = await tossService.cancelPayment(
      paymentKey,
      cancelReason,
      cancelAmount
    )

    // 결제 취소 정보 DB 저장
    await prisma.refund.create({
      data: {
        paymentId: payment.id,
        amount: cancelAmount || payment.amount,
        reason: cancelReason,
        status: 'COMPLETED',
        processedAt: new Date(),
        metadata: JSON.stringify(cancelResult)
      }
    })

    // 결제 상태 업데이트
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: cancelResult.status,
        metadata: JSON.stringify(cancelResult)
      }
    })

    // 주문 상태 업데이트
    await prisma.order.update({
      where: { id: payment.orderId },
      data: {
        status: 'CANCELLED'
      }
    })

    console.log('결제 취소 성공:', {
      paymentKey,
      cancelAmount: cancelAmount || payment.amount,
      cancelReason
    })

    return NextResponse.json({
      success: true,
      refund: cancelResult,
      message: '결제가 성공적으로 취소되었습니다'
    })
  } catch (error: any) {
    console.error('결제 취소 오류:', error)

    // 토스페이먼츠 API 오류 처리
    if (error.message?.includes('결제 취소 실패')) {
      return NextResponse.json(
        {
          error: '결제 취소에 실패했습니다',
          details: error.message
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: '결제 취소 처리 중 오류가 발생했습니다',
        details: error.message
      },
      { status: 500 }
    )
  }
}
