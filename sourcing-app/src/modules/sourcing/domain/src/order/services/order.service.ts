import { orderRepository } from '../repository/order.repository'
import type { OrderListParams } from '../types/order.types'

export class OrderService {
  async getList(params: OrderListParams) {
    return orderRepository.findMany(params)
  }

  async create(userId: number, data: { productName: string; totalPrice?: number; customerName: string }) {
    // 사용자 확인
    const user = await orderRepository.findUserById(userId)
    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다.')
    }

    // 상품명으로 Product 매칭 시도
    let productId: number | null = null
    const matchedProduct = await orderRepository.findProductByName(userId, data.productName)
    if (matchedProduct) {
      productId = matchedProduct.id
    }

    return {
      order: await orderRepository.create({
        userId,
        productId,
        productName: data.productName,
        totalPrice: data.totalPrice || null,
        customerName: data.customerName,
      }),
      isMatched: !!productId,
    }
  }
}

export const orderService = new OrderService()
