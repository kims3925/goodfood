export const dynamic = 'force-dynamic'

/**
 * Guest Payment Confirm API
 * 비회원 TossPayments 결제 승인
 * GuestOrder + GuestPayment 생성
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import prisma, { Prisma } from '@bandauto/db'
import { getTossPaymentsService, TossPaymentResponse } from '@/modules/payments/services/toss-payments.service'
import { generateGuestAccessToken } from '@/lib/guest-token'
import {
  TOSS_ERROR_CODES,
  getErrorDetails,
} from '@/modules/payments/constants/toss-error-codes'

const Decimal = Prisma.Decimal

// 진행 중인 결제 요청 추적 (메모리 기반)
const processingOrders = new Set<string>()

interface GuestOrderPrepareData {
  orderId: string
  shopId: number | null
  fromCart: boolean
  items?: { publishedProductId: number; variantId?: number; quantity: number }[]
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

// 세션 ID 가져오기
function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
}

// 요청 헤더에서 Shop ID 가져오기
async function getShopIdFromHeaders(): Promise<number | null> {
  const headersList = await headers()
  const shopId = headersList.get('x-shop-id')
  return shopId ? parseInt(shopId) : null
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
      },
    },
    { status }
  )
}

/**
 * TossPayments method를 DB enum으로 매핑
 */
function mapPaymentMethod(
  method: string
): 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'MOBILE' | 'CULTURE_GIFT' | 'BOOK_GIFT' | 'GAME_GIFT' | 'BANK_TRANSFER' {
  const methodMap: Record<string, any> = {
    카드: 'CARD',
    CARD: 'CARD',
    가상계좌: 'VIRTUAL_ACCOUNT',
    VIRTUAL_ACCOUNT: 'VIRTUAL_ACCOUNT',
    계좌이체: 'TRANSFER',
    TRANSFER: 'TRANSFER',
    휴대폰: 'MOBILE',
    MOBILE: 'MOBILE',
    문화상품권: 'CULTURE_GIFT',
    도서문화상품권: 'BOOK_GIFT',
    게임문화상품권: 'GAME_GIFT',
  }
  return methodMap[method] || 'CARD'
}

/**
 * TossPayments status를 DB enum으로 매핑
 */
function mapPaymentStatus(
  status: string
):
  | 'READY'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_DEPOSIT'
  | 'DONE'
  | 'CANCELED'
  | 'PARTIAL_CANCELED'
  | 'ABORTED'
  | 'EXPIRED' {
  const statusMap: Record<string, any> = {
    READY: 'READY',
    IN_PROGRESS: 'IN_PROGRESS',
    WAITING_FOR_DEPOSIT: 'WAITING_FOR_DEPOSIT',
    DONE: 'DONE',
    CANCELED: 'CANCELED',
    PARTIAL_CANCELED: 'PARTIAL_CANCELED',
    ABORTED: 'ABORTED',
    EXPIRED: 'EXPIRED',
  }
  return statusMap[status] || 'READY'
}

/**
 * 결제 수단 라벨 가져오기
 */
function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    CARD: '신용/체크카드',
    VIRTUAL_ACCOUNT: '가상계좌',
    TRANSFER: '계좌이체',
    MOBILE: '휴대폰 결제',
    CULTURE_GIFT: '문화상품권',
    BOOK_GIFT: '도서문화상품권',
    GAME_GIFT: '게임문화상품권',
  }
  return labels[method] || method
}

