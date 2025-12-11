/**
 * Toss Payments Cancel API
 * 토스페이먼츠 결제 취소 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma, { Prisma } from '@bandauto/db'
import {
  TOSS_ERROR_CODES,
  getErrorDetails
} from '@/modules/payments/constants/toss-error-codes'

const Decimal = Prisma.Decimal
const TOSS_SECRET_KEY = process.env.TOSS_PAYMENTS_SECRET_KEY || ''
const TOSS_API_URL = 'https://api.tosspayments.com/v1/payments'

interface CancelRequest {
  paymentKey: string
  cancelReason: string
  cancelAmount?: number
}

/**
 * POST /api/payments/cancel
 * 결제 취소 요청
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // 로그인 확인
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' } },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { paymentKey, cancelReason, cancelAmount }: CancelRequest = body

    // 입력 검증
    if (!paymentKey || !cancelReason) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: '필수 파라미터가 누락되었습니다 (paymentKey, cancelReason)'
          }
        },
        { status: 400 }
      )
    }

    // 결제 정보 조회
    const payment = await prisma.payment.findUnique({
      where: { paymentKey },
      include: {
        order: {
          include: {
            user: true
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: '결제 정보를 찾을 수 없습니다'
          }
        },
        { status: 404 }
      )
    }

    // 권한 확인 (본인 주문이거나 관리자인 경우만)
    const userId = session.user.id ? parseInt(session.user.id) : 0
    const isOwner = payment.order.userId === userId
    const isAdmin = session.user.role === 'ADMIN'

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '취소 권한이 없습니다'
          }
        },
        { status: 403 }
      )
    }

    // 이미 취소된 결제인지 확인
    if (payment.status === 'CANCELED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.DUPLICATED_ORDER_ID,
            message: '이미 전액 취소된 결제입니다'
          }
        },
        { status: 400 }
      )
    }

    // 취소 금액 검증
    const paymentAmount = Number(payment.amount)
    const alreadyCancelledAmount = Number(payment.cancelledAmount || 0)
    const remainingAmount = paymentAmount - alreadyCancelledAmount
    const amountToCancel = cancelAmount || remainingAmount

    if (amountToCancel <= 0 || amountToCancel > remainingAmount) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: `취소 가능 금액을 초과했습니다. (취소 가능: ${remainingAmount.toLocaleString()}원)`
          }
        },
        { status: 400 }
      )
    }

    // 토스페이먼츠 결제 취소 API 호출
    const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')

    const cancelResponse = await fetch(`${TOSS_API_URL}/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cancelReason,
        cancelAmount: amountToCancel
      })
    })

    const cancelResult = await cancelResponse.json()

    if (!cancelResponse.ok) {
      console.error('TossPayments 결제 취소 실패:', cancelResult)

      const errorDetails = getErrorDetails(cancelResult.code || TOSS_ERROR_CODES.OTHER_DEFINITION_ERROR)

      return NextResponse.json(
        {
          success: false,
          error: {
            code: cancelResult.code || TOSS_ERROR_CODES.OTHER_DEFINITION_ERROR,
            message: cancelResult.message || '결제 취소에 실패했습니다',
            solution: errorDetails.solution
          }
        },
        { status: 400 }
      )
    }

    // 결제 취소 성공 → DB 업데이트
    const isFullCancel = amountToCancel === remainingAmount
    const newCancelledAmount = alreadyCancelledAmount + amountToCancel

    const updatedPayment = await prisma.$transaction(async (tx) => {
      // 결제 정보 업데이트
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: isFullCancel ? 'CANCELED' : 'PARTIAL_CANCELED',
          cancelReason,
          cancelledAmount: new Decimal(newCancelledAmount),
          cancelledAt: new Date(),
          rawResponse: JSON.stringify(cancelResult)
        }
      })

      // 주문 상태 업데이트 (전액 취소 시에만 CANCELLED로 변경)
      if (isFullCancel) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date()
          }
        })
      }

      return updated
    })

    console.log('결제 취소 성공:', {
      paymentKey,
      cancelAmount: amountToCancel,
      cancelReason,
      isFullCancel
    })

    return NextResponse.json({
      success: true,
      refund: {
        paymentKey: updatedPayment.paymentKey,
        cancelAmount: amountToCancel,
        totalCancelledAmount: newCancelledAmount,
        remainingAmount: paymentAmount - newCancelledAmount,
        cancelReason,
        cancelledAt: updatedPayment.cancelledAt,
        status: updatedPayment.status,
        isFullCancel
      },
      message: isFullCancel ? '결제가 전액 취소되었습니다' : '결제가 부분 취소되었습니다'
    })
  } catch (error: any) {
    console.error('결제 취소 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: TOSS_ERROR_CODES.FAILED_DB_PROCESSING,
          message: error.message || '결제 취소 처리 중 오류가 발생했습니다'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/payments/cancel
 * 취소 가능 여부 확인
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const paymentKey = searchParams.get('paymentKey')

    if (!paymentKey) {
      return NextResponse.json(
        { success: false, error: 'paymentKey가 필요합니다' },
        { status: 400 }
      )
    }

    const payment = await prisma.payment.findUnique({
      where: { paymentKey },
      include: {
        order: true
      }
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: '결제 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const paymentAmount = Number(payment.amount)
    const cancelledAmount = Number(payment.cancelledAmount || 0)
    const remainingAmount = paymentAmount - cancelledAmount

    const cancellableStatuses = ['DONE', 'PARTIAL_CANCELED']
    const isCancellable = cancellableStatuses.includes(payment.status) && remainingAmount > 0

    return NextResponse.json({
      success: true,
      cancelInfo: {
        paymentKey: payment.paymentKey,
        orderId: payment.order.orderNumber,
        totalAmount: paymentAmount,
        cancelledAmount,
        remainingAmount,
        isCancellable,
        status: payment.status,
        reason: isCancellable ? null : getCancelBlockReason(payment.status, remainingAmount)
      }
    })
  } catch (error: any) {
    console.error('취소 정보 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

function getCancelBlockReason(status: string, remainingAmount: number): string {
  if (status === 'CANCELED') return '이미 전액 취소된 결제입니다'
  if (status === 'ABORTED') return '중단된 결제입니다'
  if (status === 'EXPIRED') return '만료된 결제입니다'
  if (remainingAmount <= 0) return '취소 가능한 금액이 없습니다'
  return '취소할 수 없는 상태입니다'
}
