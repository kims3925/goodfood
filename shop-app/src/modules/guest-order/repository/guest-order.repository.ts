/**
 * GuestOrder Repository
 * 비회원 주문 데이터 접근 레이어
 */

import prisma, { Prisma } from '@bandauto/db'

const Decimal = Prisma.Decimal

// ============================================
// Types
// ============================================

export interface GuestOrderItemInput {
  publishedProductId: number
  variantId: number | null
  productName: string
  optionSummary: string | null
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  wholesalePrice?: number | null // 도매가 스냅샷 (마진 계산용)
}

export interface GuestShippingAddressInput {
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail?: string | null
  deliveryMemo?: string | null
}

export interface CreateGuestOrderInput {
  shopId?: number | null
  orderNumber: string
  // 비회원 주문자 정보
  guestName: string
  guestPhone: string
  guestEmail?: string | null
  // 배송지 정보
  shippingAddress: GuestShippingAddressInput
  // 금액 정보
  subtotalAmount: number
  shippingFee: number
  discountAmount?: number
  totalAmount: number
  items: GuestOrderItemInput[]
}

// GuestOrder include 옵션
const guestOrderIncludeOptions = {
  shippingAddress: true,
  items: {
    include: {
      publishedProduct: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              thumbnailUrl: true,
            },
          },
          channel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      variant: {
        select: {
          id: true,
          optionSummary: true,
        },
      },
    },
  },
  payment: true,
  shop: {
    select: {
      id: true,
      name: true,
      bankName: true,
      bankAccount: true,
      accountHolder: true,
    },
  },
}

/**
 * GuestOrder Repository
 */
export class GuestOrderRepository {
  /**
   * 비회원 주문 생성
   */
  async create(data: CreateGuestOrderInput) {
    const order = await prisma.guestOrder.create({
      data: {
        shopId: data.shopId || null,
        orderNumber: data.orderNumber,
        status: 'PENDING',
        // 비회원 주문자 정보
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        guestEmail: data.guestEmail || null,
        // 금액 정보
        subtotalAmount: new Decimal(data.subtotalAmount),
        shippingFee: new Decimal(data.shippingFee),
        discountAmount: new Decimal(data.discountAmount || 0),
        totalAmount: new Decimal(data.totalAmount),
        // 배송지 정보 (별도 테이블)
        shippingAddress: {
          create: {
            recipientName: data.shippingAddress.recipientName,
            recipientPhone: data.shippingAddress.recipientPhone,
            postalCode: data.shippingAddress.postalCode,
            address: data.shippingAddress.address,
            addressDetail: data.shippingAddress.addressDetail || null,
            deliveryMemo: data.shippingAddress.deliveryMemo || null,
          },
        },
        items: {
          create: data.items.map((item) => ({
            publishedProductId: item.publishedProductId,
            variantId: item.variantId,
            productName: item.productName,
            optionSummary: item.optionSummary,
            thumbnailUrl: item.thumbnailUrl,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            wholesalePrice: item.wholesalePrice ?? null, // 도매가 스냅샷
            totalPrice: new Decimal(item.unitPrice * item.quantity),
          })),
        },
      },
      include: guestOrderIncludeOptions,
    })

    return order
  }

  /**
   * 주문번호로 조회
   */
  async findByOrderNumber(orderNumber: string) {
    return prisma.guestOrder.findUnique({
      where: { orderNumber },
      include: guestOrderIncludeOptions,
    })
  }

  /**
   * 주문번호 + 휴대폰번호로 조회 (비회원 조회)
   */
  async findByOrderNumberAndPhone(orderNumber: string, phone: string) {
    return prisma.guestOrder.findFirst({
      where: {
        orderNumber,
        guestPhone: phone,
      },
      include: guestOrderIncludeOptions,
    })
  }

  /**
   * ID로 조회
   */
  async findById(id: number) {
    return prisma.guestOrder.findUnique({
      where: { id },
      include: guestOrderIncludeOptions,
    })
  }

  /**
   * 주문 상태 업데이트
   */
  async updateStatus(id: number, status: string) {
    return prisma.guestOrder.update({
      where: { id },
      data: {
        status: status as any,
        updatedAt: new Date(),
      },
      include: guestOrderIncludeOptions,
    })
  }

  /**
   * 결제 완료 처리
   */
  async markAsPaid(id: number) {
    return prisma.guestOrder.update({
      where: { id },
      data: {
        status: 'PAID' as any,
        paidAt: new Date(),
        updatedAt: new Date(),
      },
      include: guestOrderIncludeOptions,
    })
  }

  /**
   * 주문 취소
   */
  async cancel(id: number, reason: string, cancelledBy: string = 'GUEST') {
    return prisma.guestOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED' as any,
        cancelledAt: new Date(),
        cancelReason: reason,
        cancelledBy,
        updatedAt: new Date(),
      },
      include: guestOrderIncludeOptions,
    })
  }

  /**
   * 배송 상태 업데이트
   */
  async updateShippingStatus(id: number, status: 'SHIPPED' | 'DELIVERED') {
    const updateData: any = {
      status: status as any,
      updatedAt: new Date(),
    }

    if (status === 'SHIPPED') {
      updateData.shippedAt = new Date()
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date()
    }

    return prisma.guestOrder.update({
      where: { id },
      data: updateData,
      include: guestOrderIncludeOptions,
    })
  }

  /**
   * Shop별 비회원 주문 목록 조회
   */
  async findByShopId(shopId: number, options?: { take?: number; skip?: number }) {
    return prisma.guestOrder.findMany({
      where: { shopId },
      include: guestOrderIncludeOptions,
      orderBy: { orderedAt: 'desc' },
      take: options?.take,
      skip: options?.skip,
    })
  }
}

// 싱글톤 인스턴스
let instance: GuestOrderRepository | null = null

export function getGuestOrderRepository(): GuestOrderRepository {
  if (!instance) {
    instance = new GuestOrderRepository()
  }
  return instance
}
