/**
 * Payment Confirm API
 * TossPayments 결제 승인 (완벽한 에러 핸들링 포함)
 * 결제 성공 시 주문 생성
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { Prisma, PublishStatus } from '@bandauto/db'
import {
  TOSS_ERROR_CODES,
  getErrorMessage,
  getErrorSolution,
  isRetryableError,
  getErrorDetails
} from '@/modules/payments/domain/src/payments/constants/toss-error-codes'

const Decimal = Prisma.Decimal

const TOSS_SECRET_KEY = process.env.TOSS_PAYMENTS_SECRET_KEY || ''
const TOSS_API_URL = 'https://api.tosspayments.com/v1/payments/confirm'

// 진행 중인 결제 요청 추적 (메모리 기반 - 단일 서버 환경용)
const processingOrders = new Set<string>()

// 주문 준비 데이터 인터페이스
interface OrderPrepareData {
  orderId: string
  userId: number
  fromCart: boolean
  items?: { productPublishId: number; variantId?: number; quantity: number }[]
  customerInfo: {
    name: string
    phone: string
    email?: string
  }
  shippingAddress: {
    recipientName: string
    recipientPhone: string
    address: string
    postalCode: string
    addressDetail?: string
    deliveryMemo?: string
  }
}

interface TossConfirmRequest {
  paymentKey: string
  orderId: string
  amount: number
}

interface TossErrorResponse {
  code: string
  message: string
}

/**
 * POST /api/payments/confirm
 * 결제 승인 요청
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await req.json()
    const { paymentKey, orderId, amount }: TossConfirmRequest = body

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

    // 2. 중복 요청 방지 체크
    if (processingOrders.has(orderId)) {
      console.log(`중복 결제 요청 차단: ${orderId}`)
      return createErrorResponse(
        'ALREADY_PROCESSING',
        '결제가 이미 처리 중입니다. 잠시 후 확인해주세요.',
        409
      )
    }

    // 처리 중 표시
    processingOrders.add(orderId)

    try {
    // 3. 쿠키에서 주문 준비 데이터 확인
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

    // 4. DB에서 기존 주문 확인
    let order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: {
        payment: true,
        user: true,
        items: true
      },
    })

    // 주문이 없으면 쿠키 데이터로 주문 생성
    if (!order) {
      if (!prepareData || prepareData.orderId !== orderId) {
        return createErrorResponse(
          TOSS_ERROR_CODES.INVALID_REQUEST,
          '주문 정보를 찾을 수 없습니다. 다시 결제를 시도해주세요.',
          404
        )
      }

      // 주문 아이템 데이터 준비
      let orderItems: any[] = []

      if (prepareData.fromCart) {
        // 장바구니에서 주문 아이템 조회
        const cart = await prisma.cart.findFirst({
          where: { userId: prepareData.userId },
          include: {
            items: {
              include: {
                productPublish: {
                  include: {
                    product: {
                      include: { variants: { take: 1 } },
                    },
                  },
                },
                variant: true,
              },
            },
          },
        })

        if (!cart || cart.items.length === 0) {
          return createErrorResponse(
            TOSS_ERROR_CODES.INVALID_REQUEST,
            '장바구니가 비어있습니다',
            400
          )
        }

        orderItems = cart.items.map((item) => {
          const productPublish = item.productPublish
          const product = productPublish.product
          const variant = item.variant
          const mainVariant = product.variants[0]
          const unitPrice = variant?.price || mainVariant?.price || product.price || 0

          return {
            productPublishId: productPublish.id,
            variantId: variant?.id || null,
            productName: product.name,
            optionSummary: variant?.optionSummary || null,
            thumbnailUrl: product.thumbnailUrl,
            quantity: item.quantity,
            unitPrice: Number(unitPrice),
          }
        })
      } else if (prepareData.items) {
        // 직접 지정 상품
        for (const item of prepareData.items) {
          const productPublish = await prisma.productPublish.findFirst({
            where: {
              id: item.productPublishId,
              status: PublishStatus.SUCCESS,
            },
            include: {
              product: {
                include: { variants: { take: 1 } },
              },
            },
          })

          if (!productPublish) {
            return createErrorResponse(
              TOSS_ERROR_CODES.INVALID_REQUEST,
              '상품을 찾을 수 없습니다',
              404
            )
          }

          let variant = null
          if (item.variantId) {
            variant = await prisma.productVariant.findUnique({
              where: { id: item.variantId },
            })
          }

          const product = productPublish.product
          const mainVariant = product.variants[0]
          const unitPrice = variant?.price || mainVariant?.price || product.price || 0

          orderItems.push({
            productPublishId: productPublish.id,
            variantId: variant?.id || null,
            productName: product.name,
            optionSummary: variant?.optionSummary || null,
            thumbnailUrl: product.thumbnailUrl,
            quantity: item.quantity || 1,
            unitPrice: Number(unitPrice),
          })
        }
      }

      // 금액 계산
      const subtotal = orderItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      )
      const shippingFee = subtotal >= 30000 ? 0 : 3000
      const discountAmount = 0
      const totalAmount = subtotal + shippingFee - discountAmount

      // 결제 금액 검증
      if (totalAmount !== amount) {
        console.error('금액 불일치:', { calculatedAmount: totalAmount, requestAmount: amount })
        return createErrorResponse(
          TOSS_ERROR_CODES.INVALID_REQUEST,
          `주문 금액(${totalAmount.toLocaleString()}원)과 결제 금액(${amount.toLocaleString()}원)이 일치하지 않습니다`,
          400
        )
      }

      // 주문 생성
      order = await prisma.order.create({
        data: {
          userId: prepareData.userId,
          orderNumber: prepareData.orderId,
          status: 'PENDING', // 일단 PENDING으로 생성, 결제 완료 후 업데이트
          recipientName: prepareData.shippingAddress.recipientName,
          recipientPhone: prepareData.shippingAddress.recipientPhone,
          postalCode: prepareData.shippingAddress.postalCode,
          address: prepareData.shippingAddress.address,
          addressDetail: prepareData.shippingAddress.addressDetail || null,
          deliveryMemo: prepareData.shippingAddress.deliveryMemo || null,
          subtotalAmount: new Decimal(subtotal),
          shippingFee: new Decimal(shippingFee),
          discountAmount: new Decimal(discountAmount),
          totalAmount: new Decimal(totalAmount),
          items: {
            create: orderItems.map((item) => ({
              productPublishId: item.productPublishId,
              variantId: item.variantId,
              productName: item.productName,
              optionSummary: item.optionSummary,
              thumbnailUrl: item.thumbnailUrl,
              quantity: item.quantity,
              unitPrice: new Decimal(item.unitPrice),
              totalPrice: new Decimal(item.unitPrice * item.quantity),
            })),
          },
        },
        include: {
          payment: true,
          user: true,
          items: true,
        },
      })

      console.log(`주문 생성 완료: ${order.orderNumber}`)
    }

    // 이미 결제된 주문인지 확인
    if (order.payment && order.payment.status === 'DONE') {
      return createErrorResponse(
        TOSS_ERROR_CODES.DUPLICATED_ORDER_ID,
        '이미 결제가 완료된 주문입니다',
        400
      )
    }

    // 금액 검증 (DB 저장된 금액과 비교)
    const dbAmount = Number(order.totalAmount)
    if (dbAmount !== amount) {
      console.error('금액 불일치:', { dbAmount, requestAmount: amount })
      return createErrorResponse(
        TOSS_ERROR_CODES.INVALID_REQUEST,
        `주문 금액(${dbAmount.toLocaleString()}원)과 결제 금액(${amount.toLocaleString()}원)이 일치하지 않습니다`,
        400
      )
    }

    // 3. TossPayments 결제 승인 API 호출
    const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')

    let tossResponse: Response
    let tossResult: any

    try {
      tossResponse = await fetch(TOSS_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount,
        }),
      })

      tossResult = await tossResponse.json()
    } catch (networkError: any) {
      console.error('TossPayments API 네트워크 오류:', networkError)
      return createErrorResponse(
        TOSS_ERROR_CODES.OTHER_DEFINITION_ERROR,
        '결제 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
        503
      )
    }

    // 토스 결제 승인 실패 처리
    if (!tossResponse.ok) {
      const tossError = tossResult as TossErrorResponse
      console.error('TossPayments 결제 승인 실패:', {
        code: tossError.code,
        message: tossError.message,
        orderId,
        paymentKey: paymentKey.substring(0, 20) + '...'
      })

      // 결제 실패 시 Payment 레코드 업데이트 (있는 경우)
      if (order.payment) {
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            status: 'ABORTED',
            cancelReason: tossError.message,
            rawResponse: JSON.stringify(tossResult),
          }
        })
      }

      return createTossErrorResponse(tossError)
    }

    // 4. 결제 승인 성공 → 트랜잭션으로 데이터 저장
    const result = await prisma.$transaction(async (tx) => {
      // 결제 정보 저장
      const virtualAccount = tossResult.virtualAccount || null

      const payment = await tx.payment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          paymentKey: tossResult.paymentKey,
          tossOrderId: tossResult.orderId,
          method: mapPaymentMethod(tossResult.method),
          status: mapPaymentStatus(tossResult.status),
          amount: new Decimal(tossResult.totalAmount),
          virtualAccountNumber: virtualAccount?.accountNumber || null,
          virtualAccountBank: virtualAccount?.bank || null,
          virtualAccountDueDate: virtualAccount?.dueDate ? new Date(virtualAccount.dueDate) : null,
          cardCompany: tossResult.card?.company || null,
          cardNumber: tossResult.card?.number || null,
          installmentMonth: tossResult.card?.installmentPlanMonths || 0,
          rawResponse: JSON.stringify(tossResult),
          approvedAt: tossResult.approvedAt ? new Date(tossResult.approvedAt) : new Date(),
        },
        update: {
          paymentKey: tossResult.paymentKey,
          method: mapPaymentMethod(tossResult.method),
          status: mapPaymentStatus(tossResult.status),
          amount: new Decimal(tossResult.totalAmount),
          virtualAccountNumber: virtualAccount?.accountNumber || null,
          virtualAccountBank: virtualAccount?.bank || null,
          virtualAccountDueDate: virtualAccount?.dueDate ? new Date(virtualAccount.dueDate) : null,
          cardCompany: tossResult.card?.company || null,
          cardNumber: tossResult.card?.number || null,
          installmentMonth: tossResult.card?.installmentPlanMonths || 0,
          rawResponse: JSON.stringify(tossResult),
          approvedAt: tossResult.approvedAt ? new Date(tossResult.approvedAt) : new Date(),
        },
      })

      // 주문 상태 업데이트
      // 가상계좌(WAITING_FOR_DEPOSIT)는 PENDING 유지, 나머지는 PAID
      const isVirtualAccount = tossResult.status === 'WAITING_FOR_DEPOSIT'
      const orderStatus = isVirtualAccount ? 'PENDING' : 'PAID'
      const paidAt = isVirtualAccount ? null : new Date()

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: orderStatus,
          paidAt,
        },
        include: {
          items: true,
          user: true,
        },
      })

      // 장바구니 비우기 (장바구니에서 주문한 경우)
      // 로그인 사용자: userId로 장바구니 찾기
      // 비로그인 사용자: sessionId로 장바구니 찾기
      const userId = updatedOrder.userId
      const sessionId = req.cookies.get('cart_session')?.value

      let cartToClear = null
      if (userId) {
        cartToClear = await tx.cart.findFirst({
          where: { userId },
        })
      }
      if (!cartToClear && sessionId) {
        cartToClear = await tx.cart.findFirst({
          where: { sessionId, userId: null },
        })
      }

      if (cartToClear) {
        await tx.cartItem.deleteMany({
          where: { cartId: cartToClear.id },
        })
      }

      return { order: updatedOrder, payment }
    })

    // 5. 성공 응답
    const processingTime = Date.now() - startTime
    console.log(`결제 승인 성공: ${orderId} (${processingTime}ms)`)

    const response = NextResponse.json({
      success: true,
      payment: {
        paymentKey: result.payment.paymentKey,
        orderId: result.order.orderNumber,
        amount: Number(result.payment.amount),
        method: result.payment.method,
        methodLabel: getPaymentMethodLabel(result.payment.method),
        status: result.payment.status,
        approvedAt: result.payment.approvedAt,
        card: tossResult.card ? {
          company: tossResult.card.company,
          number: tossResult.card.number,
          installmentPlanMonths: tossResult.card.installmentPlanMonths,
        } : null,
        virtualAccount: tossResult.virtualAccount ? {
          accountNumber: tossResult.virtualAccount.accountNumber,
          bank: tossResult.virtualAccount.bank,
          dueDate: tossResult.virtualAccount.dueDate,
        } : null,
      },
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        status: result.order.status,
        customer: {
          name: result.order.user.name,
          email: result.order.user.email,
          phone: result.order.user.phone,
        },
        quantity: result.order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        subtotal: Number(result.order.subtotalAmount),
        shippingFee: Number(result.order.shippingFee),
        discountAmount: Number(result.order.discountAmount),
        totalAmount: Number(result.order.totalAmount),
      },
    })

    // order_prepare 쿠키 삭제
    response.cookies.delete('order_prepare')

    return response
    } finally {
      // 처리 완료 후 Set에서 제거
      processingOrders.delete(orderId)
    }
  } catch (error: any) {
    console.error('Payment confirm error:', error)

    // 처리 완료 후 Set에서 제거
    processingOrders.delete(orderId)

    // Prisma 에러 처리
    if (error.code === 'P2002') {
      return createErrorResponse(
        TOSS_ERROR_CODES.DUPLICATED_ORDER_ID,
        '중복된 결제 요청입니다',
        400
      )
    }

    return createErrorResponse(
      TOSS_ERROR_CODES.FAILED_DB_PROCESSING,
      error.message || '결제 처리 중 오류가 발생했습니다',
      500
    )
  }
}

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
      }
    },
    { status }
  )
}

/**
 * 토스 에러 응답을 표준 형식으로 변환
 */
