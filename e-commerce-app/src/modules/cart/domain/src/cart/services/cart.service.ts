/**
 * Cart Service
 * 장바구니 비즈니스 로직 레이어
 */

import prisma from '@bandauto/db'
import { v4 as uuidv4 } from 'uuid'
import {
  ValidationError,
  NotFoundError,
  BusinessLogicError
} from '@/modules/common/utils/src/errors/handlers'

export interface CartItem {
  id: number
  productId: number
  quantity: number
  priceAt: number
  product: {
    id: number
    title: string
    salePrice: number
    images: string
    isAvailable: boolean
    shippingFee?: number
  }
}

export interface Cart {
  id: number
  sessionId: string
  userId?: number
  items: CartItem[]
  totalItems: number
  totalAmount: number
  shippingFee: number
  finalAmount: number
}

/**
 * 장바구니 서비스
 */
export class CartService {
  /**
   * 세션 기반 장바구니 조회 (비회원 지원)
   */
  async getCartBySessionOrUser(
    sessionId: string,
    userId?: number
  ): Promise<Cart | null> {
    if (!sessionId && !userId) {
      throw new ValidationError('세션 ID 또는 사용자 ID가 필요합니다')
    }

    const cart = await prisma.cart.findFirst({
      where: {
        OR: [{ sessionId }, { userId: userId || undefined }]
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
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!cart) return null

    return this.formatCart(cart)
  }

  /**
   * 장바구니에 상품 추가
   */
  async addItemToCart(
    sessionId: string,
    productId: number,
    quantity: number = 1,
    userId?: number
  ): Promise<Cart> {
    if (!sessionId && !userId) {
      throw new ValidationError('세션 ID 또는 사용자 ID가 필요합니다')
    }

    if (!productId) {
      throw new ValidationError('상품 ID는 필수입니다')
    }

    if (quantity < 1) {
      throw new ValidationError('수량은 1개 이상이어야 합니다')
    }

    // 상품 정보 확인
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        salePrice: true,
        isAvailable: true,
        status: true
      }
    })

    if (!product) {
      throw new NotFoundError('상품', String(productId))
    }

    if (!product.isAvailable || product.status !== 'PUBLISHED') {
      throw new BusinessLogicError('현재 구매할 수 없는 상품입니다')
    }

