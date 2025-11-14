import { NextRequest } from 'next/server'
import { paymentService } from '@/domain/payments/services/payment.service'
import { successResponse, errorResponse } from '@/lib/http/response'
import { handleServiceError } from '@/lib/errors/handlers'

export async function POST(request: NextRequest) {
  const requestAt = new Date().toISOString()

  try {
    const { paymentKey, orderId, amount } = await request.json()

    const result = await paymentService.confirmPayment({
      paymentKey,
      orderId,
      amount
    })

    return successResponse({
      data: {
        payment: result.tossPaymentData,
        order: result.order
      },
      message: '결제가 성공적으로 승인되었습니다',
      code: 'PAYMENT_CONFIRMED',
      status: 201,
      requestAt
    })
  } catch (error: any) {
    console.error('결제 승인 오류:', error)
    const errorInfo = handleServiceError(error)
    return errorResponse({
      message: errorInfo.message,
      code: errorInfo.code,
      status: errorInfo.statusCode,
      meta: { details: errorInfo.details },
      requestAt
    })
  }
}
