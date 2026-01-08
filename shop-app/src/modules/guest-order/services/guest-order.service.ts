/**
 * GuestOrder Service
 * 비회원 주문 비즈니스 로직 레이어
 */

import prisma from '@bandauto/db'
import {
  getGuestOrderRepository,
  GuestOrderRepository,
  CreateGuestOrderInput,
  GuestOrderItemInput,
} from '@/modules/guest-order/repository/guest-order.repository'
import {
  generateGuestAccessToken,
  verifyGuestAccessToken,
  GuestTokenPayload,
} from '@/lib/guest-token'
import {
  ValidationError,
  NotFoundError,
  BusinessLogicError,
} from '@/modules/common/utils/src/errors/handlers'
import { calculateItemPrice } from '@/lib/price-calculator'

// ============================================
// Types
// ============================================

export interface GuestCustomerInfo {
  name: string
  phone: string
  email?: string
}

export interface GuestShippingAddress {
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail?: string
  deliveryMemo?: string
}

export interface GuestOrderItem {
  shopProductId: number
  variantId?: number
  quantity: number
}

export interface CreateGuestOrderFromCartDTO {
  shopId?: number
  sessionId: string
  customerInfo: GuestCustomerInfo
  shippingAddress: GuestShippingAddress
}

export interface CreateGuestOrderFromItemsDTO {
  shopId?: number
  items: GuestOrderItem[]
  customerInfo: GuestCustomerInfo
  shippingAddress: GuestShippingAddress
}

