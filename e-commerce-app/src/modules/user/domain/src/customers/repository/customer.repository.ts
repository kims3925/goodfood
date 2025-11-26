/**
 * Customer Repository
 * 고객 데이터 접근 레이어
 */

import prisma from '@/lib/database/client'
import { Customer, Prisma } from '@bandauto/db'
import { CustomerFilter } from '@/types/services/customer'

export class CustomerRepository {
  /**
   * ID로 고객 조회
   */
  async findById(id: number): Promise<Customer | null> {
    return prisma.customer.findUnique({
      where: { id }
    })
  }

  /**
   * 전화번호로 고객 조회
   */
  async findByPhone(phone: string): Promise<Customer | null> {
    return prisma.customer.findUnique({
      where: { phone }
    })
  }

  /**
   * 이메일로 고객 조회
   */
  async findByEmail(email: string): Promise<Customer | null> {
    return prisma.customer.findFirst({
      where: { email }
    })
  }

  /**
   * 이메일 또는 전화번호로 고객 조회
   */
  async findByEmailOrPhone(email: string, phone: string): Promise<Customer | null> {
    return prisma.customer.findFirst({
      where: {
        OR: [
          { email: email || undefined },
          { phone }
        ]
      }
    })
  }

  /**
   * 필터 조건으로 고객 조회
   */
  async findByFilter(filter: CustomerFilter): Promise<Customer[]> {
    const where: Prisma.CustomerWhereInput = {}

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search } },
        { phone: { contains: filter.search } },
        { email: { contains: filter.search } }
      ]
    }

    if (filter.email) {
      where.email = filter.email
    }

    if (filter.phone) {
      where.phone = filter.phone
    }

    return prisma.customer.findMany({
      where,
      orderBy: filter.sortBy
        ? { [filter.sortBy]: filter.sortOrder || 'desc' }
        : { createdAt: 'desc' },
      skip: filter.offset,
      take: filter.limit
    })
  }

  /**
   * 고객 생성
   */
  async create(data: Prisma.CustomerCreateInput): Promise<Customer> {
    return prisma.customer.create({
      data
    })
  }

  /**
   * 고객 업데이트
   */
  async update(id: number, data: Prisma.CustomerUpdateInput): Promise<Customer> {
    return prisma.customer.update({
      where: { id },
      data
    })
  }

  /**
   * 고객 삭제
   */
  async delete(id: number): Promise<Customer> {
    return prisma.customer.delete({
      where: { id }
    })
  }

  /**
   * 고객 개수 조회
   */
  async count(filter?: Partial<CustomerFilter>): Promise<number> {
    const where: Prisma.CustomerWhereInput = {}

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search } },
        { phone: { contains: filter.search } },
        { email: { contains: filter.search } }
      ]
    }

    return prisma.customer.count({ where })
  }

  /**
   * 주문 정보와 함께 고객 조회
   */
  async findByIdWithOrders(id: number) {
    return prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })
  }

  /**
   * 고객별 주문 통계
   */
  async getCustomerStats(id: number) {
    const orders = await prisma.order.findMany({
      where: { customerId: id },
      select: {
        totalAmount: true,
        paymentStatus: true,
        createdAt: true
      }
    })

    const orderCount = orders.length
    const totalOrderAmount = orders
      .filter(o => o.paymentStatus === 'PAID')
      .reduce((sum, o) => sum + o.totalAmount, 0)
    const lastOrderDate = orders.length > 0 ? orders[0].createdAt : null

    return {
      orderCount,
      totalOrderAmount,
      lastOrderDate
    }
  }
}

// Singleton 인스턴스
export const customerRepository = new CustomerRepository()
