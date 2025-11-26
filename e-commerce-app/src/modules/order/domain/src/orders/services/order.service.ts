/**
 * Order Service
 * 주문 비즈니스 로직 레이어
 */

import { Order } from '@bandauto/db'
import { getOrderRepository } from '@/domain/orders/repository/order.repository'
import { customerService, CustomerService } from '@/domain/customers/services/customer.service'
import { cartService, CartService } from '@/domain/cart/services/cart.service'
import { getTossPaymentsService } from '@/domain/payments'
import prisma from '@/lib/database/client'
import {
  CreateOrderDTO,
  UpdateOrderDTO,
  OrderFilter,
  OrderResponse,
  CreateOrderResult,
  OrderStats,
  ShippingAddress
} from '@/types/services/order'
import {
  ValidationError,
  NotFoundError,
  BusinessLogicError
} from '@/lib/errors/handlers'

export class OrderService {
  private orderRepository = getOrderRepository()

  constructor(
    private customerSvc: CustomerService = customerService,
    private cartSvc: CartService = cartService
  ) {}

  /**
   * 주문 생성
   */
  async createOrder(data: CreateOrderDTO): Promise<CreateOrderResult> {
    // 입력값 검증
    if (!data.productId) {
      throw new ValidationError('상품 ID는 필수입니다')
    }

    if (!data.quantity || data.quantity < 1) {
      throw new ValidationError('수량은 1개 이상이어야 합니다')
    }

    if (!data.customerInfo || !data.customerInfo.name || !data.customerInfo.phone) {
      throw new ValidationError('고객 정보(이름, 전화번호)가 필요합니다')
    }

    // 상품 조회
    const product = await prisma.product.findUnique({
      where: { id: data.productId }
    })

    if (!product) {
      throw new NotFoundError('상품', data.productId)
    }

    if (!product.isAvailable) {
      throw new BusinessLogicError('현재 구매할 수 없는 상품입니다')
    }

    // 가격 계산
    const unitPrice = product.salePrice
    const subtotal = unitPrice * data.quantity

    // 배송비 계산
    const freeShippingAmount = parseFloat(
      process.env.FREE_SHIPPING_AMOUNT || '30000'
    )
    const defaultShippingFee = parseFloat(
      process.env.DEFAULT_SHIPPING_FEE || '3000'
    )
    const shippingFee = subtotal >= freeShippingAmount ? 0 : defaultShippingFee

    const totalAmount = subtotal + shippingFee

    // 고객 정보 생성 또는 조회
    const customer = await this.customerSvc.findOrCreateCustomer({
      name: data.customerInfo.name,
      phone: data.customerInfo.phone,
      email: data.customerInfo.email,
      address: data.shippingAddress ? JSON.stringify(data.shippingAddress) : undefined,
      memo: data.customerInfo.memo
    })

    // 토스페이먼츠 서비스로 주문 ID 생성
    const tossService = await getTossPaymentsService()
    const orderNumber = tossService.generateOrderId()

    // 사용자 ID 처리 (로그인된 사용자 또는 시스템 사용자)
    let effectiveUserId = data.userId

    if (!effectiveUserId) {
      const systemUser = await this.getSystemUser()
      effectiveUserId = systemUser.id
    }

    // 주문 생성
    const order = await this.orderRepository.create({
      orderNumber,
      customerId: customer.id,
      productId: product.id,
      userId: effectiveUserId,
      quantity: data.quantity,
      totalAmount,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      shippingAddress: data.shippingAddress
        ? JSON.stringify(data.shippingAddress)
        : null,
      customerMemo: data.customerInfo.memo || null
    })

    // 결제 요청 데이터 생성
    const paymentRequest = tossService.createPaymentRequest(
      orderNumber,
      totalAmount,
      `${product.title} ${data.quantity > 1 ? `외 ${data.quantity - 1}건` : ''}`,
      customer.email
    )

    // 장바구니에서 해당 상품 제거 (만약 장바구니에서 주문했다면)
    if (data.sessionId || data.userId) {
      try {
        await this.removeFromCart(data.sessionId, data.userId, product.id)
      } catch (error) {
        // 장바구니 제거 실패는 주문 생성에 영향을 주지 않음
        console.warn('장바구니 제거 실패:', error)
      }
    }

    console.log('주문 생성 성공:', {
      orderNumber,
      customerId: customer.id,
      productId: product.id,
      totalAmount
    })

    // 응답 데이터 포맷팅
    const orderResponse: OrderResponse = {
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      },
      product: {
        id: product.id,
        title: product.title,
        images: product.images ? JSON.parse(product.images) : [],
        unitPrice
      },
      quantity: order.quantity,
      subtotal,
      shippingFee,
      shippingAddress: data.shippingAddress || null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }

    return {
      order: orderResponse,
      paymentRequest
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
      throw new NotFoundError('주문', orderId)
    }

