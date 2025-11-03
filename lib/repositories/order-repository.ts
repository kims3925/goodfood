import prisma from '@/lib/db'
import { Order, Customer, Product, Payment } from '@prisma/client'

export interface OrderWithRelations extends Order {
  customer: Customer
  product: Product
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
    customerId: string
    productId: string
    userId: string
    quantity: number
    totalAmount: number
    status?: string
    paymentStatus?: string
    shippingAddress?: string | null
    customerMemo?: string | null
  }): Promise<Order> {
    return await prisma.order.create({
      data: {
        ...data,
        status: data.status || 'PENDING',
        paymentStatus: data.paymentStatus || 'PENDING'
      }
    })
  }

  /**
   * 주문번호로 조회 (관계 포함)
   */
  async findByOrderNumber(orderNumber: string): Promise<OrderWithRelations | null> {
    return await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        customer: true,
        product: true,
        payments: {
          include: {
            refunds: true,
            paymentMethod: true
          }
        }
      }
    })
  }

  /**
   * 주문 ID로 조회
   */
  async findById(orderId: string): Promise<OrderWithRelations | null> {
    return await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        product: true,
        payments: true
      }
    })
  }

  /**
   * 고객별 주문 목록 조회
   */
  async findByCustomerId(
    customerId: string,
    options?: { take?: number; skip?: number }
  ): Promise<OrderWithRelations[]> {
    return await prisma.order.findMany({
      where: { customerId },
      include: {
        customer: true,
        product: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      take: options?.take,
      skip: options?.skip
    })
  }

  /**
   * 사용자별 주문 목록 조회 (판매자용)
   */
  async findByUserId(
    userId: string,
    options?: { take?: number; skip?: number }
  ): Promise<OrderWithRelations[]> {
    return await prisma.order.findMany({
      where: { userId },
      include: {
        customer: true,
        product: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      take: options?.take,
      skip: options?.skip
    })
  }

  /**
   * 결제 상태별 주문 조회
   */
  async findByPaymentStatus(
    paymentStatus: string,
    options?: { take?: number; skip?: number }
  ): Promise<OrderWithRelations[]> {
    return await prisma.order.findMany({
      where: { paymentStatus },
      include: {
        customer: true,
        product: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      take: options?.take,
      skip: options?.skip
    })
  }

  /**
   * 주문 상태 업데이트
   */
  async updateStatus(orderId: string, status: string): Promise<Order> {
    return await prisma.order.update({
      where: { id: orderId },
      data: { status, updatedAt: new Date() }
    })
  }

  /**
   * 결제 상태 업데이트
   */
  async updatePaymentStatus(orderId: string, paymentStatus: string): Promise<Order> {
    return await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus, updatedAt: new Date() }
    })
  }

  /**
   * 배송 상태 업데이트
   */
  async updateShippingStatus(
    orderId: string,
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
    return await prisma.order.findMany({
      where: options.where,
      include: {
        customer: true,
        product: true,
        payments: true
      },
      orderBy: options.orderBy || { createdAt: 'desc' },
      take: options.take,
      skip: options.skip
    })
  }

  /**
   * 주문 삭제 (관리자용)
   */
  async delete(orderId: string): Promise<Order> {
    return await prisma.order.delete({ where: { id: orderId } })
  }

  /**
   * 특정 상품의 주문 개수 조회
   */
  async countByProductId(productId: string): Promise<number> {
    return await prisma.order.count({ where: { productId } })
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
