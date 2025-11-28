import prisma from '@bandauto/db'
import { Cart, CartItem, Product } from '@bandauto/db'
import { RepositoryError, NotFoundError } from '@/modules/common/utils/src/errors/types'
import { logError } from '@/modules/common/utils/src/helpers/logger'

export interface CartWithItems extends Cart {
  items: (CartItem & { product: Product })[]
}

/**
 * Cart Repository (에러 추적 개선 버전)
 *
 * 개선사항:
 * - 명확한 에러 메시지
 * - 에러 컨텍스트 정보 포함
 * - 커스텀 에러 클래스 사용
 * - 에러 로깅 추가
 */
export class CartRepositoryImproved {
  /**
   * 세션 또는 사용자 ID로 장바구니 조회
   */
  async findBySessionOrUser(
    sessionId?: string,
    userId?: number
  ): Promise<CartWithItems | null> {
    try {
      // 입력 검증
      if (!sessionId && !userId) {
        throw new RepositoryError('세션 ID 또는 사용자 ID가 필요합니다.', {
          method: 'findBySessionOrUser',
          sessionId,
          userId
        })
      }

      const cart = await prisma.cart.findFirst({
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

      return cart as CartWithItems | null
    } catch (error) {
      // 이미 RepositoryError인 경우 그대로 throw
      if (error instanceof RepositoryError) {
        throw error
      }

      // 다른 에러는 RepositoryError로 래핑
      logError(error as Error, {
        repository: 'CartRepository',
        method: 'findBySessionOrUser',
        sessionId,
        userId: userId as any
      } as any)

      throw new RepositoryError(
        '장바구니 조회 중 오류가 발생했습니다.',
        {
          method: 'findBySessionOrUser',
          sessionId,
          userId: userId as any
        },
        error as Error
      )
    }
  }

  /**
   * 장바구니 ID로 조회
   */
  async findById(cartId: number): Promise<CartWithItems | null> {
    try {
      if (!cartId) {
        throw new RepositoryError('장바구니 ID가 필요합니다.', {
          method: 'findById',
          cartId
        })
      }

      const cart = await prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: { product: true },
            orderBy: { createdAt: 'desc' }
          }
        }
      })

