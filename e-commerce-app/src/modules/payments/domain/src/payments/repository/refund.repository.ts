/**
 * Refund Repository
 * 환불 데이터 접근 레이어
 */

import prisma from '@/lib/database/client'
import { Refund, Prisma } from '@prisma/client'

export class RefundRepository {
  /**
   * ID로 환불 조회
   */
  async findById(id: string): Promise<Refund | null> {
    return prisma.refund.findUnique({
      where: { id }
    })
  }

  /**
   * 결제별 환불 조회
   */
  async findByPaymentId(paymentId: string): Promise<Refund[]> {
    return prisma.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * 환불 생성
   */
  async create(data: Prisma.RefundCreateInput): Promise<Refund> {
    return prisma.refund.create({
      data
    })
  }

  /**
   * 환불 상태 업데이트
   */
  async updateStatus(id: string, status: string): Promise<Refund> {
    return prisma.refund.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date()
      }
    })
  }

  /**
   * 환불 개수 조회
   */
  async count(paymentId?: string): Promise<number> {
    return prisma.refund.count({
      where: paymentId ? { paymentId } : undefined
    })
  }
}

// Singleton 인스턴스
export const refundRepository = new RefundRepository()
