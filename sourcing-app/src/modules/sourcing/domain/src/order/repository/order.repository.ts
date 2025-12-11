import prisma from '@bandauto/db'
import type { OrderListParams, OrderCreateInput } from '../types/order.types'

// OrderTest 모델 타입 (Prisma에 정의되지 않은 경우를 위한 타입 단언)
const orderTestModel = (prisma as any).orderTest

export class OrderRepository {
  async findMany(params: OrderListParams) {
    const { userId, search = '', page = 1, limit = 20 } = params

    const where: any = { userId }

    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { productName: { contains: search } },
      ]
    }

    const total = await orderTestModel.count({ where })

    const orders = await orderTestModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
          },
        },
      },
    })

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async create(data: OrderCreateInput) {
    return orderTestModel.create({
      data: {
        userId: data.userId,
        productId: data.productId,
        productName: data.productName,
        totalPrice: data.totalPrice,
        customerName: data.customerName,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
          },
        },
      },
    })
  }

  async findProductByName(userId: number, productName: string) {
    return prisma.product.findFirst({
      where: {
        userId,
        OR: [
          { name: productName },
          { name: { contains: productName } },
        ],
      },
      select: { id: true },
    })
  }

  async findUserById(userId: number) {
    return prisma.user.findUnique({
      where: { id: userId },
    })
  }
}

export const orderRepository = new OrderRepository()