/**
 * POST /api/guest-payments/confirm
 * 비회원 결제 승인 요청
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

    // 비회원 주문번호 형식 확인 (GORD- prefix)
    if (!orderId.startsWith('GORD-')) {
      return createErrorResponse(
        TOSS_ERROR_CODES.INVALID_REQUEST,
        '비회원 주문번호 형식이 올바르지 않습니다',
        400
      )
    }

    // 2. 중복 요청 방지 체크
    if (processingOrders.has(orderId)) {
      return createErrorResponse(
        'ALREADY_PROCESSING',
        '결제가 이미 처리 중입니다. 잠시 후 확인해주세요.',
        409
      )
    }

    processingOrders.add(orderId)

    try {
      // 3. 쿠키에서 비회원 주문 준비 데이터 확인
      const guestOrderPrepareCookie = req.cookies.get('guest_order_prepare')?.value
      let prepareData: GuestOrderPrepareData | null = null

      if (guestOrderPrepareCookie) {
        try {
          const decodedData = Buffer.from(guestOrderPrepareCookie, 'base64').toString('utf-8')
          prepareData = JSON.parse(decodedData)
        } catch (e) {
          console.error('비회원 주문 준비 데이터 파싱 실패:', e)
        }
      }

      if (!prepareData || prepareData.orderId !== orderId) {
        return createErrorResponse(
          TOSS_ERROR_CODES.INVALID_REQUEST,
          '주문 정보를 찾을 수 없습니다. 다시 결제를 시도해주세요.',
          404
        )
      }

      // 4. 세션 ID 및 Shop ID 가져오기
      const sessionId = getSessionId(req)
      const shopId = prepareData.shopId || await getShopIdFromHeaders()

      // 5. 주문 아이템 조회
      let orderItems: any[] = []

      if (prepareData.fromCart) {
        if (!sessionId) {
          return createErrorResponse(
            TOSS_ERROR_CODES.INVALID_REQUEST,
            '장바구니 정보를 찾을 수 없습니다',
            400
          )
        }

        const cart = await prisma.cart.findFirst({
          where: { sessionId, userId: null, shopId },
          include: {
            items: {
              include: {
                publishedProduct: {
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
          const publishedProduct = item.publishedProduct
          const product = publishedProduct.product
          const variant = item.variant
          const mainVariant = product?.variants[0]
          const unitPrice = variant?.price || mainVariant?.price || 0

          return {
            publishedProductId: publishedProduct.id,
            variantId: variant?.id || null,
            productName: product?.name || '',
            optionSummary: variant?.optionSummary || null,
            thumbnailUrl: product?.thumbnailUrl || null,
            quantity: item.quantity,
            unitPrice: Number(unitPrice),
            cartId: cart.id,
          }
        })
      } else if (prepareData.items) {
        for (const item of prepareData.items) {
          const publishedProduct = await prisma.publishedProduct.findFirst({
            where: { id: item.publishedProductId },
            include: {
              product: {
                include: { variants: { take: 1 } },
              },
            },
          })

          if (!publishedProduct) {
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

          const product = publishedProduct.product
          const mainVariant = product?.variants[0]
          const unitPrice = variant?.price || mainVariant?.price || 0

          orderItems.push({
            publishedProductId: publishedProduct.id,
            variantId: variant?.id || null,
            productName: product?.name || '',
            optionSummary: variant?.optionSummary || null,
            thumbnailUrl: product?.thumbnailUrl || null,
            quantity: item.quantity || 1,
            unitPrice: Number(unitPrice),
          })
        }
      }

      // 6. 금액 계산 및 검증
      const subtotal = orderItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      )

      // 배송비는 상품별 설정 또는 0원 처리
      const shippingFee = 0

      const totalAmount = subtotal + shippingFee

      if (totalAmount !== amount) {
        console.error('금액 불일치:', { calculatedAmount: totalAmount, requestAmount: amount })
        return createErrorResponse(
          TOSS_ERROR_CODES.INVALID_REQUEST,
          `주문 금액(${totalAmount.toLocaleString()}원)과 결제 금액(${amount.toLocaleString()}원)이 일치하지 않습니다`,
          400
        )
      }

      // 7. TossPayments 결제 승인 API 호출
      const tossService = await getTossPaymentsService()
      let tossResult: TossPaymentResponse

      try {
        tossResult = await tossService.confirmPayment({
          paymentKey,
          orderId,
          amount,
        })
      } catch (error: any) {
        console.error('토스 결제 승인 실패:', error)
        return createErrorResponse(
          error.code || TOSS_ERROR_CODES.UNKNOWN_ERROR,
          error.message || '결제 승인에 실패했습니다',
          400
        )
      }

      // 8. 결제 승인 성공 → 트랜잭션으로 GuestOrder + GuestPayment 생성
      const result = await prisma.$transaction(async (tx) => {
        // GuestOrder 생성
        const guestOrder = await tx.guestOrder.create({
          data: {
            shopId,
            orderNumber: orderId,
            status: tossResult.status === 'WAITING_FOR_DEPOSIT' ? 'PENDING' : 'PAID',
            // 비회원 주문자 정보
            guestName: prepareData!.customerInfo.name,
            guestPhone: prepareData!.customerInfo.phone,
            guestEmail: prepareData!.customerInfo.email || null,
            // 금액 정보
            subtotalAmount: new Decimal(subtotal),
            shippingFee: new Decimal(shippingFee),
            discountAmount: new Decimal(0),
            totalAmount: new Decimal(totalAmount),
            paidAt: tossResult.status === 'WAITING_FOR_DEPOSIT' ? null : new Date(),
            items: {
              create: orderItems.map((item) => ({
                publishedProductId: item.publishedProductId,
                variantId: item.variantId,
                productName: item.productName,
                optionSummary: item.optionSummary,
                thumbnailUrl: item.thumbnailUrl,
                quantity: item.quantity,
                unitPrice: new Decimal(item.unitPrice),
                totalPrice: new Decimal(item.unitPrice * item.quantity),
              })),
            },
            // 배송지 정보
            shippingAddress: {
              create: {
                recipientName: prepareData!.shippingAddress.recipientName,
                recipientPhone: prepareData!.shippingAddress.recipientPhone,
                postalCode: prepareData!.shippingAddress.postalCode,
                address: prepareData!.shippingAddress.address,
                addressDetail: prepareData!.shippingAddress.addressDetail || null,
                deliveryMemo: prepareData!.shippingAddress.deliveryMemo || null,
              },
            },
          },
          include: {
            items: true,
            shippingAddress: true,
          },
        })

        // GuestPayment 생성
        const virtualAccount = tossResult.virtualAccount || null
        const guestPayment = await tx.guestPayment.create({
          data: {
            guestOrderId: guestOrder.id,
            paymentKey: tossResult.paymentKey,
            tossOrderId: tossResult.orderId,
            method: mapPaymentMethod(tossResult.method),
            status: mapPaymentStatus(tossResult.status),
            amount: new Decimal(tossResult.totalAmount),
            // 가상계좌 정보
            virtualAccountNumber: virtualAccount?.accountNumber || null,
            virtualAccountBank: virtualAccount?.bank || null,
            virtualAccountDueDate: virtualAccount?.dueDate ? new Date(virtualAccount.dueDate) : null,
            // 카드 정보
            cardCompany: tossResult.card?.company || null,
            cardNumber: tossResult.card?.number || null,
            installmentMonth: tossResult.card?.installmentPlanMonths || 0,
            rawResponse: JSON.stringify(tossResult),
            approvedAt: tossResult.approvedAt ? new Date(tossResult.approvedAt) : new Date(),
          },
        })

        // 장바구니 비우기 (fromCart인 경우)
        if (prepareData!.fromCart && orderItems[0]?.cartId) {
          await tx.cartItem.deleteMany({
            where: { cartId: orderItems[0].cartId },
          })
        }

        return { guestOrder, guestPayment }
      })

      // 비회원 접근 토큰 발급
      const accessToken = generateGuestAccessToken(
        result.guestOrder.id,
        prepareData.customerInfo.phone,
        result.guestOrder.orderNumber
      )

      console.log(`비회원 결제 승인 성공: ${orderId}`)

      // 응답 생성
      const response = NextResponse.json({
        success: true,
        payment: {
          paymentKey: result.guestPayment.paymentKey,
          orderId: result.guestOrder.orderNumber,
          amount: Number(result.guestPayment.amount),
          method: result.guestPayment.method,
          methodLabel: getPaymentMethodLabel(result.guestPayment.method),
          status: result.guestPayment.status,
          approvedAt: result.guestPayment.approvedAt,
          card: tossResult.card
            ? {
                company: tossResult.card.company,
                number: tossResult.card.number,
                installmentPlanMonths: tossResult.card.installmentPlanMonths,
              }
            : null,
          virtualAccount: tossResult.virtualAccount
            ? {
                accountNumber: tossResult.virtualAccount.accountNumber,
                bank: tossResult.virtualAccount.bank,
                dueDate: tossResult.virtualAccount.dueDate,
              }
            : null,
        },
        order: {
          id: result.guestOrder.id,
          orderNumber: result.guestOrder.orderNumber,
          status: result.guestOrder.status,
          customer: {
            name: result.guestOrder.guestName,
            email: result.guestOrder.guestEmail || '',
            phone: result.guestOrder.guestPhone,
          },
          quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: Number(result.guestOrder.subtotalAmount),
          shippingFee: Number(result.guestOrder.shippingFee),
          discountAmount: Number(result.guestOrder.discountAmount),
          totalAmount: Number(result.guestOrder.totalAmount),
        },
        accessToken,
        expiresIn: 3600, // 1시간
      })

      // guest_order_prepare 쿠키 삭제
      response.cookies.delete('guest_order_prepare')

      return response
    } finally {
      processingOrders.delete(orderId)
    }
  } catch (error: any) {
    console.error('Guest payment confirm error:', error)

    // Prisma 에러 처리
    if (error.code === 'P2002') {
      return createErrorResponse(TOSS_ERROR_CODES.DUPLICATED_ORDER_ID, '중복된 결제 요청입니다', 400)
    }

    return createErrorResponse(
      TOSS_ERROR_CODES.FAILED_DB_PROCESSING,
      error.message || '결제 처리 중 오류가 발생했습니다',
      500
    )
  }
}
