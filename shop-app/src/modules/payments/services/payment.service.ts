/**
 * Payment Service
 * 결제 비즈니스 로직 레이어
 * ShopProduct 기반 주문과 연동
 */

import prisma, { Prisma } from '@bandauto/db'
import { getTossPaymentsService, TossPaymentResponse } from '@/modules/payments/services/toss-payments.service'
import {
  getOrderRepository,
  OrderRepository,
  OrderItemInput,
} from '@/modules/order/repository/order.repository'
import { getCartService, CartService } from '@/modules/cart/services/cart.service'
import {
  TOSS_ERROR_CODES,
  getErrorDetails,
} from '@/modules/payments/constants/toss-error-codes'
import {
  ValidationError,
  NotFoundError,
  BusinessLogicError,
} from '@/modules/common/utils/src/errors/handlers'
import { calculateItemPrice } from '@/lib/price-calculator'
import { sendPaymentCompletedWebhook, sendBankTransferOrderWebhook } from '@/services/order-webhook.service'

const Decimal = Prisma.Decimal

// ============================================
// Types
// ============================================

export interface OrderPrepareData {
  orderId: string
  userId: number
  shopId?: number | null
  fromCart: boolean
  items?: { shopProductId: number; variantId?: number; quantity: number }[]
  // 배송지 정보 (수령인)
  shippingAddress: {
    recipientName: string
    recipientPhone: string
    address: string
    postalCode: string
    addressDetail?: string
    deliveryMemo?: string
  }
  // 쿠폰 정보
  coupon?: {
    userCouponId: number
    discountAmount: number
    isFreeShipping: boolean
  }
  // 금액 정보 (prepare 단계에서 계산된 값 - confirm 시 재계산 방지)
  amounts?: {
    subtotal: number
    discountAmount: number
    totalAmount: number
  }
}

export interface ConfirmPaymentDTO {
  paymentKey: string
  orderId: string
  amount: number
  orderPrepareData: OrderPrepareData | null
  cartSessionId?: string
}

export interface ConfirmPaymentResult {
  success: boolean
  payment: {
    paymentKey: string
    orderId: string
    amount: number
    method: string
    methodLabel: string
    status: string
    approvedAt: Date | null
    card: any
    virtualAccount: any
  }
  order: {
    id: number
    orderNumber: string
    status: string
    customer: {
      name: string
      email: string
      phone: string | null
    }
    quantity: number
    subtotal: number
    discountAmount: number
    totalAmount: number
  }
}

// 진행 중인 결제 요청 추적 (메모리 기반 - 단일 서버 환경용)
const processingOrders = new Set<string>()

/**
 * Payment Service
 */
export class PaymentService {
  constructor(
    private orderRepository: OrderRepository = getOrderRepository(),
    private cartService: CartService = getCartService()
  ) {}

