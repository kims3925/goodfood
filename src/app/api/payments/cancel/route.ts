import { NextRequest } from 'next/server'
import { paymentService } from '@/domain/payments/services/payment.service'
import { successResponse, errorResponse } from '@/lib/http/response'
import { handleServiceError } from '@/lib/errors/handlers'

export async function POST(request: NextRequest) {
  const requestAt = new Date().toISOString()

  try {
    const { paymentKey, cancelReason, cancelAmount } = await request.json()

    const result = await paymentService.cancelPayment({
      paymentKey,
      cancelReason,
      cancelAmount
    })

    return successResponse({
      data: {
        cancellation: result.tossCancelData,
        refund: result.refund,
        payment: result.payment,
        order: result.order
      },
      message: '결제가 성공적으로 취소되었습니다',
      code: 'PAYMENT_CANCELED',
      requestAt
    })
  } catch (error: any) {
    console.error('결제 취소 오류:', error)
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
