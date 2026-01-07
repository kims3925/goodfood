/**
 * Order Service
 * 주문 비즈니스 로직 레이어
 * PublishedProduct 기반 스키마 지원
 */

import prisma from '@bandauto/db'
import {
  getOrderRepository,
  OrderRepository,
  CreateOrderInput,
  OrderItemInput,
  OrderWithRelations,
} from '@/modules/order/repository/order.repository'
import { getCartService, CartService } from '@/modules/cart/services/cart.service'
import {
  ValidationError,
  NotFoundError,
  BusinessLogicError,
} from '@/modules/common/utils/src/errors/handlers'
import {
  createOrderNotification,
  createCancelNotification,
} from '@/services/notification.service'

// ============================================
// Types
// ============================================

export interface ShippingAddress {
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail?: string
  deliveryMemo?: string
}

export interface OrderItem {
  publishedProductId: number
  variantId?: number
  quantity: number
}

export interface CreateOrderFromCartDTO {
  userId: number
  shopId?: number  // Shop 기반 주문 필터링
  shopSlug?: string  // 경로 기반 결제 콜백 URL용
  shippingAddress: ShippingAddress
}

export interface CreateOrderFromItemsDTO {
  userId: number
  shopId?: number  // Shop 기반 주문 필터링
  shopSlug?: string  // 경로 기반 결제 콜백 URL용
  items: OrderItem[]
  shippingAddress: ShippingAddress
}

export interface OrderResponse {
  id: number
  orderNumber: string
  status: string
  // 주문자 정보 (회원 user 테이블에서)
  customer: {
    name: string
    phone: string | null
    email: string
  }
  // 배송지 정보 (수령인 - shippingAddress 테이블에서)
  shippingAddress: {
    recipientName: string
    recipientPhone: string
    postalCode: string
    address: string
    addressDetail: string | null
    deliveryMemo: string | null
  } | null
  subtotalAmount: number
  shippingFee: number
  discountAmount: number
  totalAmount: number
  items: Array<{
    productName: string
    optionSummary: string | null
    thumbnailUrl: string | null
    quantity: number
    unitPrice: number
    totalPrice: number
    channel?: { id: number; name: string } | null
    // 하위 호환성
    retailBand?: { id: number; name: string } | null
  }>
  payment: {
    status: string
    method: string
    approvedAt: Date | null
  } | null
  orderedAt: Date
  paidAt: Date | null
  shippedAt: Date | null
  deliveredAt: Date | null
}

export interface PaymentRequestData {
  orderId: string
  orderName: string
  amount: number
  customerName: string  // user.name
  customerEmail: string // user.email
  successUrl: string
  failUrl: string
}

/**
 * Order Service
 */
export class OrderService {
  constructor(
    private orderRepository: OrderRepository = getOrderRepository(),
    private cartService: CartService = getCartService()
  ) {}

  /**
   * 주문번호 생성
   */
  generateOrderNumber(): string {
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `ORD-${dateStr}-${random}`
  }

  /**
   * 장바구니에서 주문 생성
   */
  async createOrderFromCart(data: CreateOrderFromCartDTO): Promise<{
    order: OrderResponse
    payment: PaymentRequestData
  }> {
    const { userId, shopId, shopSlug, shippingAddress } = data

    // 입력 검증
    this.validateShippingAddress(shippingAddress)

    // 사용자 조회 (주문자 정보)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundError('사용자', String(userId))
    }

    // 장바구니 조회
    const cart = await this.cartService.getCartByUserId(userId, shopId ?? null)

    if (!cart || cart.items.length === 0) {
      throw new BusinessLogicError('장바구니가 비어있습니다')
    }

    // 주문 아이템 데이터 준비
    // cart.items에는 formatCart에서 계산된 itemTotal(할인 반영)이 포함됨
    const orderItems: OrderItemInput[] = cart.items.map((item: any) => {
      const publishedProduct = item.publishedProduct
      const product = publishedProduct?.product
      const variant = item.variant
      const mainVariant = product?.variants?.[0]

      // 원래 단가 (할인 전)
      const originalUnitPrice = Number(item.originalPrice || variant?.price || mainVariant?.price || 0)

      // 도매가 스냅샷 (마진 계산용)
      const wholesalePrice = variant?.wholesalePrice ?? mainVariant?.wholesalePrice ?? null
      const wholesalePriceValue = wholesalePrice == null ? null : Number(wholesalePrice)

      // 할인 반영된 총액과 단가
      const itemTotalWithDiscount = Number(item.itemTotal || originalUnitPrice * item.quantity)
      const unitPriceWithDiscount = Math.round(itemTotalWithDiscount / item.quantity)

      // variant가 있으면 해당 옵션 사용, 없으면 첫 번째 variant의 옵션 사용
      const optionSummary = item.optionSummary || variant?.optionSummary || mainVariant?.optionSummary || null

      return {
        publishedProductId: publishedProduct?.id || item.publishedProductId,
        variantId: variant?.id || item.variantId || null,
        productName: item.name || product?.name || "",
        optionSummary,
        thumbnailUrl: product?.thumbnailUrl || null,
        quantity: item.quantity,
        unitPrice: unitPriceWithDiscount, // 할인 반영된 단가
        wholesalePrice: wholesalePriceValue, // 도매가 스냅샷 (마진 계산용)
        originalUnitPrice, // 할인 전 단가 (참조용)
        itemTotal: itemTotalWithDiscount, // 할인 반영된 아이템 총액
      }
    })