  /**
   * 결제 승인 (주문 생성 + Toss 결제 승인)
   */
  async confirmPaymentWithOrder(data: ConfirmPaymentDTO): Promise<ConfirmPaymentResult> {
    const { paymentKey, orderId, amount, orderPrepareData, cartSessionId } = data

    // 1. 입력 검증
    if (!paymentKey || !orderId || amount === undefined) {
      throw new ValidationError('필수 파라미터가 누락되었습니다 (paymentKey, orderId, amount)')
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new ValidationError('결제 금액이 올바르지 않습니다')
    }

    // 2. 중복 요청 방지 체크
    if (processingOrders.has(orderId)) {
      throw new BusinessLogicError('결제가 이미 처리 중입니다. 잠시 후 확인해주세요.')
    }

    processingOrders.add(orderId)

    try {
      // 3. DB에서 기존 주문 확인
      let order = await this.orderRepository.findByOrderNumber(orderId)

      // 주문이 없으면 쿠키 데이터로 주문 생성
      if (!order) {
        if (!orderPrepareData || orderPrepareData.orderId !== orderId) {
          throw new NotFoundError('주문', orderId)
        }

        order = await this.createOrderFromPrepareData(orderPrepareData)
        if (!order) {
          throw new BusinessLogicError('주문 생성에 실패했습니다')
        }
        console.log(`주문 생성 완료: ${order.orderNumber}`)
      }

      // 이미 결제된 주문인지 확인
      if (order.payment && order.payment.status === 'DONE') {
        throw new BusinessLogicError('이미 결제가 완료된 주문입니다')
      }

      // 금액 검증 (DB 저장된 금액과 비교)
      const dbAmount = Number(order.totalAmount)
      if (dbAmount !== amount) {
        console.error('금액 불일치:', { dbAmount, requestAmount: amount })
        throw new ValidationError(
          `주문 금액(${dbAmount.toLocaleString()}원)과 결제 금액(${amount.toLocaleString()}원)이 일치하지 않습니다`
        )
      }

      // 4. TossPayments 결제 승인 API 호출
      const tossService = await getTossPaymentsService()
      let tossResult: TossPaymentResponse

      try {
        tossResult = await tossService.confirmPayment({
          paymentKey,
          orderId,
          amount,
        })
      } catch (error: any) {
        // 결제 실패 시 Payment 레코드 업데이트 (있는 경우)
        if (order.payment) {
          await prisma.payment.update({
            where: { id: order.payment.id },
            data: {
              status: 'ABORTED',
              cancelReason: error.message,
            },
          })
        }
        throw error
      }

      // 5. 결제 승인 성공 → 트랜잭션으로 데이터 저장
      const result = await prisma.$transaction(async (tx) => {
        const virtualAccount = tossResult.virtualAccount || null

        // 결제 정보 저장
        const payment = await tx.payment.upsert({
          where: { orderId: order!.id },
          create: {
            orderId: order!.id,
            paymentKey: tossResult.paymentKey,
            tossOrderId: tossResult.orderId,
            method: this.mapPaymentMethod(tossResult.method),
            status: this.mapPaymentStatus(tossResult.status),
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
            method: this.mapPaymentMethod(tossResult.method),
            status: this.mapPaymentStatus(tossResult.status),
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
        const isVirtualAccount = tossResult.status === 'WAITING_FOR_DEPOSIT'
        const orderStatus = isVirtualAccount ? 'PENDING' : 'PAID'
        const paidAt = isVirtualAccount ? null : new Date()

        const updatedOrder = await tx.order.update({
          where: { id: order!.id },
          data: {
            status: orderStatus as any,
            paidAt,
          },
          include: {
            items: true,
            user: true,
          },
        })

        // 장바구니 비우기
        const userId = updatedOrder.userId

        let cartToClear = null
        if (userId) {
          cartToClear = await tx.cart.findFirst({
            where: { userId },
          })
        }
        if (!cartToClear && cartSessionId) {
          cartToClear = await tx.cart.findFirst({
            where: { sessionId: cartSessionId, userId: null },
          })
        }

        if (cartToClear) {
          await tx.cartItem.deleteMany({
            where: { cartId: cartToClear.id },
          })
        }

        // 쿠폰 사용 처리 (결제 완료 시에만)
        if (!isVirtualAccount && orderPrepareData?.coupon?.userCouponId) {
          await tx.userCoupon.update({
            where: { id: orderPrepareData.coupon.userCouponId },
            data: {
              isUsed: true,
              usedAt: new Date(),
              orderId: order!.id,
            },
          })
          console.log(`쿠폰 사용 처리 완료: userCouponId=${orderPrepareData.coupon.userCouponId}`)
        }

        return { order: updatedOrder, payment, tossResult }
      })

      console.log(`결제 승인 성공: ${orderId}`)

      // 외부 웹훅 알림 (슬랙/디스코드)
      if (result.tossResult.status === 'WAITING_FOR_DEPOSIT') {
        // 무통장입금(가상계좌) - 주문 등록 알림
        sendBankTransferOrderWebhook({
          orderNumber: result.order.orderNumber,
          customerName: result.order.user?.name || '고객',
          totalAmount: Number(result.order.totalAmount),
          items: result.order.items.map((item: any) => ({
            name: item.productName,
            quantity: item.quantity,
          })),
          bankName: result.tossResult.virtualAccount?.bank,
          accountNumber: result.tossResult.virtualAccount?.accountNumber,
          dueDate: result.tossResult.virtualAccount?.dueDate,
        })
      } else {
        // 즉시 결제 완료 (카드, 계좌이체 등)
        sendPaymentCompletedWebhook({
          orderNumber: result.order.orderNumber,
          customerName: result.order.user?.name || '고객',
          totalAmount: Number(result.order.totalAmount),
          items: result.order.items.map((item: any) => ({
            name: item.productName,
            quantity: item.quantity,
          })),
          paymentMethod: this.getPaymentMethodLabel(result.payment.method),
        })
      }

      return {
        success: true,
        payment: {
          paymentKey: result.payment.paymentKey,
          orderId: result.order.orderNumber,
          amount: Number(result.payment.amount),
          method: result.payment.method,
          methodLabel: this.getPaymentMethodLabel(result.payment.method),
          status: result.payment.status,
          approvedAt: result.payment.approvedAt,
          card: result.tossResult.card
            ? {
                company: result.tossResult.card.company,
                number: result.tossResult.card.number,
                installmentPlanMonths: result.tossResult.card.installmentPlanMonths,
              }
            : null,
          virtualAccount: result.tossResult.virtualAccount
            ? {
                accountNumber: result.tossResult.virtualAccount.accountNumber,
                bank: result.tossResult.virtualAccount.bank,
                dueDate: result.tossResult.virtualAccount.dueDate,
              }
            : null,
        },
        order: {
          id: result.order.id,
          orderNumber: result.order.orderNumber,
          status: result.order.status,
          // 주문자 정보 (user 테이블에서)
          customer: {
            name: result.order.user?.name || '고객',
            email: result.order.user?.email || '',
            phone: result.order.user?.phone || '',
          },
          quantity: result.order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          subtotal: Number(result.order.subtotalAmount),
          discountAmount: Number(result.order.discountAmount),
          totalAmount: Number(result.order.totalAmount),
        },
      }
    } finally {
      processingOrders.delete(orderId)
    }
  }

  /**
   * 주문 준비 데이터로 주문 생성
   */
  private async createOrderFromPrepareData(prepareData: OrderPrepareData): Promise<any> {
    let orderItems: OrderItemInput[] = []

    if (prepareData.fromCart) {
      // 장바구니에서 주문 아이템 조회
      const cart = await this.cartService.getCartByUserId(prepareData.userId, prepareData.shopId ?? null)

      if (!cart || cart.items.length === 0) {
        throw new BusinessLogicError('장바구니가 비어있습니다')
      }

      orderItems = cart.items.map((item: any) => {
        const shopProduct = item.shopProduct
        const product = shopProduct.product
        const variant = item.variant
        const mainVariant = product?.variants[0]
        const basePrice = variant?.price || mainVariant?.price || 0
        const quantity = item.quantity

        // 배송비 포함된 가격 계산
        const shippingFee = product?.shippingFee || 0
        const bundleMaxQty = product?.bundleMaxQty || 1
        const bundleUnit = variant?.bundleUnit || 1

        const priceResult = calculateItemPrice({
          basePrice,
          shippingFee,
          quantity,
          bundleMaxQty,
          bundleUnit,
          bundleShippingType: product?.bundleShippingType || null,
        })

        return {
          shopProductId: shopProduct.id,
          variantId: variant?.id || null,
          productName: product?.name || "",
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product?.thumbnailUrl || null,
          quantity,
          unitPrice: priceResult.unitPrice, // 배송비 포함된 단가
          itemTotal: priceResult.itemTotal, // 합배송 적용된 총액
        }
      })
    } else if (prepareData.items) {
      // 직접 지정 상품
      for (const item of prepareData.items) {
        const shopProduct = await prisma.shopProduct.findFirst({
          where: {
            id: item.shopProductId,
          },
          include: {
            product: {
              include: { variants: true },
            },
          },
        })

        if (!shopProduct) {
          throw new NotFoundError('상품', String(item.shopProductId))
        }

        let variant = null
        if (item.variantId) {
          variant = await prisma.productVariant.findUnique({
            where: { id: item.variantId },
          })
        }

        const product = shopProduct.product
        const mainVariant = product?.variants[0]
        const basePrice = variant?.price || mainVariant?.price || 0
        const quantity = item.quantity || 1

        // 배송비 포함된 가격 계산
        const shippingFee = product?.shippingFee || 0
        const bundleMaxQty = product?.bundleMaxQty || 1
        const bundleUnit = variant?.bundleUnit || 1

        const priceResult = calculateItemPrice({
          basePrice,
          shippingFee,
          quantity,
          bundleMaxQty,
          bundleUnit,
          bundleShippingType: product?.bundleShippingType || null,
        })

        orderItems.push({
          shopProductId: shopProduct.id,
          variantId: variant?.id || null,
          productName: product?.name || "",
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product?.thumbnailUrl || null,
          quantity,
          unitPrice: priceResult.unitPrice, // 배송비 포함된 단가
          itemTotal: priceResult.itemTotal, // 합배송 적용된 총액
        })
      }
    }

    // 금액 정보: prepareData에 저장된 값 우선 사용 (금액 불일치 방지)
    let subtotal: number
    let discountAmount: number
    let totalAmount: number

    if (prepareData.amounts) {
      // prepare 단계에서 계산된 금액 사용 (권장)
      subtotal = prepareData.amounts.subtotal
      discountAmount = prepareData.amounts.discountAmount
      totalAmount = prepareData.amounts.totalAmount
      console.log('주문 금액 (prepareData에서 로드):', { subtotal, discountAmount, totalAmount })
    } else {
      // 레거시: prepareData에 금액 정보 없으면 재계산 (하위 호환)
      console.warn('주문 금액 재계산 (prepareData.amounts 없음)')
      subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

      // 쿠폰 할인 금액 적용
      discountAmount = 0
      if (prepareData.coupon && !prepareData.coupon.isFreeShipping) {
        discountAmount = prepareData.coupon.discountAmount
      }

      totalAmount = subtotal - discountAmount
    }

    // 주문 생성 (주문자 정보는 user 테이블에서, 수령인 정보는 shippingAddress에)
    const order = await prisma.order.create({
      data: {
        userId: prepareData.userId,
        shopId: prepareData.shopId ?? null,
        orderNumber: prepareData.orderId,
        status: 'PENDING',
        // 금액 정보
        subtotalAmount: new Decimal(subtotal),
        discountAmount: new Decimal(discountAmount),
        totalAmount: new Decimal(totalAmount),
        items: {
          create: orderItems.map((item: any) => ({
            shopProductId: item.shopProductId,
            variantId: item.variantId,
            productName: item.productName,
            optionSummary: item.optionSummary,
            thumbnailUrl: item.thumbnailUrl,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            // itemTotal이 있으면 사용 (합배송 적용된 정확한 총액), 없으면 계산
            totalPrice: new Decimal(item.itemTotal ?? (item.unitPrice * item.quantity)),
          })),
        },
        // 배송지 정보 (수령인 - ShippingAddress 테이블에 저장)
        shippingAddress: {
          create: {
            recipientName: prepareData.shippingAddress.recipientName,
            recipientPhone: prepareData.shippingAddress.recipientPhone,
            postalCode: prepareData.shippingAddress.postalCode,
            address: prepareData.shippingAddress.address,
            addressDetail: prepareData.shippingAddress.addressDetail || null,
            deliveryMemo: prepareData.shippingAddress.deliveryMemo || null,
          },
        },
      },
      include: {
        payment: true,
        user: true,
        items: true,
        shop: true,
        shippingAddress: true,
      },
    })

    return order
  }

  /**
   * 에러 응답 생성을 위한 에러 정보
   */
  getErrorInfo(code: string) {
    return getErrorDetails(code)
  }

  /**
   * TossPayments method를 DB enum으로 매핑
   */
  private mapPaymentMethod(
    method: string
  ): 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'MOBILE' | 'CULTURE_GIFT' | 'BOOK_GIFT' | 'GAME_GIFT' {
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
  private mapPaymentStatus(
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
  private getPaymentMethodLabel(method: string): string {
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
}

// Singleton 인스턴스
export const paymentService = new PaymentService()

// Factory function
export function getPaymentService(): PaymentService {
  return paymentService
}
