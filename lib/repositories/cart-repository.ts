import prisma from '@/lib/db'
import { Cart, CartItem, Product } from '@prisma/client'

export interface CartWithItems extends Cart {
  items: (CartItem & { product: Product })[]
}

/**
 * Cart Repository - 장바구니 데이터 접근 레이어
 *
 * Context 격리를 위해 모든 DB 쿼리를 이 클래스에서 관리합니다.
 * 비즈니스 로직은 CartService에서 처리합니다.
 */
export class CartRepository {
  /**
   * 세션 또는 사용자 ID로 장바구니 조회
   */
  async findBySessionOrUser(
    sessionId?: string,
    userId?: string
  ): Promise<CartWithItems | null> {
    if (!sessionId && !userId) return null

    return await prisma.cart.findFirst({
      where: {
        OR: [
          { sessionId: sessionId || undefined },
          { userId: userId || undefined }
        ]
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                salePrice: true,
                images: true,
                isAvailable: true,
                shippingFee: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })
  }

  /**
   * 장바구니 ID로 조회
   */
  async findById(cartId: string): Promise<CartWithItems | null> {
    return await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: { product: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    })
  }

  /**
   * 장바구니 생성
   */
  async create(data: { sessionId?: string; userId?: string }): Promise<Cart> {
    return await prisma.cart.create({ data })
  }

  /**
   * 장바구니 아이템 추가
   */
  async addItem(
    cartId: string,
    productId: string,
    quantity: number,
    priceAt: number
  ): Promise<CartItem> {
    return await prisma.cartItem.create({
      data: { cartId, productId, quantity, priceAt }
    })
  }

  /**
   * 장바구니 아이템 찾기 (cartId + productId)
   */
  async findItem(cartId: string, productId: string): Promise<CartItem | null> {
    return await prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId, productId }
      }
    })
  }

  /**
   * 장바구니 아이템 ID로 찾기
   */
  async findItemById(itemId: string): Promise<CartItem | null> {
    return await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true }
    })
  }

  /**
   * 장바구니 아이템 수량 업데이트
   */
  async updateItemQuantity(itemId: string, quantity: number): Promise<CartItem> {
    return await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity, updatedAt: new Date() }
    })
  }

  /**
   * 장바구니 아이템 삭제
   */
  async removeItem(itemId: string): Promise<CartItem> {
    return await prisma.cartItem.delete({ where: { id: itemId } })
  }

  /**
   * 장바구니의 모든 아이템 삭제
   */
  async clearAllItems(cartId: string): Promise<{ count: number }> {
    return await prisma.cartItem.deleteMany({ where: { cartId } })
  }

  /**
   * 장바구니 비우기 (Cart 자체 삭제)
   */
  async deleteCart(cartId: string): Promise<Cart> {
    return await prisma.cart.delete({ where: { id: cartId } })
  }

  /**
   * 장바구니 아이템 수 조회
   */
  async countItems(cartId: string): Promise<number> {
    return await prisma.cartItem.count({ where: { cartId } })
  }

  /**
   * 장바구니 업데이트 시간 갱신
   */
  async touch(cartId: string): Promise<Cart> {
    return await prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() }
    })
  }

  /**
   * 세션 장바구니를 사용자 장바구니로 전환
   */
  async transferToUser(cartId: string, userId: string): Promise<Cart> {
    return await prisma.cart.update({
      where: { id: cartId },
      data: { userId }
    })
  }

  /**
   * 특정 상품이 장바구니에 있는지 확인
   */
  async hasProduct(cartId: string, productId: string): Promise<boolean> {
    const count = await prisma.cartItem.count({
      where: { cartId, productId }
    })
    return count > 0
  }
}

// 싱글톤 인스턴스
let instance: CartRepository | null = null

export function getCartRepository(): CartRepository {
  if (!instance) {
    instance = new CartRepository()
  }
  return instance
}