    // 기존 장바구니 확인 또는 생성
    let cart = await prisma.cart.findFirst({
      where: {
        OR: [{ sessionId }, { userId: userId || undefined }]
      }
    })

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          sessionId,
          userId
        }
      })
    }

    // 기존 장바구니 아이템 확인
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: productId
        }
      }
    })

    if (existingItem) {
      // 수량 업데이트
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + quantity,
          updatedAt: new Date()
        }
      })
    } else {
      // 새 아이템 추가
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: productId,
          quantity: quantity,
          priceAt: product.salePrice
        }
      })
    }

    // 장바구니 업데이트 시간 갱신
    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() }
    })

    // 업데이트된 장바구니 반환
    const updatedCart = await this.getCartBySessionOrUser(sessionId, userId)
    if (!updatedCart) {
      throw new BusinessLogicError('장바구니 업데이트에 실패했습니다')
    }

    return updatedCart
  }

  /**
   * 장바구니 아이템 수량 업데이트
   */
  async updateItemQuantity(
    sessionId: string,
    itemId: number,
    quantity: number,
    userId?: number
  ): Promise<Cart> {
    if (!itemId) {
      throw new ValidationError('아이템 ID는 필수입니다')
    }

    if (quantity <= 0) {
      return await this.removeItemFromCart(sessionId, itemId, userId)
    }

    // 장바구니 확인
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [{ sessionId }, { userId: userId || undefined }]
      }
    })

    if (!cart) {
      throw new NotFoundError('장바구니', sessionId)
    }

    // 아이템 업데이트
    await prisma.cartItem.update({
      where: {
        id: itemId,
        cartId: cart.id
      },
      data: {
        quantity: quantity,
        updatedAt: new Date()
      }
    })

    // 업데이트된 장바구니 반환
    const updatedCart = await this.getCartBySessionOrUser(sessionId, userId)
    if (!updatedCart) {
      throw new BusinessLogicError('장바구니 업데이트에 실패했습니다')
    }

    return updatedCart
  }

  /**
   * 장바구니에서 상품 제거
   */
  async removeItemFromCart(
    sessionId: string,
    itemId: number,
    userId?: number
  ): Promise<Cart> {
    if (!itemId) {
      throw new ValidationError('아이템 ID는 필수입니다')
    }

    // 장바구니 확인
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [{ sessionId }, { userId: userId || undefined }]
      }
    })

    if (!cart) {
      throw new NotFoundError('장바구니', sessionId)
    }

    // 아이템 삭제
    await prisma.cartItem.delete({
      where: {
        id: itemId,
        cartId: cart.id
      }
    })

    // 장바구니가 비어있으면 삭제
    const remainingItems = await prisma.cartItem.count({
      where: { cartId: cart.id }
    })

    if (remainingItems === 0) {
      await prisma.cart.delete({
        where: { id: cart.id }
      })

      return {
        id: cart.id,
        sessionId: cart.sessionId,
        userId: cart.userId || undefined,
        items: [],
        totalItems: 0,
        totalAmount: 0,
        shippingFee: 0,
        finalAmount: 0
      }
    }

    // 업데이트된 장바구니 반환
    const updatedCart = await this.getCartBySessionOrUser(sessionId, userId)
    if (!updatedCart) {
      throw new BusinessLogicError('장바구니 업데이트에 실패했습니다')
    }

    return updatedCart
  }

  /**
   * 장바구니 전체 비우기
   */
  async clearCart(sessionId: string, userId?: number): Promise<void> {
    const cart = await prisma.cart.findFirst({
      where: {
        OR: [{ sessionId }, { userId: userId || undefined }]
      }
    })

    if (cart) {
      await prisma.cart.delete({
        where: { id: cart.id }
      })
    }
  }

  /**
   * 로그인 시 세션 장바구니를 사용자 계정으로 마이그레이션
   */
  async migrateSessionCartToUser(
    sessionId: string,
    userId: number
  ): Promise<Cart | null> {
    if (!sessionId) {
      throw new ValidationError('세션 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 세션 장바구니 조회
    const sessionCart = await prisma.cart.findFirst({
      where: { sessionId },
      include: { items: true }
    })

    if (!sessionCart || sessionCart.items.length === 0) {
      return null
    }

    // 기존 사용자 장바구니 조회
    let userCart = await prisma.cart.findFirst({
      where: { userId }
    })

    if (!userCart) {
      // 세션 장바구니를 사용자 장바구니로 전환
      await prisma.cart.update({
        where: { id: sessionCart.id },
        data: { userId }
      })
    } else {
      // 기존 사용자 장바구니에 세션 아이템들 병합
      for (const item of sessionCart.items) {
        const existingUserItem = await prisma.cartItem.findUnique({
          where: {
            cartId_productId: {
              cartId: userCart.id,
              productId: item.productId
            }
          }
        })

        if (existingUserItem) {
          // 수량 합산
          await prisma.cartItem.update({
            where: { id: existingUserItem.id },
            data: {
              quantity: existingUserItem.quantity + item.quantity
            }
          })
        } else {
          // 새 아이템 추가
          await prisma.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: item.productId,
              quantity: item.quantity,
              priceAt: item.priceAt
            }
          })
        }
      }

      // 세션 장바구니 삭제
      await prisma.cart.delete({
        where: { id: sessionCart.id }
      })
    }

    return await this.getCartBySessionOrUser(sessionId, userId)
  }

  /**
   * 장바구니 데이터 포맷팅
   */
  private formatCart(cart: any): Cart {
    const items: CartItem[] = cart.items.map((item: any) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      priceAt: item.priceAt,
      product: {
        id: item.product.id,
        title: item.product.title,
        salePrice: item.product.salePrice,
        images: item.product.images,
        isAvailable: item.product.isAvailable,
        shippingFee: item.product.shippingFee || 0
      }
    }))

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
    const totalAmount = items.reduce(
      (sum, item) => sum + item.priceAt * item.quantity,
      0
    )

    // 배송비 계산 (무료배송 기준 적용)
    const freeShippingAmount = parseFloat(
      process.env.FREE_SHIPPING_AMOUNT || '30000'
    )
    const defaultShippingFee = parseFloat(
      process.env.DEFAULT_SHIPPING_FEE || '3000'
    )
    const shippingFee =
      totalAmount >= freeShippingAmount ? 0 : defaultShippingFee

    return {
      id: cart.id,
      sessionId: cart.sessionId,
      userId: cart.userId || undefined,
      items,
      totalItems,
      totalAmount,
      shippingFee,
      finalAmount: totalAmount + shippingFee
    }
  }

  /**
   * 세션 ID 생성
   */
  generateSessionId(): string {
    return uuidv4()
  }
}

// Singleton 인스턴스
export const cartService = new CartService()