function createTossErrorResponse(tossError: TossErrorResponse) {
  const errorDetails = getErrorDetails(tossError.code)

  // 에러 코드에 따른 HTTP 상태 코드 결정
  let status = 400
  if (tossError.code === TOSS_ERROR_CODES.FAILED_DB_PROCESSING) {
    status = 503
  } else if (tossError.code === TOSS_ERROR_CODES.MAINTAINED_METHOD) {
    status = 503
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: tossError.code,
        message: errorDetails.message || tossError.message,
        solution: errorDetails.solution,
        isRetryable: errorDetails.isRetryable,
        isUserCancel: errorDetails.isUserCancel,
        isCardError: errorDetails.isCardError,
        isBalanceError: errorDetails.isBalanceError,
      }
    },
    { status }
  )
}

/**
 * TossPayments method를 DB enum으로 매핑
 */
function mapPaymentMethod(method: string): 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'MOBILE' | 'CULTURE_GIFT' | 'BOOK_GIFT' | 'GAME_GIFT' {
  const methodMap: Record<string, any> = {
    '카드': 'CARD',
    'CARD': 'CARD',
    '가상계좌': 'VIRTUAL_ACCOUNT',
    'VIRTUAL_ACCOUNT': 'VIRTUAL_ACCOUNT',
    '계좌이체': 'TRANSFER',
    'TRANSFER': 'TRANSFER',
    '휴대폰': 'MOBILE',
    'MOBILE': 'MOBILE',
    '문화상품권': 'CULTURE_GIFT',
    '도서문화상품권': 'BOOK_GIFT',
    '게임문화상품권': 'GAME_GIFT',
  }
  return methodMap[method] || 'CARD'
}

/**
 * TossPayments status를 DB enum으로 매핑
 */
function mapPaymentStatus(status: string): 'READY' | 'IN_PROGRESS' | 'WAITING_FOR_DEPOSIT' | 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED' {
  const statusMap: Record<string, any> = {
    'READY': 'READY',
    'IN_PROGRESS': 'IN_PROGRESS',
    'WAITING_FOR_DEPOSIT': 'WAITING_FOR_DEPOSIT',
    'DONE': 'DONE',
    'CANCELED': 'CANCELED',
    'PARTIAL_CANCELED': 'PARTIAL_CANCELED',
    'ABORTED': 'ABORTED',
    'EXPIRED': 'EXPIRED',
  }
  return statusMap[status] || 'READY'
}

/**
 * 결제 수단 라벨 가져오기
 */
function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    'CARD': '신용/체크카드',
    'VIRTUAL_ACCOUNT': '가상계좌',
    'TRANSFER': '계좌이체',
    'MOBILE': '휴대폰 결제',
    'CULTURE_GIFT': '문화상품권',
    'BOOK_GIFT': '도서문화상품권',
    'GAME_GIFT': '게임문화상품권',
  }
  return labels[method] || method
}
