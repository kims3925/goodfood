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

// ============================================
// Types
// ============================================

export interface CustomerInfo {
  name: string
  phone: string
  email?: string
}

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
  customerInfo: CustomerInfo
  shippingAddress: ShippingAddress
}

export interface CreateOrderFromItemsDTO {
  userId: number
  shopId?: number  // Shop 기반 주문 필터링
  items: OrderItem[]
  customerInfo: CustomerInfo
  shippingAddress: ShippingAddress
}

export interface OrderResponse {
  id: number
  orderNumber: string
  status: string
  customer: {
    name: string
    email: string
    phone: string | null
  }
  recipientName: string
  recipientPhone: string
  address: string
  postalCode: string
  deliveryMemo: string | null
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
  customerName: string
  customerEmail: string
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
    const { userId, shopId, customerInfo, shippingAddress } = data

    // 입력 검증
    this.validateCustomerInfo(customerInfo)
    this.validateShippingAddress(shippingAddress)

    // 사용자 조회
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
    const orderItems: OrderItemInput[] = cart.items.map((item: any) => {
      const publishedProduct = item.publishedProduct
      const product = publishedProduct.product
      const variant = item.variant
      const mainVariant = product.variants[0]
      const unitPrice = variant?.price || mainVariant?.price || 0

      // variant가 있으면 해당 옵션 사용, 없으면 첫 번째 variant의 옵션 사용
      const optionSummary = variant?.optionSummary || mainVariant?.optionSummary || null

      return {
        publishedProductId: publishedProduct.id,
        variantId: variant?.id || null,
        productName: product.name,
        optionSummary,
        thumbnailUrl: product.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(unitPrice),
      }
    })

    // 금액 계산
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    )
    const shippingFee = subtotal >= 30000 ? 0 : 3000
    const discountAmount = 0
    const totalAmount = subtotal + shippingFee - discountAmount

    // 주문 생성
    const orderInput: CreateOrderInput = {
      userId,
      shopId,
      orderNumber: this.generateOrderNumber(),
      shippingAddress: {
        recipient: shippingAddress.recipientName || customerInfo.name,
        phone: shippingAddress.recipientPhone || customerInfo.phone,
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

    // TossPayments 결제 요청 정보 생성
    const paymentRequest: PaymentRequestData = {
      orderId: order.orderNumber,
      orderName:
        orderItems.length > 1
          ? `${orderItems[0].productName} 외 ${orderItems.length - 1}건`
          : orderItems[0].productName,
      amount: totalAmount,
      customerName: user.name || '고객',
      customerEmail: user.email || '',
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/payment/success`,
      failUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/payment/fail`,
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
    const { userId, shopId, items, customerInfo, shippingAddress } = data

    // 입력 검증
    this.validateCustomerInfo(customerInfo)
    this.validateShippingAddress(shippingAddress)

    if (!items || items.length === 0) {
      throw new ValidationError('주문 상품이 없습니다')
    }

    // 사용자 조회
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
              variants: { take: 1 },
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
        })
      }

      const product = publishedProduct.product
      const mainVariant = product.variants[0]
      const unitPrice = variant?.price || mainVariant?.price || 0

      // variant가 있으면 해당 옵션 사용, 없으면 첫 번째 variant의 옵션 사용
      const optionSummary = variant?.optionSummary || mainVariant?.optionSummary || null

      orderItems.push({
        publishedProductId: publishedProduct.id,
        variantId: variant?.id || null,
        productName: product.name,
        optionSummary,
        thumbnailUrl: product.thumbnailUrl,
        quantity: item.quantity || 1,
        unitPrice: Number(unitPrice),
      })
    }

    // 금액 계산
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    )
    const shippingFee = subtotal >= 30000 ? 0 : 3000
    const discountAmount = 0
    const totalAmount = subtotal + shippingFee - discountAmount

    // 주문 생성
    const orderInput: CreateOrderInput = {
      userId,
      shopId,
      orderNumber: this.generateOrderNumber(),
      shippingAddress: {
        recipient: shippingAddress.recipientName || customerInfo.name,
        phone: shippingAddress.recipientPhone || customerInfo.phone,
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

    // TossPayments 결제 요청 정보 생성
    const paymentRequest: PaymentRequestData = {
      orderId: order.orderNumber,
      orderName:
        orderItems.length > 1
          ? `${orderItems[0].productName} 외 ${orderItems.length - 1}건`
          : orderItems[0].productName,
      amount: totalAmount,
      customerName: user.name || '고객',
      customerEmail: user.email || '',
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/payment/success`,
      failUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/payment/fail`,
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

    return this.formatOrderResponse(cancelledOrder)
  }

  /**
   * 장바구니 비우기 (주문 완료 후 호출)
   */
  async clearCartAfterOrder(userId: number, sessionId: string | null): Promise<void> {
    await this.cartService.clearCart(sessionId, userId)
  }

  /**
   * 입력 검증: 고객 정보
   */
  private validateCustomerInfo(customerInfo: CustomerInfo): void {
    if (!customerInfo?.name) {
      throw new ValidationError('고객 이름은 필수입니다')
    }
    if (!customerInfo?.phone) {
      throw new ValidationError('고객 전화번호는 필수입니다')
    }
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
      recipientName: addr?.recipient || '',
      recipientPhone: addr?.phone || '',
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
      customer: {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone,
      },
      recipientName: shipping.recipientName,
      recipientPhone: shipping.recipientPhone,
      address: `${shipping.address} ${shipping.addressDetail || ''}`.trim(),
      postalCode: shipping.postalCode,
      deliveryMemo: shipping.deliveryMemo,
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