    return this.formatOrderResponse(order)
  }

  /**
   * 고객별 주문 목록 조회
   */
  async findByCustomerId(customerId: number, options?: {
    take?: number
    skip?: number
  }): Promise<OrderResponse[]> {
    if (!customerId) {
      throw new ValidationError('고객 ID는 필수입니다')
    }

    const orders = await this.orderRepository.findByCustomerId(customerId, options)

    return orders.map(order => this.formatOrderResponse(order))
  }

  /**
   * 사용자별 주문 목록 조회 (판매자용)
   */
  async findByUserId(userId: number, options?: {
    take?: number
    skip?: number
  }): Promise<OrderResponse[]> {
    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    const orders = await this.orderRepository.findByUserId(userId, options)

    return orders.map(order => this.formatOrderResponse(order))
  }

  /**
   * 필터 조건으로 주문 조회
   */
  async findByFilter(filter: OrderFilter): Promise<OrderResponse[]> {
    const where: any = {}

    if (filter.userId) where.userId = filter.userId
    if (filter.customerId) where.customerId = filter.customerId
    if (filter.status) where.status = filter.status
    if (filter.paymentStatus) where.paymentStatus = filter.paymentStatus
    if (filter.shippingStatus) where.shippingStatus = filter.shippingStatus

    if (filter.startDate || filter.endDate) {
      where.createdAt = {}
      if (filter.startDate) where.createdAt.gte = filter.startDate
      if (filter.endDate) where.createdAt.lte = filter.endDate
    }

    const orders = await this.orderRepository.findMany({
      where,
      take: filter.limit,
      skip: filter.offset,
      orderBy: filter.sortBy
        ? { [filter.sortBy]: filter.sortOrder || 'desc' }
        : { createdAt: 'desc' }
    })

    return orders.map(order => this.formatOrderResponse(order))
  }

  /**
   * 주문 업데이트
   */
  async updateOrder(orderId: number, data: UpdateOrderDTO): Promise<Order> {
    if (!orderId) {
      throw new ValidationError('주문 ID는 필수입니다')
    }

    // 주문 존재 확인
    const existingOrder = await this.orderRepository.findById(orderId)
    if (!existingOrder) {
      throw new NotFoundError('주문', orderId)
    }

    // 상태별 업데이트
    if (data.status) {
      return this.orderRepository.updateStatus(orderId, data.status)
    }

    if (data.paymentStatus) {
      return this.orderRepository.updatePaymentStatus(orderId, data.paymentStatus)
    }

    if (data.shippingStatus) {
      return this.orderRepository.updateShippingStatus(
        orderId,
        data.shippingStatus,
        data.trackingNumber
      )
    }

    throw new ValidationError('업데이트할 필드가 없습니다')
  }

  /**
   * 주문 상태 업데이트
   */
  async updateOrderStatus(orderId: number, status: string): Promise<Order> {
    if (!orderId) {
      throw new ValidationError('주문 ID는 필수입니다')
    }

    if (!status) {
      throw new ValidationError('주문 상태는 필수입니다')
    }

    return this.orderRepository.updateStatus(orderId, status)
  }

  /**
   * 결제 상태 업데이트
   */
  async updatePaymentStatus(orderId: number, paymentStatus: string): Promise<Order> {
    if (!orderId) {
      throw new ValidationError('주문 ID는 필수입니다')
    }

    if (!paymentStatus) {
      throw new ValidationError('결제 상태는 필수입니다')
    }

    return this.orderRepository.updatePaymentStatus(orderId, paymentStatus)
  }

  /**
   * 주문 통계 조회
   */
  async getOrderStats(startDate: Date, endDate: Date): Promise<OrderStats> {
    return this.orderRepository.getStatsByDateRange(startDate, endDate)
  }

  /**
   * 주문 개수 조회
   */
  async countOrders(where?: any): Promise<number> {
    return this.orderRepository.count(where)
  }

  /**
   * 주문 삭제 (관리자용)
   */
  async deleteOrder(orderId: number): Promise<void> {
    if (!orderId) {
      throw new ValidationError('주문 ID는 필수입니다')
    }

    // 주문 존재 확인
    const existingOrder = await this.orderRepository.findById(orderId)
    if (!existingOrder) {
      throw new NotFoundError('주문', orderId)
    }

    await this.orderRepository.delete(orderId)
  }

  /**
   * Private: 장바구니에서 상품 제거
   */
  private async removeFromCart(
    sessionId: string | undefined,
    userId: number | undefined,
    productId: number
  ): Promise<void> {
    if (!sessionId && !userId) {
      return
    }

    const cart = await this.cartSvc.getCartBySessionOrUser(
      sessionId || '',
      userId
    )

    if (!cart) {
      return
    }

    // 장바구니에서 해당 상품 찾기
    const cartItem = cart.items.find(item => item.productId === productId)

    if (cartItem) {
      await this.cartSvc.removeItemFromCart(
        sessionId || '',
        cartItem.id,
        userId
      )
    }
  }

  /**
   * Private: 시스템 사용자 가져오기 또는 생성 (익명 주문용)
   */
  private async getSystemUser() {
    const SYSTEM_EMAIL = 'system@bandauto.shop'

    let systemUser = await prisma.user.findFirst({
      where: { email: SYSTEM_EMAIL }
    })

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          name: 'System User',
          email: SYSTEM_EMAIL,
          password: 'system-user-password-not-for-login',
          role: 'ADMIN'
        }
      })
    }

    return systemUser
  }

  /**
   * Private: 주문 응답 포맷팅
   */
  private formatOrderResponse(order: any): OrderResponse {
    const product = order.product
    const unitPrice = product.salePrice
    const subtotal = unitPrice * order.quantity
    const shippingFee = order.totalAmount - subtotal

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      customer: {
        id: order.customer.id,
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone
      },
      product: {
        id: product.id,
        title: product.title,
        images: product.images ? JSON.parse(product.images) : [],
        unitPrice
      },
      quantity: order.quantity,
      subtotal,
      shippingFee,
      shippingAddress: order.shippingAddress
        ? JSON.parse(order.shippingAddress)
        : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }
  }
}

// Singleton 인스턴스
export const orderService = new OrderService()
