/**
 * Order Repository
 * 주문 데이터 접근 레이어
 * PublishedProduct 기반 스키마 지원
 */

import prisma, { Prisma } from '@bandauto/db'

const Decimal = Prisma.Decimal

// ============================================
// Types
// ============================================

export interface OrderItemInput {
  publishedProductId: number
  variantId: number | null
  productName: string
  optionSummary: string | null
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
}

export interface ShippingAddressInput {
  recipient: string
  phone: string
  postalCode: string
  address: string
  addressDetail?: string | null
  deliveryMemo?: string | null
}

export interface CreateOrderInput {
  userId: number
  shopId?: number | null  // Shop 기반 주문 필터링
  orderNumber: string
  shippingAddress: ShippingAddressInput
  subtotalAmount: number
  shippingFee: number
  discountAmount?: number
  totalAmount: number
  items: OrderItemInput[]
}

export interface OrderWithRelations {
  id: number
  userId: number
  shopId: number | null  // Shop 기반 필터링
  orderNumber: string
  status: string
  shippingAddress: {
    id: number
    recipient: string
    phone: string
    postalCode: string
    address: string
    addressDetail: string | null
    deliveryMemo: string | null
  } | null
  subtotalAmount: any
  shippingFee: any
  discountAmount: any
  totalAmount: any
  orderedAt: Date
  paidAt: Date | null
  shippedAt: Date | null
  deliveredAt: Date | null
  cancelledAt: Date | null
  cancelReason: string | null
  cancelledBy: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: number
    name: string
    email: string
    phone: string | null
  }
  items: Array<{
    id: number
    orderId: number
    publishedProductId: number
    variantId: number | null
    productName: string
    optionSummary: string | null
    thumbnailUrl: string | null
    quantity: number
    unitPrice: any
    totalPrice: any
    publishedProduct?: {
      id: number
      channelId: number | null
      channel?: {
        id: number
        name: string
      } | null
    }
  }>
  payment: {
    id: number
    paymentKey: string
    status: string
    method: string
    amount: any
    approvedAt: Date | null
  } | null
}

// 주문 조회 include 옵션
const orderIncludeOptions = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  items: {
    include: {
      publishedProduct: {
        include: {
          channel: {
            select: { id: true, name: true },
          },
        },
      },
    },
  },
  payment: true,
  shippingAddress: true,
}

/**
 * Order Repository
 */
export class OrderRepository {
  /**
   * 주문 생성
   */
  async create(data: CreateOrderInput): Promise<OrderWithRelations> {
    const order = await prisma.order.create({
      data: {
        userId: data.userId,
        shopId: data.shopId || null,
        orderNumber: data.orderNumber,
        status: 'PENDING',
        subtotalAmount: new Decimal(data.subtotalAmount),
        shippingFee: new Decimal(data.shippingFee),
        discountAmount: new Decimal(data.discountAmount || 0),
        totalAmount: new Decimal(data.totalAmount),
        items: {
          create: data.items.map((item) => ({
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
        shippingAddress: {
          create: {
            recipient: data.shippingAddress.recipient,
            phone: data.shippingAddress.phone,
            postalCode: data.shippingAddress.postalCode,
            address: data.shippingAddress.address,
            addressDetail: data.shippingAddress.addressDetail || null,
            deliveryMemo: data.shippingAddress.deliveryMemo || null,
          },
        },
      },
      include: orderIncludeOptions,
    })

    return order as unknown as OrderWithRelations
  }

  /**
   * 주문번호로 조회
   */
  async findByOrderNumber(orderNumber: string): Promise<OrderWithRelations | null> {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: orderIncludeOptions,
    })
    return order as unknown as OrderWithRelations | null
  }

  /**
   * 주문 ID로 조회
   */
  async findById(orderId: number): Promise<OrderWithRelations | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: orderIncludeOptions,
    })
    return order as unknown as OrderWithRelations | null
  }

  /**
   * 사용자별 주문 목록 조회
   */
  async findByUserId(
    userId: number,
    options?: { take?: number; skip?: number; shopId?: number }
  ): Promise<OrderWithRelations[]> {
    const where: any = { userId }

    // shopId가 지정된 경우 해당 Shop의 주문만 조회
    if (options?.shopId) {
      where.shopId = options.shopId
    }

    const orders = await prisma.order.findMany({
      where,
      include: orderIncludeOptions,
      orderBy: { orderedAt: 'desc' },
      take: options?.take,
      skip: options?.skip,
    })
    return orders as unknown as OrderWithRelations[]
  }

  /**
   * 필터 조건으로 주문 조회
   */
  async findMany(options: {
    where?: any
    take?: number
    skip?: number
    orderBy?: any
  }): Promise<OrderWithRelations[]> {
    const orders = await prisma.order.findMany({
      where: options.where,
      include: orderIncludeOptions,
      orderBy: options.orderBy || { orderedAt: 'desc' },
      take: options.take,
      skip: options.skip,
    })
    return orders as unknown as OrderWithRelations[]
  }

  /**
   * 주문 상태 업데이트
   */
  async updateStatus(orderId: number, status: string): Promise<OrderWithRelations> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: status as any,
        updatedAt: new Date(),
      },
      include: orderIncludeOptions,
    })
    return order as unknown as OrderWithRelations
  }

  /**
   * 주문 결제 완료 처리
   */
  async markAsPaid(orderId: number): Promise<OrderWithRelations> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID' as any,
        paidAt: new Date(),
        updatedAt: new Date(),
      },
      include: orderIncludeOptions,
    })
    return order as unknown as OrderWithRelations
  }

  /**
   * 주문 취소
   */
  async cancel(
    orderId: number,
    reason: string,
    cancelledBy: 'USER' | 'ADMIN'
  ): Promise<OrderWithRelations> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED' as any,
        cancelledAt: new Date(),
        cancelReason: reason,
        cancelledBy,
        updatedAt: new Date(),
      },
      include: orderIncludeOptions,
    })
    return order as unknown as OrderWithRelations
  }

  /**
   * 배송 상태 업데이트
   */
  async updateShippingStatus(
    orderId: number,
    status: 'SHIPPED' | 'DELIVERED'
  ): Promise<OrderWithRelations> {
    const updateData: any = {
      status: status as any,
      updatedAt: new Date(),
    }

    if (status === 'SHIPPED') {
      updateData.shippedAt = new Date()
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date()
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: orderIncludeOptions,
    })
    return order as unknown as OrderWithRelations
  }

  /**
   * 주문 개수 조회
   */
  async count(where?: any): Promise<number> {
    return prisma.order.count({ where })
  }

  /**
   * 주문 삭제
   */
  async delete(orderId: number): Promise<void> {
    await prisma.order.delete({ where: { id: orderId } })
  }

  /**
   * 기간별 주문 통계
   */
  async getStatsByDateRange(startDate: Date, endDate: Date) {
    const orders = await prisma.order.findMany({
      where: {
        orderedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        totalAmount: true,
        status: true,
        orderedAt: true,
      },
    })

    const paidOrders = orders.filter((o) => o.status === 'PAID' || o.status === 'SHIPPED' || o.status === 'DELIVERED')
    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)

    return {
      totalRevenue,
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      pendingOrders: orders.filter((o) => o.status === 'PENDING').length,
      conversionRate: orders.length > 0 ? (paidOrders.length / orders.length) * 100 : 0,
    }
  }
}

// 싱글톤 인스턴스
let instance: OrderRepository | null = null

export function getOrderRepository(): OrderRepository {
  if (!instance) {
    instance = new OrderRepository()
  }
  return instance
}
