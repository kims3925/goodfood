/**
 * Payment Retry API
 * 결제 재시도 엔드포인트
 *
 * 결제 실패 후 재시도 시 기존 주문을 재활용하거나
 * 새 주문을 생성하는 기능을 제공합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma, { Prisma } from '@bandauto/db'
import {
  TOSS_ERROR_CODES,
  isRetryableError,
  getErrorDetails
} from '@/modules/payments/constants/toss-error-codes'

const Decimal = Prisma.Decimal
const MAX_RETRY_COUNT = 3
const RETRY_COOLDOWN_MS = 30 * 1000 // 30초

interface RetryRequest {
  orderId: string // orderNumber
  forceNewOrder?: boolean
}

/**
 * POST /api/payments/retry
 * 결제 재시도 요청
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '로그인이 필요합니다'
          }
        },
        { status: 401 }
      )
    }

    const userId = parseInt(session.user.id || '0')
    const body = await req.json()
    const { orderId, forceNewOrder }: RetryRequest = body

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: '주문번호가 필요합니다'
          }
        },
        { status: 400 }
      )
    }

    // 기존 주문 조회
    const existingOrder = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: {
        payment: true,
        items: {
          include: {
            publishedProduct: {
              include: {
                product: true
              }
            }
          }
        },
        user: true
      }
    })

    if (!existingOrder) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: '주문을 찾을 수 없습니다'
          }
        },
        { status: 404 }
      )
    }

    // 권한 확인
    if (existingOrder.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '재시도 권한이 없습니다'
          }
        },
        { status: 403 }
      )
    }

    // 이미 결제 완료된 주문인지 확인
    if (existingOrder.status === 'PAID') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.DUPLICATED_ORDER_ID,
            message: '이미 결제가 완료된 주문입니다'
          }
        },
        { status: 400 }
      )
    }

    // 재시도 횟수 확인
    const retryCount = existingOrder.payment?.rawResponse
      ? JSON.parse(existingOrder.payment.rawResponse).retryCount || 0
      : 0

    if (retryCount >= MAX_RETRY_COUNT && !forceNewOrder) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.EXCEED_MAX_PAYMENT_RETRY,
            message: '최대 재시도 횟수를 초과했습니다. 새로운 주문을 생성해주세요.',
            solution: '장바구니에서 다시 주문을 진행해주세요.'
          },
          maxRetryExceeded: true
        },
        { status: 400 }
      )
    }

    // 재시도 쿨다운 체크
    const lastPaymentAttempt = existingOrder.payment?.updatedAt
    if (lastPaymentAttempt) {
      const timeSinceLastAttempt = Date.now() - new Date(lastPaymentAttempt).getTime()
      if (timeSinceLastAttempt < RETRY_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((RETRY_COOLDOWN_MS - timeSinceLastAttempt) / 1000)
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'RETRY_TOO_SOON',
              message: `${remainingSeconds}초 후에 다시 시도해주세요`,
              solution: '잠시 후 다시 시도해주세요.'
            },
            cooldownRemaining: remainingSeconds
          },
          { status: 429 }
        )
      }
    }

    // 재시도 가능 여부 확인 (에러 코드 기반)
    const lastErrorCode = existingOrder.payment?.cancelReason
    if (lastErrorCode && !isRetryableError(lastErrorCode)) {
      // 재시도 불가능한 에러 - 새 주문 생성 권장
      const errorDetails = getErrorDetails(lastErrorCode)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: lastErrorCode,
            message: errorDetails.message,
            solution: errorDetails.solution
          },
          isRetryable: false,
          suggestNewOrder: true
        },
        { status: 400 }
      )
    }

    // 재시도 시 새 주문 생성 옵션
    if (forceNewOrder) {
      // 새 주문 생성
      const newOrderNumber = generateOrderNumber()

      const newOrder = await prisma.$transaction(async (tx) => {
        // 기존 주문 취소 처리
        await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date()
          }
        })

        // 새 주문 생성
        const order = await tx.order.create({
          data: {
            orderNumber: newOrderNumber,
            userId: existingOrder.userId,
            status: 'PENDING',
            recipientName: existingOrder.recipientName,
            recipientPhone: existingOrder.recipientPhone,
            postalCode: existingOrder.postalCode,
            address: existingOrder.address,
            addressDetail: existingOrder.addressDetail,
            deliveryMemo: existingOrder.deliveryMemo,
            subtotalAmount: existingOrder.subtotalAmount,
            shippingFee: existingOrder.shippingFee,
            discountAmount: existingOrder.discountAmount,
            totalAmount: existingOrder.totalAmount,
            items: {
              create: existingOrder.items.map(item => ({
                publishedProductId: item.publishedProductId,
                productName: item.productName,
                thumbnailUrl: item.thumbnailUrl,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                optionSummary: item.optionSummary
              }))
            }
          },
          include: {
            items: true,
            user: {
              select: {
                name: true,
                email: true,
                phone: true
              }
            }
          }
        })

        return order
      })

      return NextResponse.json({
        success: true,
        isNewOrder: true,
        order: {
          id: newOrder.id,
          orderNumber: newOrder.orderNumber,
          totalAmount: Number(newOrder.totalAmount),
          status: newOrder.status,
          customer: {
            name: newOrder.user?.name,
            email: newOrder.user?.email,
            phone: newOrder.user?.phone
          }
        },
        previousOrderId: existingOrder.orderNumber,
        message: '새 주문이 생성되었습니다. 결제를 진행해주세요.'
      })
    }

    // 기존 주문 재사용
    // 주문 상태를 PENDING으로 리셋
    await prisma.$transaction(async (tx) => {
      // 주문 상태 리셋
      await tx.order.update({
        where: { id: existingOrder.id },
        data: {
          status: 'PENDING'
        }
      })

      // 결제 정보 리셋 (있는 경우)
      if (existingOrder.payment) {
        const currentRawResponse = existingOrder.payment.rawResponse
          ? JSON.parse(existingOrder.payment.rawResponse)
          : {}

        await tx.payment.update({
          where: { id: existingOrder.payment.id },
          data: {
            status: 'READY',
            approvedAt: null,
            cancelReason: null,
            rawResponse: JSON.stringify({
              ...currentRawResponse,
              retryCount: retryCount + 1,
              lastRetryAt: new Date().toISOString()
            })
          }
        })
      }
    })

    return NextResponse.json({
      success: true,
      isNewOrder: false,
      order: {
        id: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        totalAmount: Number(existingOrder.totalAmount),
        status: 'PENDING',
        customer: {
          name: existingOrder.user?.name,
          email: existingOrder.user?.email,
          phone: existingOrder.user?.phone
        }
      },
      retryCount: retryCount + 1,
      maxRetryCount: MAX_RETRY_COUNT,
      message: '결제를 다시 진행해주세요.'
    })

  } catch (error: any) {
    console.error('결제 재시도 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: TOSS_ERROR_CODES.FAILED_DB_PROCESSING,
          message: error.message || '결제 재시도 처리 중 오류가 발생했습니다'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/payments/retry
 * 재시도 가능 여부 확인
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
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: '주문번호가 필요합니다'
          }
        },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: {
        payment: true
      }
    })

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: TOSS_ERROR_CODES.INVALID_REQUEST,
            message: '주문을 찾을 수 없습니다'
          }
        },
        { status: 404 }
      )
    }

    // 이미 결제 완료
    if (order.status === 'PAID') {
      return NextResponse.json({
        success: true,
        canRetry: false,
        reason: '이미 결제가 완료된 주문입니다',
        orderStatus: order.status
      })
    }

    // 취소된 주문
    if (order.status === 'CANCELLED') {
      return NextResponse.json({
        success: true,
        canRetry: false,
        reason: '취소된 주문입니다. 새로운 주문을 생성해주세요.',
        orderStatus: order.status,
        suggestNewOrder: true
      })
    }

    // 재시도 횟수 확인
    const retryCount = order.payment?.rawResponse
      ? JSON.parse(order.payment.rawResponse).retryCount || 0
      : 0

    // 쿨다운 확인
    const lastPaymentAttempt = order.payment?.updatedAt
    let cooldownRemaining = 0
    if (lastPaymentAttempt) {
      const timeSinceLastAttempt = Date.now() - new Date(lastPaymentAttempt).getTime()
      if (timeSinceLastAttempt < RETRY_COOLDOWN_MS) {
        cooldownRemaining = Math.ceil((RETRY_COOLDOWN_MS - timeSinceLastAttempt) / 1000)
      }
    }

    // 에러 코드 기반 재시도 가능 여부
    const lastErrorCode = order.payment?.cancelReason
    const errorRetryable = lastErrorCode ? isRetryableError(lastErrorCode) : true
    const errorDetails = lastErrorCode ? getErrorDetails(lastErrorCode) : null

    return NextResponse.json({
      success: true,
      canRetry: retryCount < MAX_RETRY_COUNT && errorRetryable && cooldownRemaining === 0,
      orderStatus: order.status,
      paymentStatus: order.payment?.status || 'NONE',
      retryInfo: {
        currentRetryCount: retryCount,
        maxRetryCount: MAX_RETRY_COUNT,
        remainingRetries: Math.max(0, MAX_RETRY_COUNT - retryCount),
        cooldownRemaining,
        lastErrorCode,
        isErrorRetryable: errorRetryable,
        errorDetails: errorDetails ? {
          message: errorDetails.message,
          solution: errorDetails.solution
        } : null
      }
    })

  } catch (error: any) {
    console.error('재시도 가능 여부 확인 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: TOSS_ERROR_CODES.FAILED_DB_PROCESSING,
          message: error.message || '조회 중 오류가 발생했습니다'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * 주문번호 생성
 */
function generateOrderNumber(): string {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const hour = now.getHours().toString().padStart(2, '0')
  const minute = now.getMinutes().toString().padStart(2, '0')
  const second = now.getSeconds().toString().padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()

  return `ORD${year}${month}${day}${hour}${minute}${second}${random}`
}