    // 금액 계산
    // subtotalBeforeDiscount: 할인 전 총액 (원래 단가 × 수량)
    // subtotal: 할인 후 총액 (장바구니에서 계산된 값)
    const subtotalBeforeDiscount = orderItems.reduce(
      (sum, item) => sum + (item.originalUnitPrice || item.unitPrice) * item.quantity,
      0
    )
    const subtotal = orderItems.reduce(
      (sum, item) => sum + (item.itemTotal || item.unitPrice * item.quantity),
      0
    )
    const shippingFee = 0 // 배송비는 판매가에 포함
    const discountAmount = subtotalBeforeDiscount - subtotal // 할인 금액 계산
    const totalAmount = subtotal // 할인 반영된 총액

    // 주문 생성 (주문자 정보는 user 테이블에서)
    const orderInput: CreateOrderInput = {
      userId,
      shopId,
      orderNumber: this.generateOrderNumber(),
      // 배송지 정보 (수령인)
      shippingAddress: {
        recipientName: shippingAddress.recipientName,
        recipientPhone: shippingAddress.recipientPhone,
        postalCode: shippingAddress.postalCode,
        address: shippingAddress.address,
        addressDetail: shippingAddress.addressDetail,
        deliveryMemo: shippingAddress.deliveryMemo,
      },
      subtotalAmount: subtotalBeforeDiscount, // 할인 전 상품 총액
      shippingFee,
      discountAmount, // 합배송 할인 금액
      totalAmount, // 실제 결제 금액 (할인 후)
      items: orderItems,
    }

    const order = await this.orderRepository.create(orderInput)