export interface GuestOrderResponse {
  id: number
  orderNumber: string
  status: string
  // 주문자 정보
  customer: {
    name: string
    phone: string
    email: string | null
  }
  // 배송지 정보
  shippingAddress: {
    recipientName: string
    recipientPhone: string
    postalCode: string
    address: string
    addressDetail: string | null
    deliveryMemo: string | null
  } | null
  subtotalAmount: number
  discountAmount: number
  totalAmount: number
  items: Array<{
    productName: string
    optionSummary: string | null
    thumbnailUrl: string | null
    quantity: number
    unitPrice: number
    totalPrice: number
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

export interface GuestLookupResult {
  order: GuestOrderResponse
  accessToken: string
  expiresIn: number // 초
}

/**
 * GuestOrder Service
 */
export class GuestOrderService {
  constructor(
    private repository: GuestOrderRepository = getGuestOrderRepository()
  ) {}

  /**
   * 주문번호 생성
   */
  generateOrderNumber(): string {
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `GORD-${dateStr}-${random}`
  }

  /**
   * 세션 장바구니에서 비회원 주문 생성
   */
  async createFromSessionCart(data: CreateGuestOrderFromCartDTO): Promise<GuestOrderResponse> {
    const { shopId, sessionId, customerInfo, shippingAddress } = data

    // 입력 검증
    this.validateCustomerInfo(customerInfo)
    this.validateShippingAddress(shippingAddress)

    // 세션 장바구니 조회 (합배송 정보 및 도매가 포함)
    const cart = await prisma.cart.findFirst({
      where: {
        sessionId,
        userId: null,
        shopId,
      },
      include: {
        items: {
          include: {
            shopProduct: {
              include: {
                product: {
                  include: {
                    variants: {
                      select: {
                        id: true,
                        price: true,
                        optionSummary: true,
                        bundleUnit: true,
                      },
                    },
                    images: { take: 1, orderBy: { sortOrder: 'asc' } },
                  },
                },
                shop: true,
              },
            },
            variant: {
              select: {
                id: true,
                price: true,
                optionSummary: true,
                bundleUnit: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!cart || cart.items.length === 0) {
      throw new BusinessLogicError('장바구니가 비어있습니다')
    }

    // 주문 아이템 데이터 준비 (할인 계산 포함)
    const orderItems: GuestOrderItemInput[] = cart.items.map((item: any) => {
      const shopProduct = item.shopProduct
      const product = shopProduct?.product
      const variant = item.variant
      const mainVariant = product?.variants?.[0]

      // 원래 단가 (할인 전)
      const originalUnitPrice = Number(variant?.price || mainVariant?.price || 0)
      const shippingFeePerItem = Number(product?.shippingFee || 0)
      const bundleMaxQty = product?.bundleMaxQty || 1
      const variantBundleUnit = variant?.bundleUnit || 1
      const quantity = item.quantity

      // 공통 가격 계산 함수 사용
      const priceResult = calculateItemPrice({
        basePrice: originalUnitPrice,
        shippingFee: shippingFeePerItem,
        quantity,
        bundleMaxQty,
        bundleUnit: variantBundleUnit,
        bundleShippingType: product?.bundleShippingType,
      })

      const itemTotalWithDiscount = priceResult.itemTotal
      const unitPriceWithDiscount = priceResult.unitPrice

      return {
        shopProductId: shopProduct.id,
        variantId: variant?.id || null,
        productName: product?.name || "",
        optionSummary: variant?.optionSummary || null,
        thumbnailUrl: product?.thumbnailUrl || null,
        quantity: item.quantity,
        unitPrice: unitPriceWithDiscount, // 할인 반영된 단가
      }
    })

    // 금액 계산
    const subtotalBeforeDiscount = orderItems.reduce(
      (sum, item: any) => sum + (item.originalUnitPrice || item.unitPrice) * item.quantity,
      0
    )
    const subtotal = orderItems.reduce(
      (sum, item: any) => sum + (item.itemTotal || item.unitPrice * item.quantity),
      0
    )
    const discountAmount = subtotalBeforeDiscount - subtotal // 할인 금액
    const totalAmount = subtotal // 실제 결제 금액

    // 비회원 주문 생성
    const orderInput: CreateGuestOrderInput = {
      shopId,
      orderNumber: this.generateOrderNumber(),
      guestName: customerInfo.name,
      guestPhone: customerInfo.phone,
      guestEmail: customerInfo.email,
      shippingAddress: {
        recipientName: shippingAddress.recipientName || customerInfo.name,
        recipientPhone: shippingAddress.recipientPhone || customerInfo.phone,
        postalCode: shippingAddress.postalCode,
        address: shippingAddress.address,
        addressDetail: shippingAddress.addressDetail,
        deliveryMemo: shippingAddress.deliveryMemo,
      },
      subtotalAmount: subtotalBeforeDiscount, // 할인 전 상품 총액
      discountAmount, // 합배송 할인 금액
      totalAmount, // 실제 결제 금액 (할인 후)
      items: orderItems,
    }

    const order = await this.repository.create(orderInput)

    // 장바구니 비우기
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    })

    return this.formatOrderResponse(order)
  }

  /**
   * 직접 상품 지정하여 비회원 주문 생성
   */
  async createFromItems(data: CreateGuestOrderFromItemsDTO): Promise<GuestOrderResponse> {
    const { shopId, items, customerInfo, shippingAddress } = data

    // 입력 검증
    this.validateCustomerInfo(customerInfo)
    this.validateShippingAddress(shippingAddress)

    if (!items || items.length === 0) {
      throw new ValidationError('주문 상품이 없습니다')
    }

    // 상품 정보 조회 및 주문 아이템 준비
    const orderItems: GuestOrderItemInput[] = []

    for (const item of items) {
      const shopProduct = await prisma.shopProduct.findFirst({
        where: { id: item.shopProductId },
        include: {
          product: {
            include: {
              variants: {
                take: 1,
                select: {
                  id: true,
                  price: true,
                  optionSummary: true,
                  bundleUnit: true,
                },
              },
            },
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
          select: {
            id: true,
            price: true,
            optionSummary: true,
            bundleUnit: true,
          },
        })
      }

      const product = shopProduct.product
      const mainVariant = product?.variants[0]
      const unitPrice = variant?.price || mainVariant?.price || 0

      orderItems.push({
        shopProductId: shopProduct.id,
        variantId: variant?.id || null,
        productName: product?.name || "",
        optionSummary: variant?.optionSummary || null,
        thumbnailUrl: product?.thumbnailUrl || null,
        quantity: item.quantity || 1,
        unitPrice: Number(unitPrice),
      })
    }

    // 금액 계산
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    )
    const discountAmount = 0
    const totalAmount = subtotal - discountAmount

    // 비회원 주문 생성
    const orderInput: CreateGuestOrderInput = {
      shopId,
      orderNumber: this.generateOrderNumber(),
      guestName: customerInfo.name,
      guestPhone: customerInfo.phone,
      guestEmail: customerInfo.email,
      shippingAddress: {
        recipientName: shippingAddress.recipientName || customerInfo.name,
        recipientPhone: shippingAddress.recipientPhone || customerInfo.phone,
        postalCode: shippingAddress.postalCode,
        address: shippingAddress.address,
        addressDetail: shippingAddress.addressDetail,
        deliveryMemo: shippingAddress.deliveryMemo,
      },
      subtotalAmount: subtotal,
      discountAmount,
      totalAmount,
      items: orderItems,
    }

    const order = await this.repository.create(orderInput)

    return this.formatOrderResponse(order)
  }

  /**
   * 주문번호 + 휴대폰번호로 조회 (비회원 주문 조회)
   */
  async lookupByOrderNumberAndPhone(
    orderNumber: string,
    phone: string
  ): Promise<GuestLookupResult> {
    if (!orderNumber || !phone) {
      throw new ValidationError('주문번호와 휴대폰번호는 필수입니다')
    }

    const order = await this.repository.findByOrderNumberAndPhone(orderNumber, phone)

    if (!order) {
      throw new NotFoundError('주문', orderNumber)
    }

    // 접근 토큰 발급
    const accessToken = generateGuestAccessToken(order.id, phone, orderNumber)

    return {
      order: this.formatOrderResponse(order),
      accessToken,
      expiresIn: 3600, // 1시간
    }
  }

  /**
   * ID로 조회 (토큰 검증 후)
   */
  async findById(id: number): Promise<GuestOrderResponse> {
    const order = await this.repository.findById(id)

    if (!order) {
      throw new NotFoundError('주문', String(id))
    }

    return this.formatOrderResponse(order)
  }

  /**
   * 토큰 검증 및 주문 조회
   */
  async findByToken(token: string): Promise<GuestOrderResponse> {
    const payload = verifyGuestAccessToken(token)

    if (!payload) {
      throw new ValidationError('유효하지 않거나 만료된 토큰입니다')
    }

    return this.findById(payload.guestOrderId)
  }

  /**
   * 비회원 주문 취소
   */
  async cancelOrder(
    id: number,
    reason: string,
    token: string
  ): Promise<GuestOrderResponse> {
    // 토큰 검증
    const payload = verifyGuestAccessToken(token)
    if (!payload || payload.guestOrderId !== id) {
      throw new ValidationError('접근 권한이 없습니다')
    }

    const order = await this.repository.findById(id)

    if (!order) {
      throw new NotFoundError('주문', String(id))
    }

    // 취소 가능 상태 확인
    if (!['PENDING', 'PAID'].includes(order.status)) {
      throw new BusinessLogicError('현재 주문 상태에서는 취소할 수 없습니다')
    }

    const cancelledOrder = await this.repository.cancel(id, reason, 'GUEST')

    return this.formatOrderResponse(cancelledOrder)
  }

  /**
   * 입력 검증: 고객 정보
   */
  private validateCustomerInfo(customerInfo: GuestCustomerInfo): void {
    if (!customerInfo?.name) {
      throw new ValidationError('이름은 필수입니다')
    }
    if (!customerInfo?.phone) {
      throw new ValidationError('휴대폰번호는 필수입니다')
    }
  }

  /**
   * 입력 검증: 배송 주소
   */
  private validateShippingAddress(shippingAddress: GuestShippingAddress): void {
    if (!shippingAddress?.address) {
      throw new ValidationError('배송 주소는 필수입니다')
    }
    if (!shippingAddress?.postalCode) {
      throw new ValidationError('우편번호는 필수입니다')
    }
  }

  /**
   * 주문 응답 포맷팅
   */
  private formatOrderResponse(order: any): GuestOrderResponse {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customer: {
        name: order.guestName,
        phone: order.guestPhone,
        email: order.guestEmail,
      },
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
      discountAmount: Number(order.discountAmount),
      totalAmount: Number(order.totalAmount),
      items: order.items.map((item: any) => ({
        productName: item.productName,
        optionSummary: item.optionSummary,
        thumbnailUrl: item.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      payment: order.payment
        ? {
            status: order.payment.status,
            method: order.payment.paymentMethod,
            approvedAt: order.payment.paidAt,
          }
        : null,
      orderedAt: order.orderedAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
    }
  }
}

// 싱글톤 인스턴스
export const guestOrderService = new GuestOrderService()

export function getGuestOrderService(): GuestOrderService {
  return guestOrderService
}
