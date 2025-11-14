import { NextRequest } from 'next/server'
import { orderService } from '@/domain/orders/services/order.service'
import { successResponse, errorResponse } from '@/lib/http/response'
import { handleServiceError } from '@/lib/errors/handlers'

// 주문 생성
export async function POST(request: NextRequest) {
  const requestAt = new Date().toISOString()

  try {
    const {
      sessionId,
      userId,
      productId,
      quantity = 1,
      customerInfo,
      shippingAddress,
      paymentMethod = 'tosspayments'
    } = await request.json()

    if (!userId) {
      throw new Error('사용자 ID가 필요합니다')
    }

    if (!productId) {
      throw new Error('상품 ID가 필요합니다')
    }

    const result = await orderService.createOrder({
      sessionId,
      userId: parseInt(userId, 10),
      productId: parseInt(productId, 10),
      quantity,
      customerInfo,
      shippingAddress,
      paymentMethod
    } as any)

    return successResponse({
      data: {
        order: result.order,
        paymentUrl: result.paymentUrl
      },
      message: '주문이 생성되었습니다',
      code: 'ORDER_CREATED',
      status: 201,
      requestAt
    })
  } catch (error: any) {
    console.error('주문 생성 오류:', error)
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

// 주문 조회
export async function GET(request: NextRequest) {
  const requestAt = new Date().toISOString()

  try {
    const { searchParams } = new URL(request.url)
    const orderIdParam = searchParams.get('orderId')
    const orderNumber = searchParams.get('orderNumber')
    const customerIdParam = searchParams.get('customerId')

    if (!orderIdParam && !orderNumber && !customerIdParam) {
      return errorResponse({
        message: '조회 조건이 필요합니다 (orderId, orderNumber, customerId 중 하나)',
        code: 'VALIDATION_ERROR',
        status: 400,
        requestAt
      })
    }

    // 단일 주문 조회
    if (orderIdParam) {
      const orderId = parseInt(orderIdParam)
      const order = await orderService.findById(orderId)
      return successResponse({
        data: { order },
        message: '주문을 조회했습니다',
        code: 'ORDER_FETCHED',
        requestAt
      })
    }

    if (orderNumber) {
      const order = await orderService.findByOrderNumber(orderNumber)
      return successResponse({
        data: { order },
        message: '주문을 조회했습니다',
        code: 'ORDER_FETCHED',
        requestAt
      })
    }

    // 고객별 여러 주문 조회
    if (customerIdParam) {
      const customerId = parseInt(customerIdParam)
      const orders = await orderService.findByCustomerId(customerId)
      return successResponse({
        data: {
          orders,
          totalCount: orders.length
        },
        message: '고객 주문 목록을 조회했습니다',
        code: 'ORDERS_FETCHED',
        requestAt
      })
    }

    return errorResponse({
      message: '유효하지 않은 조회 조건입니다',
      code: 'VALIDATION_ERROR',
      status: 400,
      requestAt
    })
  } catch (error: any) {
    console.error('주문 조회 오류:', error)
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