    // 알림 생성 (shopId가 있는 경우에만 - 샵 소유자에게 알림)
    if (shopId) {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { userId: true },
      })
      if (shop?.userId) {
        createOrderNotification(shop.userId, shopId, {
          id: order.id,
          orderNumber: order.orderNumber,
          totalAmount,
          customerName: shippingAddress.recipientName,
        })
      }
    }

    // TossPayments 결제 요청 정보 생성 (주문자 정보는 user에서)
    // 경로 기반 URL: /{shopSlug}/payment/success
    const baseUrl = process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'localhost:3000'
    const protocol = baseUrl.includes('localhost') ? 'http' : 'https'
    const shopPath = shopSlug ? `/${shopSlug}` : ''

    const paymentRequest: PaymentRequestData = {
      orderId: order.orderNumber,
      orderName:
        orderItems.length > 1
          ? `${orderItems[0].productName} 외 ${orderItems.length - 1}건`
          : orderItems[0].productName,
      amount: totalAmount,
      customerName: user.name || '고객',
      customerEmail: user.email || '',
      successUrl: `${protocol}://${baseUrl}${shopPath}/payment/success`,
      failUrl: `${protocol}://${baseUrl}${shopPath}/payment/fail`,
    }

    return {
      order: this.formatOrderResponse(order),
      payment: paymentRequest,
    }
  }

  /**
   * 직접 상품 지정하여 주문 생성 (상품 상세페이지에서 바로 구매)
   */
  async createOrderFromItems(data: CreateOrderFromItemsDTO): Promise<{
    order: OrderResponse
    payment: PaymentRequestData
  }> {
    const { userId, shopId, shopSlug, items, shippingAddress } = data

    // 입력 검증
    this.validateShippingAddress(shippingAddress)

    if (!items || items.length === 0) {
      throw new ValidationError('주문 상품이 없습니다')
    }

    // 사용자 조회 (주문자 정보)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundError('사용자', String(userId))
    }

    // 상품 정보 조회 및 주문 아이템 준비
    const orderItems: OrderItemInput[] = []

    for (const item of items) {
      const publishedProduct = await prisma.publishedProduct.findFirst({
        where: {
          id: item.publishedProductId,
        },
        include: {
          product: {
            include: {
              variants: {
                take: 1,
                select: { id: true, price: true, wholesalePrice: true, optionSummary: true },
              },
            },
          },
        },
      })

      if (!publishedProduct) {
        throw new NotFoundError('상품', String(item.publishedProductId))
      }

      let variant = null
      if (item.variantId) {
        variant = await prisma.productVariant.findUnique({
          where: { id: item.variantId },
          select: { id: true, price: true, wholesalePrice: true, optionSummary: true },
        })
      }

      const product = publishedProduct.product
      const mainVariant = product?.variants[0]
      const unitPrice = variant?.price || mainVariant?.price || 0
      // 도매가 스냅샷 (마진 계산용)
      const wholesalePrice = variant?.wholesalePrice ?? mainVariant?.wholesalePrice ?? null
      const wholesalePriceValue = wholesalePrice == null ? null : Number(wholesalePrice)

      // variant가 있으면 해당 옵션 사용, 없으면 첫 번째 variant의 옵션 사용
      const optionSummary = variant?.optionSummary || mainVariant?.optionSummary || null

      orderItems.push({
        publishedProductId: publishedProduct.id,
        variantId: variant?.id || null,
        productName: product?.name || "",
        optionSummary,
        thumbnailUrl: product?.thumbnailUrl || null,
        quantity: item.quantity || 1,
        unitPrice: Number(unitPrice),
        wholesalePrice: wholesalePriceValue, // 도매가 스냅샷 (마진 계산용)
      })
    }

    // 금액 계산
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    )
    const shippingFee = 0 // 배송비는 판매가에 포함
    const discountAmount = 0
    const totalAmount = subtotal + shippingFee - discountAmount

    // 주문 생성 (주문자 정보는 user 테이블에서)
    const orderInput: CreateOrderInput = {
      userId,
      shopId,
      orderNumber: this.generateOrderNumber(),
      // 배송지 정보 (수령인)
      shippingAddress: {
        recipientName: shippingAddress.recipientName,
        recipientPhone: shippingAddress.recipientPhone,
        postalCode: shippingAddress.postalCode,
        address: shippingAddress.address,
        addressDetail: shippingAddress.addressDetail,
        deliveryMemo: shippingAddress.deliveryMemo,
      },
      subtotalAmount: subtotal,
      shippingFee,
      discountAmount,
      totalAmount,
      items: orderItems,
    }

    const order = await this.orderRepository.create(orderInput)

    // 알림 생성 (shopId가 있는 경우에만 - 샵 소유자에게 알림)
    if (shopId) {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { userId: true },
      })
      if (shop?.userId) {
        createOrderNotification(shop.userId, shopId, {
          id: order.id,
          orderNumber: order.orderNumber,
          totalAmount,
          customerName: shippingAddress.recipientName,
        })
      }
    }

    // TossPayments 결제 요청 정보 생성 (주문자 정보는 user에서)
    // 경로 기반 URL: /{shopSlug}/payment/success
    const baseUrl = process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'localhost:3000'
    const protocol = baseUrl.includes('localhost') ? 'http' : 'https'
    const shopPath = shopSlug ? `/${shopSlug}` : ''

    const paymentRequest: PaymentRequestData = {
      orderId: order.orderNumber,
      orderName:
        orderItems.length > 1
          ? `${orderItems[0].productName} 외 ${orderItems.length - 1}건`
          : orderItems[0].productName,
      amount: totalAmount,
      customerName: user.name || '고객',
      customerEmail: user.email || '',
      successUrl: `${protocol}://${baseUrl}${shopPath}/payment/success`,
      failUrl: `${protocol}://${baseUrl}${shopPath}/payment/fail`,
    }

    return {
      order: this.formatOrderResponse(order),
      payment: paymentRequest,
    }
  }

  /**
   * 주문번호로 조회
   */
  async findByOrderNumber(orderNumber: string): Promise<OrderResponse> {
    if (!orderNumber) {
      throw new ValidationError('주문번호는 필수입니다')
    }

    const order = await this.orderRepository.findByOrderNumber(orderNumber)

    if (!order) {
      throw new NotFoundError('주문', orderNumber)
    }

    return this.formatOrderResponse(order)
  }

  /**
   * 주문 ID로 조회
   */
  async findById(orderId: number): Promise<OrderResponse> {
    if (!orderId) {
      throw new ValidationError('주문 ID는 필수입니다')
    }

    const order = await this.orderRepository.findById(orderId)

    if (!order) {
      throw new NotFoundError('주문', String(orderId))
    }

    return this.formatOrderResponse(order)
  }

  /**
   * 사용자별 주문 목록 조회
   */
  async findByUserId(
    userId: number,
    options?: { take?: number; skip?: number }
  ): Promise<OrderResponse[]> {
    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    const orders = await this.orderRepository.findByUserId(userId, options)

    return orders.map((order) => this.formatOrderResponse(order))
  }

  /**
   * 이메일로 주문 목록 조회
   */
  async findByEmail(email: string): Promise<OrderResponse[]> {
    if (!email) {
      throw new ValidationError('이메일은 필수입니다')
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return []
    }

    return this.findByUserId(user.id)
  }

  /**
   * 주문 취소
   */
  async cancelOrder(
    orderId: number,
    reason: string,
    cancelledBy: 'USER' | 'ADMIN' = 'USER'
  ): Promise<OrderResponse> {
    if (!orderId) {
      throw new ValidationError('주문 ID는 필수입니다')
    }

    if (!reason) {
      throw new ValidationError('취소 사유는 필수입니다')
    }

    const order = await this.orderRepository.findById(orderId)

    if (!order) {
      throw new NotFoundError('주문', String(orderId))
    }

    // 취소 가능 상태 확인
    if (!['PENDING', 'PAID'].includes(order.status)) {
      throw new BusinessLogicError('현재 주문 상태에서는 취소할 수 없습니다')
    }

    const cancelledOrder = await this.orderRepository.cancel(orderId, reason, cancelledBy)

    // 취소 알림 생성 (shopId가 있는 경우에만 - 샵 소유자에게 알림)
    if (order.shopId) {
      const shop = await prisma.shop.findUnique({
        where: { id: order.shopId },
        select: { userId: true },
      })
      if (shop?.userId) {
        createCancelNotification(shop.userId, order.shopId, {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.shippingAddress?.recipientName,
        })
      }
    }

    return this.formatOrderResponse(cancelledOrder)
  }

  /**
   * 장바구니 비우기 (주문 완료 후 호출)
   */
  async clearCartAfterOrder(userId: number, sessionId: string | null): Promise<void> {
    await this.cartService.clearCart(sessionId, userId)
  }

  /**
   * 입력 검증: 배송 주소
   */
  private validateShippingAddress(shippingAddress: ShippingAddress): void {
    if (!shippingAddress?.address) {
      throw new ValidationError('배송 주소는 필수입니다')
    }
    if (!shippingAddress?.postalCode) {
      throw new ValidationError('우편번호는 필수입니다')
    }
  }

  /**
   * 배송 주소 정보 가져오기
   */
  private getShippingInfo(order: OrderWithRelations) {
    const addr = order.shippingAddress
    return {
      recipientName: addr?.recipientName || '',
      recipientPhone: addr?.recipientPhone || '',
      postalCode: addr?.postalCode || '',
      address: addr?.address || '',
      addressDetail: addr?.addressDetail || null,
      deliveryMemo: addr?.deliveryMemo || null,
    }
  }

  /**
   * 주문 응답 포맷팅
   */
  private formatOrderResponse(order: OrderWithRelations): OrderResponse {
    const shipping = this.getShippingInfo(order)

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      // 주문자 정보 (user 테이블에서)
      customer: {
        name: order.user?.name || '',
        phone: order.user?.phone || null,
        email: order.user?.email || '',
      },
      // 배송지 정보 (수령인 - shippingAddress 테이블)
      shippingAddress: order.shippingAddress
        ? {
            recipientName: order.shippingAddress.recipientName,
            recipientPhone: order.shippingAddress.recipientPhone,
            postalCode: order.shippingAddress.postalCode,
            address: order.shippingAddress.address,
            addressDetail: order.shippingAddress.addressDetail,
            deliveryMemo: order.shippingAddress.deliveryMemo,
          }
        : null,
      subtotalAmount: Number(order.subtotalAmount),
      shippingFee: Number(order.shippingFee),
      discountAmount: Number(order.discountAmount),
      totalAmount: Number(order.totalAmount),
      items: order.items.map((item) => ({
        productName: item.productName,
        optionSummary: item.optionSummary,
        thumbnailUrl: item.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        channel: item.publishedProduct?.channel || null,
        // 하위 호환성
        retailBand: item.publishedProduct?.channel || null,
      })),
      payment: order.payment
        ? {
            status: order.payment.status,
            method: order.payment.method,
            approvedAt: order.payment.approvedAt,
          }
        : null,
      orderedAt: order.orderedAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
    }
  }
}

// Singleton 인스턴스
export const orderService = new OrderService()

// Factory function
export function getOrderService(): OrderService {
  return orderService
}