      return cart
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error
      }

      logError(error as Error, {
        repository: 'CartRepository',
        method: 'findById',
        cartId
      })

      throw new RepositoryError(
        '장바구니 조회 중 오류가 발생했습니다.',
        { method: 'findById', cartId },
        error as Error
      )
    }
  }

  /**
   * 장바구니 생성
   */
  async create(data: { sessionId?: string; userId?: number }): Promise<Cart> {
    try {
      if (!data.sessionId && !data.userId) {
        throw new RepositoryError('세션 ID 또는 사용자 ID가 필요합니다.', {
          method: 'create',
          data
        })
      }

      const cart = await prisma.cart.create({ data: data as any })

      return cart
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error
      }

      logError(error as Error, {
        repository: 'CartRepository',
        method: 'create',
        data
      })

      throw new RepositoryError(
        '장바구니 생성 중 오류가 발생했습니다.',
        { method: 'create', data },
        error as Error
      )
    }
  }

  /**
   * 장바구니 아이템 추가
   */
  async addItem(
    cartId: number,
    productId: number,
    quantity: number,
    priceAt: number
  ): Promise<CartItem> {
    try {
      // 입력 검증
      if (!cartId || !productId) {
        throw new RepositoryError('장바구니 ID와 상품 ID가 필요합니다.', {
          method: 'addItem',
          cartId,
          productId,
          quantity,
          priceAt
        })
      }

      if (quantity <= 0) {
        throw new RepositoryError('수량은 1개 이상이어야 합니다.', {
          method: 'addItem',
          quantity
        })
      }

      if (priceAt <= 0) {
        throw new RepositoryError('가격은 0보다 커야 합니다.', {
          method: 'addItem',
          priceAt
        })
      }

      const item = await prisma.cartItem.create({
        data: { cartId, productId, quantity, priceAt }
      })

      return item
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error
      }

      logError(error as Error, {
        repository: 'CartRepository',
        method: 'addItem',
        cartId,
        productId,
        quantity,
        priceAt
      })

      throw new RepositoryError(
        '장바구니 아이템 추가 중 오류가 발생했습니다.',
        { method: 'addItem', cartId, productId, quantity, priceAt },
        error as Error
      )
    }
  }

  /**
   * 장바구니 아이템 찾기 (cartId + productId)
   */
  async findItem(cartId: number, productId: number): Promise<CartItem | null> {
    try {
      if (!cartId || !productId) {
        throw new RepositoryError('장바구니 ID와 상품 ID가 필요합니다.', {
          method: 'findItem',
          cartId,
          productId
        })
      }

      const item = await prisma.cartItem.findUnique({
        where: {
          cartId_productId: { cartId, productId }
        }
      })

      return item
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error
      }

      logError(error as Error, {
        repository: 'CartRepository',
        method: 'findItem',
        cartId,
        productId
      })

      throw new RepositoryError(
        '장바구니 아이템 조회 중 오류가 발생했습니다.',
        { method: 'findItem', cartId, productId },
        error as Error
      )
    }
  }

  /**
   * 장바구니 아이템 수량 업데이트
   */
  async updateItemQuantity(itemId: number, quantity: number): Promise<CartItem> {
    try {
      if (!itemId) {
        throw new RepositoryError('아이템 ID가 필요합니다.', {
          method: 'updateItemQuantity',
          itemId
        })
      }

      if (quantity <= 0) {
        throw new RepositoryError('수량은 1개 이상이어야 합니다.', {
          method: 'updateItemQuantity',
          quantity
        })
      }

      const item = await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity, updatedAt: new Date() }
      })

      return item
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error
      }

      // Prisma Not Found 에러 처리
      if ((error as any).code === 'P2025') {
        throw new NotFoundError('장바구니 아이템', String(itemId), {
          method: 'updateItemQuantity'
        })
      }

      logError(error as Error, {
        repository: 'CartRepository',
        method: 'updateItemQuantity',
        itemId,
        quantity
      })

      throw new RepositoryError(
        '장바구니 아이템 수량 업데이트 중 오류가 발생했습니다.',
        { method: 'updateItemQuantity', itemId, quantity },
        error as Error
      )
    }
  }

  /**
   * 장바구니 아이템 삭제
   */
  async removeItem(itemId: number): Promise<CartItem> {
    try {
      if (!itemId) {
        throw new RepositoryError('아이템 ID가 필요합니다.', {
          method: 'removeItem',
          itemId
        })
      }

      const item = await prisma.cartItem.delete({ where: { id: itemId } })

      return item
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error
      }

      // Prisma Not Found 에러 처리
      if ((error as any).code === 'P2025') {
        throw new NotFoundError('장바구니 아이템', String(itemId), {
          method: 'removeItem'
        })
      }

      logError(error as Error, {
        repository: 'CartRepository',
        method: 'removeItem',
        itemId
      })

      throw new RepositoryError(
        '장바구니 아이템 삭제 중 오류가 발생했습니다.',
        { method: 'removeItem', itemId },
        error as Error
      )
    }
  }

  /**
   * 장바구니 아이템 수 조회
   */
  async countItems(cartId: number): Promise<number> {
    try {
      if (!cartId) {
        throw new RepositoryError('장바구니 ID가 필요합니다.', {
          method: 'countItems',
          cartId
        })
      }

      const count = await prisma.cartItem.count({ where: { cartId } })

      return count
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error
      }

      logError(error as Error, {
        repository: 'CartRepository',
        method: 'countItems',
        cartId
      })

      throw new RepositoryError(
        '장바구니 아이템 수 조회 중 오류가 발생했습니다.',
        { method: 'countItems', cartId },
        error as Error
      )
    }
  }

  /**
   * 장바구니 삭제
   */
  async deleteCart(cartId: number): Promise<Cart> {
    try {
      if (!cartId) {
        throw new RepositoryError('장바구니 ID가 필요합니다.', {
          method: 'deleteCart',
          cartId
        })
      }

      const cart = await prisma.cart.delete({ where: { id: cartId } })

      return cart
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error
      }

      // Prisma Not Found 에러 처리
      if ((error as any).code === 'P2025') {
        throw new NotFoundError('장바구니', String(cartId), {
          method: 'deleteCart'
        })
      }

      logError(error as Error, {
        repository: 'CartRepository',
        method: 'deleteCart',
        cartId
      })

      throw new RepositoryError(
        '장바구니 삭제 중 오류가 발생했습니다.',
        { method: 'deleteCart', cartId },
        error as Error
      )
    }
  }
}

// 싱글톤 인스턴스
let instance: CartRepositoryImproved | null = null

export function getCartRepositoryImproved(): CartRepositoryImproved {
  if (!instance) {
    instance = new CartRepositoryImproved()
  }
  return instance
}
