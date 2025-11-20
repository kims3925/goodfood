import prisma from '@/lib/database/client'
import { Order, Customer, Payment, OrderItem, Product, User, CustomerAddress } from '@prisma/client'

export interface OrderItemWithProduct extends OrderItem {
  product: Product
}

export interface OrderWithRelations extends Order {
  user: User
  customer: Customer
  address?: CustomerAddress | null
  items: OrderItemWithProduct[]
  payments: Payment[]
}

/**
 * Order Repository - 주문 데이터 접근 레이어
 */
export class OrderRepository {
  /**
   * 주문 생성
   */
  async create(data: {
    orderNumber: string
    customerId: number
    userId: number
    subtotal: number
    shippingFee: number
    totalAmount: number
    customerName: string
    customerPhone: string
    customerEmail?: string | null
    status?: string
    paymentStatus?: string
    shippingAddress?: string | null
    customerMemo?: string | null
  }): Promise<Order> {
    return await prisma.order.create({
      data: {
        orderNumber: data.orderNumber,
        customerId: data.customerId,
        userId: data.userId,
        subtotal: data.subtotal,
        shippingFee: data.shippingFee,
        discountAmount: 0,
        totalAmount: data.totalAmount,
        status: data.status || 'PENDING',
        paymentStatus: data.paymentStatus || 'PENDING',
        shippingStatus: 'PREPARING',
        customerName: data.customerName,
        customerEmail: data.customerEmail || null,
        customerPhone: data.customerPhone,
        customerMemo: data.customerMemo || null,
        shippingAddress: data.shippingAddress || null
      }
    })
  }

  /**
   * 주문번호로 조회 (관계 포함)
   */
  async findByOrderNumber(orderNumber: string): Promise<OrderWithRelations | null> {
    const result = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        user: true,
        customer: true,
        address: true,
        items: {
          include: {
            product: true
          }
        },
        payments: {
          include: {
            refunds: true,
            paymentMethod: true
          }
        }
      }
    })
    return result as OrderWithRelations | null
  }

  /**
   * 주문 ID로 조회
   */
  async findById(orderId: number): Promise<OrderWithRelations | null> {
    const result = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        customer: true,
        address: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true
      }
    })
    return result as OrderWithRelations | null
  }

  /**
   * 고객별 주문 목록 조회
   */
  async findByCustomerId(
    customerId: number,
    options?: { take?: number; skip?: number }
  ): Promise<OrderWithRelations[]> {
    const result = await prisma.order.findMany({
      where: { customerId },
      include: {
        user: true,
        customer: true,
        address: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      take: options?.take,
      skip: options?.skip
    })
    return result as OrderWithRelations[]
  }

  /**
   * 사용자별 주문 목록 조회 (판매자용)
   */
  async findByUserId(
    userId: number,
    options?: { take?: number; skip?: number }
  ): Promise<OrderWithRelations[]> {
    const result = await prisma.order.findMany({
      where: { userId },
      include: {
        user: true,
        customer: true,
        address: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      take: options?.take,
      skip: options?.skip
    })
    return result as OrderWithRelations[]
  }

  /**
   * 결제 상태별 주문 조회
   */
  async findByPaymentStatus(
    paymentStatus: string,
    options?: { take?: number; skip?: number }
  ): Promise<OrderWithRelations[]> {
    const result = await prisma.order.findMany({
      where: { paymentStatus },
      include: {
        user: true,
        customer: true,
        address: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      take: options?.take,
      skip: options?.skip
    })
    return result as OrderWithRelations[]
  }

  /**
   * 주문 상태 업데이트
   */
  async updateStatus(orderId: number, status: string): Promise<Order> {
    return await prisma.order.update({
      where: { id: orderId },
      data: { status, updatedAt: new Date() }
    })
  }

  /**
   * 결제 상태 업데이트
   */
  async updatePaymentStatus(orderId: number, paymentStatus: string): Promise<Order> {
    return await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus, updatedAt: new Date() }
    })
  }

  /**
   * 배송 상태 업데이트
   */
  async updateShippingStatus(
    orderId: number,
    shippingStatus: string,
    trackingNumber?: string
  ): Promise<Order> {
    return await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingStatus,
        trackingNumber: trackingNumber || undefined,
        updatedAt: new Date()
      }
    })
  }

  /**
   * 주문 총 개수 조회
   */
  async count(where?: any): Promise<number> {
    return await prisma.order.count({ where })
  }

  /**
   * 주문 목록 조회 (필터링 + 페이지네이션)
   */
  async findMany(options: {
    where?: any
    take?: number
    skip?: number
    orderBy?: any
  }): Promise<OrderWithRelations[]> {
    const result = await prisma.order.findMany({
      where: options.where,
      include: {
        user: true,
        customer: true,
        address: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true
      },
      orderBy: options.orderBy || { createdAt: 'desc' },
      take: options.take,
      skip: options.skip
    })
    return result as OrderWithRelations[]
  }

  /**
   * 주문 삭제 (관리자용)
   */
  async delete(orderId: number): Promise<Order> {
    return await prisma.order.delete({ where: { id: orderId } })
  }

  /**
   * 특정 상품의 주문 개수 조회
   */
  async countByProductId(productId: number): Promise<number> {
    return await prisma.order.count({
      where: {
        items: {
          some: {
            productId: productId
          }
        }
      }
    })
  }

  /**
   * 기간별 주문 통계
   */
  async getStatsByDateRange(startDate: Date, endDate: Date) {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        totalAmount: true,
        paymentStatus: true,
        status: true,
        createdAt: true
      }
    })

    const totalRevenue = orders
      .filter(o => o.paymentStatus === 'PAID')
      .reduce((sum, o) => sum + o.totalAmount, 0)

    const totalOrders = orders.length
    const paidOrders = orders.filter(o => o.paymentStatus === 'PAID').length
    const pendingOrders = orders.filter(o => o.paymentStatus === 'PENDING').length

    return {
      totalRevenue,
      totalOrders,
      paidOrders,
      pendingOrders,
      conversionRate: totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0
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
