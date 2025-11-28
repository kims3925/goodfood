import prisma from '@bandauto/db'
import type { OrderListParams, OrderCreateInput } from '../types/order.types'

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

    const total = await prisma.orderTest.count({ where })

    const orders = await (prisma.orderTest as any).findMany({
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
    return (prisma.orderTest as any).create({
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
