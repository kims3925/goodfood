/**
 * Payment Repository
 * 결제 데이터 접근 레이어
 */

import prisma from '@/lib/database/client'
import { Payment, Refund, Prisma } from '@prisma/client'
import { PaymentFilter } from '@/types/services/payment'

export interface PaymentWithRelations extends Payment {
  refunds?: Refund[]
  paymentMethod?: any
  order?: any
}

export class PaymentRepository {
  /**
   * ID로 결제 조회
   */
  async findById(id: number): Promise<PaymentWithRelations | null> {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        refunds: true,
        paymentMethod: true,
        order: {
          include: {
            customer: true,
            product: true
          }
        }
      }
    })
  }

  /**
   * 결제 키로 조회
   */
  async findByPaymentKey(paymentKey: string): Promise<PaymentWithRelations | null> {
    return prisma.payment.findFirst({
      where: { paymentKey },
      include: {
        refunds: true,
        paymentMethod: true,
        order: {
          include: {
            customer: true,
            product: true
          }
        }
      }
    })
  }

  /**
   * 주문별 결제 조회
   */
  async findByOrderId(orderId: number): Promise<PaymentWithRelations[]> {
    return prisma.payment.findMany({
      where: { orderId },
      include: {
        refunds: true,
        paymentMethod: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * 필터 조건으로 결제 조회
   */
  async findByFilter(filter: PaymentFilter): Promise<PaymentWithRelations[]> {
    const where: Prisma.PaymentWhereInput = {}

    if (filter.orderId) where.orderId = filter.orderId
    if (filter.paymentKey) where.paymentKey = filter.paymentKey
    if (filter.status) where.status = filter.status
    if (filter.method) where.method = filter.method

    if (filter.startDate || filter.endDate) {
      where.createdAt = {}
      if (filter.startDate) where.createdAt.gte = filter.startDate
      if (filter.endDate) where.createdAt.lte = filter.endDate
    }

    return prisma.payment.findMany({
      where,
      include: {
        refunds: true,
        paymentMethod: true,
        order: true
      },
      orderBy: filter.sortBy
        ? { [filter.sortBy]: filter.sortOrder || 'desc' }
        : { createdAt: 'desc' },
      skip: filter.offset,
      take: filter.limit
    })
  }

  /**
   * 결제 생성
   */
  async create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return prisma.payment.create({
      data
    })
  }

  /**
   * 결제 상태 업데이트
   */
  async updateStatus(id: number, status: string, webhookData?: any): Promise<Payment> {
    return prisma.payment.update({
      where: { id },
      data: {
        status,
        webhookData: webhookData ? JSON.stringify(webhookData) : undefined,
        updatedAt: new Date()
      }
    })
  }

  /**
   * 결제 업데이트
   */
  async update(id: number, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return prisma.payment.update({
      where: { id },
      data
    })
  }

  /**
   * 결제 삭제
   */
  async delete(id: number): Promise<Payment> {
    return prisma.payment.delete({
      where: { id }
    })
  }

  /**
   * 결제 개수 조회
   */
  async count(filter?: Partial<PaymentFilter>): Promise<number> {
    const where: Prisma.PaymentWhereInput = {}

    if (filter?.orderId) where.orderId = filter.orderId
    if (filter?.status) where.status = filter.status
    if (filter?.method) where.method = filter.method

    return prisma.payment.count({ where })
  }
}

// Singleton 인스턴스
export const paymentRepository = new PaymentRepository()
