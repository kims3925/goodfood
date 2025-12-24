export const dynamic = 'force-dynamic'

/**
 * Payment Confirm API
 * TossPayments 결제 승인
 * PaymentService 사용
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getPaymentService,
  OrderPrepareData,
} from '@/modules/payments/services/payment.service'
import {
  TOSS_ERROR_CODES,
  getErrorDetails,
} from '@/modules/payments/constants/toss-error-codes'

const paymentService = getPaymentService()

/**
 * 표준 에러 응답 생성
 */
function createErrorResponse(code: string, message: string, status: number) {
  const errorDetails = getErrorDetails(code)

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        solution: errorDetails.solution,
        isRetryable: errorDetails.isRetryable,
      },
    },
    { status }
  )
}

/**
 * POST /api/payments/confirm
 * 결제 승인 요청
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { paymentKey, orderId, amount } = body

    // 1. 입력 검증
    if (!paymentKey || !orderId || amount === undefined) {
      return createErrorResponse(
        TOSS_ERROR_CODES.INVALID_REQUEST,
        '필수 파라미터가 누락되었습니다 (paymentKey, orderId, amount)',
        400
      )
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return createErrorResponse(
        TOSS_ERROR_CODES.BELOW_ZERO_AMOUNT,
        '결제 금액이 올바르지 않습니다',
        400
      )
    }

    // 2. 쿠키에서 주문 준비 데이터 확인
    const orderPrepareCookie = req.cookies.get('order_prepare')?.value
    let prepareData: OrderPrepareData | null = null

    if (orderPrepareCookie) {
      try {
        const decodedData = Buffer.from(orderPrepareCookie, 'base64').toString('utf-8')
        prepareData = JSON.parse(decodedData)
      } catch (e) {
        console.error('주문 준비 데이터 파싱 실패:', e)
      }
    }

    // 3. 장바구니 세션 ID
    const cartSessionId = req.cookies.get('cart_session')?.value

    // 4. 결제 승인 처리 (서비스 호출)
    const result = await paymentService.confirmPaymentWithOrder({
      paymentKey,
      orderId,
      amount,
      orderPrepareData: prepareData,
      cartSessionId,
    })

    // 5. 성공 응답
    const response = NextResponse.json(result)

    // order_prepare 쿠키 삭제
    response.cookies.delete('order_prepare')

    return response
  } catch (error: any) {
    console.error('Payment confirm error:', error)

    // ValidationError
    if (error.name === 'ValidationError') {
      return createErrorResponse(TOSS_ERROR_CODES.INVALID_REQUEST, error.message, 400)
    }

    // NotFoundError
    if (error.name === 'NotFoundError') {
      return createErrorResponse(
        TOSS_ERROR_CODES.INVALID_REQUEST,
        '주문 정보를 찾을 수 없습니다. 다시 결제를 시도해주세요.',
        404
      )
    }

    // BusinessLogicError
    if (error.name === 'BusinessLogicError') {
      if (error.message.includes('이미 처리 중')) {
        return createErrorResponse('ALREADY_PROCESSING', error.message, 409)
      }
      if (error.message.includes('이미 결제가 완료')) {
        return createErrorResponse(TOSS_ERROR_CODES.DUPLICATED_ORDER_ID, error.message, 400)
      }
      return createErrorResponse(TOSS_ERROR_CODES.INVALID_REQUEST, error.message, 400)
    }

    // Prisma 에러 처리
    if (error.code === 'P2002') {
      return createErrorResponse(TOSS_ERROR_CODES.DUPLICATED_ORDER_ID, '중복된 결제 요청입니다', 400)
    }

    // TossPayments API 에러
    if (error.message?.includes('결제 승인 실패')) {
      const errorInfo = paymentService.getErrorInfo(error.code || 'UNKNOWN')
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code || 'UNKNOWN',
            message: errorInfo.message || error.message,
            solution: errorInfo.solution,
            isRetryable: errorInfo.isRetryable,
          },
        },
        { status: 400 }
      )
    }

    return createErrorResponse(
      TOSS_ERROR_CODES.FAILED_DB_PROCESSING,
      error.message || '결제 처리 중 오류가 발생했습니다',
      500
    )
  }
}
