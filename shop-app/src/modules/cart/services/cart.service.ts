/**
 * Cart Service
 * 장바구니 비즈니스 로직 레이어
 * PublishedProduct 기반 스키마 지원
 * Shop 기반 장바구니 관리
 */

import prisma from '@bandauto/db'
import { v4 as uuidv4 } from 'uuid'
import {
  ValidationError,
  NotFoundError,
  BusinessLogicError
} from '@/modules/common/utils/src/errors/handlers'

// 세션 만료 시간 (7일)
const SESSION_EXPIRY_DAYS = 7
// 로그인 사용자 장바구니 만료 시간 (30일)
const USER_CART_EXPIRY_DAYS = 30

// ============================================
// Types
// ============================================

export interface CartItemResponse {
  id: number
  publishedProductId: number
  productId: number
  variantId: number | null
  shopId: number | null
  shopName: string | null
  channelId: number | null
  channelName: string | null
  name: string
  optionSummary: string | null
  image: string
  price: number
  quantity: number
  stock: number
  // 배송 정보
  shippingFee: number | null
  freeShippingAmount: number | null
}

export interface CartResponse {
  id: number
  sessionId: string
  shopId: number | null
  items: CartItemResponse[]
  totalItems: number
  subtotal: number
  shippingFee: number
  total: number
}

export interface AddToCartDTO {
  publishedProductId: number
  variantId?: number
  quantity?: number
}

// 장바구니 조회에 필요한 include 옵션
const cartIncludeOptions = {
  items: {
    include: {
      publishedProduct: {
        include: {
          product: {
            include: {
              collectedProduct: {
                include: {
                  post: {
                    include: {
                      images: {
                        orderBy: { sortOrder: 'asc' as const },
                        take: 1,
                      },
                    },
                  },
                },
              },
              variants: {
                take: 1,
              },
            },
          },
          shop: true,
          channel: true,
        },
      },
      variant: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
}

// 배송 정보 파싱 헬퍼
function parseShippingInfo(shippingInfoStr: string | null): { freeShippingAmount?: number } {
  if (!shippingInfoStr) return {}
  try {
    return JSON.parse(shippingInfoStr)
  } catch {
    return {}
  }
}

/**
 * 장바구니 서비스
 */
export class CartService {
  /**
   * 세션 ID 생성
   */
  generateSessionId(): string {
    return uuidv4()
  }

  /**
   * 장바구니 조회 또는 생성
   *
   * 핵심 로직:
   * - Shop별로 장바구니 분리 (shopId 파라미터)
   * - 로그인 사용자: userId + shopId로 장바구니 관리
   * - 비로그인 사용자: sessionId + shopId로 장바구니 관리
   * - 로그인 시: 동일 Shop의 비로그인 세션 카트가 있으면 → 사용자 카트로 이전
   * - 로그아웃 시: 사용자 카트는 그대로 유지, 새 세션 카트 시작
   */
  async getOrCreateCart(
    sessionId: string,
    userId: number | null = null,
    shopId: number | null = null
  ): Promise<any> {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (userId ? USER_CART_EXPIRY_DAYS : SESSION_EXPIRY_DAYS))

    // ========== 로그인 사용자인 경우 ==========
    if (userId) {
      // 1. 사용자 ID + shopId로 기존 장바구니 찾기
      let userCart = await prisma.cart.findFirst({
        where: { userId, shopId },
        include: cartIncludeOptions,
      })

      // 2. 비로그인 세션 카트 찾기 (동일 Shop, userId가 null인 세션 카트만)
      const sessionCart = await prisma.cart.findFirst({
        where: {
          sessionId,
          userId: null,
          shopId,
        },
        include: cartIncludeOptions,
      })

      // 3. 사용자 장바구니가 없는 경우
      if (!userCart) {
        if (sessionCart && sessionCart.items.length > 0) {
          // 세션 장바구니를 사용자에게 연결
          userCart = await prisma.cart.update({
            where: { id: sessionCart.id },
            data: { userId, expiresAt },
            include: cartIncludeOptions,
          })
          return userCart
        } else {
          // 새 사용자 장바구니 생성 (새로운 sessionId로)
          const newSessionId = `user_${userId}_shop${shopId || 0}_${Date.now()}`
          try {
            userCart = await prisma.cart.create({
              data: { sessionId: newSessionId, userId, shopId, expiresAt },
              include: cartIncludeOptions,
            })
            return userCart
          } catch (error: any) {
            if (error.code === 'P2002') {
              userCart = await prisma.cart.findFirst({
                where: { userId, shopId },
                include: cartIncludeOptions,
              })
              if (userCart) return userCart
            }
            throw error
          }
        }
      }

      // 4. 사용자 장바구니가 있고, 비로그인 세션 카트도 있는 경우 → 병합
      if (sessionCart && sessionCart.items.length > 0) {
        for (const item of sessionCart.items) {
          const existingItem = userCart.items.find(
            (ui: any) => ui.publishedProductId === item.publishedProductId && ui.variantId === item.variantId
          )
          if (existingItem) {
            await prisma.cartItem.update({
              where: { id: existingItem.id },
              data: { quantity: existingItem.quantity + item.quantity },
            })
            await prisma.cartItem.delete({
              where: { id: item.id },
            })
          } else {
            await prisma.cartItem.update({
              where: { id: item.id },
              data: { cartId: userCart.id },
            })
          }
        }
        await prisma.cart.delete({ where: { id: sessionCart.id } })

        userCart = await prisma.cart.findUnique({
          where: { id: userCart.id },
          include: cartIncludeOptions,
        })
      }

      if (userCart) {
        await prisma.cart.update({
          where: { id: userCart.id },
          data: { expiresAt },
        })
      }

      return userCart!
    }

    // ========== 비로그인 사용자 - 세션 + Shop 기반 ==========
    try {
      let cart = await prisma.cart.findFirst({
        where: {
          sessionId,
          userId: null,
          shopId,
        },
        include: cartIncludeOptions,
      })

      if (cart) {
        await prisma.cart.update({
          where: { id: cart.id },
          data: { expiresAt },
        })
        return cart
      }

      cart = await prisma.cart.create({
        data: { sessionId, expiresAt, userId: null, shopId },
        include: cartIncludeOptions,
      })
      return cart
    } catch (error: any) {
      if (error.code === 'P2002') {
        const existingCart = await prisma.cart.findFirst({
          where: {
            sessionId,
            userId: null,
            shopId,
          },
          include: cartIncludeOptions,
        })
        if (existingCart) return existingCart

        const newSessionId = uuidv4()
        const newCart = await prisma.cart.create({
          data: { sessionId: newSessionId, expiresAt, userId: null, shopId },
          include: cartIncludeOptions,
        })
        ;(newCart as any).__newSessionId = newSessionId
        return newCart
      }
      throw error
    }
  }

  /**
   * 장바구니 데이터 포맷팅
   */
  formatCart(cart: any): CartResponse {
    const items: CartItemResponse[] = cart.items.map((item: any) => {
      const publishedProduct = item.publishedProduct
      const product = publishedProduct.product
      const variant = item.variant
      const mainVariant = product.variants[0]
      const image = product.collectedProduct?.post?.images?.[0]?.url || product.thumbnailUrl || '/placeholder.jpg'
      const shippingInfo = parseShippingInfo(product.shippingInfo)

      return {
        id: item.id,
        publishedProductId: publishedProduct.id,
        productId: product.id,
        variantId: variant?.id || null,
        shopId: publishedProduct.shopId || null,
        shopName: publishedProduct.shop?.name || null,
        // 하위 호환성 (채널 정보)
        channelId: publishedProduct.channelId,
        channelName: publishedProduct.channel?.name || null,
        name: product.name,
        optionSummary: variant?.optionSummary || null,
        image,
        price: variant?.price || mainVariant?.price || 0,
        quantity: item.quantity,
        stock: variant?.stock || mainVariant?.stock || 100,
        // 배송 정보
        shippingFee: product.shippingFee,
        freeShippingAmount: shippingInfo.freeShippingAmount ?? null,
      }
    })

    const shopId = cart.shopId || null
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

    // 배송비 계산: 상품별 배송비 중 가장 높은 값 사용
    // 각 상품의 무료배송 기준을 만족하면 해당 상품 배송비는 0
    let shippingFee = 0
    for (const item of items) {
      const itemTotal = item.price * item.quantity
      const itemShippingFee = item.shippingFee ?? 0
      const freeShippingAmount = item.freeShippingAmount

      // 무료배송 조건 충족 여부 확인
      if (freeShippingAmount != null && itemTotal >= freeShippingAmount) {
        // 무료배송 조건 충족 - 배송비 0
        continue
      }

      // 배송비가 있는 경우, 가장 높은 배송비 적용
      if (itemShippingFee > shippingFee) {
        shippingFee = itemShippingFee
      }
    }

    const total = subtotal + shippingFee

    return {
      id: cart.id,
      sessionId: cart.sessionId,
      shopId,
      items,
      totalItems,
      subtotal,
      shippingFee,
      total,
    }
  }

  /**
   * 장바구니에 상품 추가
   */
  async addItem(
    sessionId: string,
    data: AddToCartDTO,
    userId: number | null = null,
    shopId: number | null = null
  ): Promise<{ cart: CartResponse; isExisting: boolean; newSessionId?: string }> {
    const { publishedProductId, variantId, quantity = 1 } = data

    if (!publishedProductId) {
      throw new ValidationError('publishedProductId는 필수입니다')
    }

    // publishedProduct 확인 (존재 여부 및 활성 상태 확인)
    const publishedProduct = await prisma.publishedProduct.findFirst({
      where: {
        id: publishedProductId,
      },
      include: {
        product: {
          include: {
            variants: { take: 1 },
          },
        },
      },
    })

    if (!publishedProduct) {
      throw new NotFoundError('상품', String(publishedProductId))
    }

    // 비활성(품절) 상품은 장바구니에 추가할 수 없음
    if (!publishedProduct.isActive) {
      throw new BusinessLogicError('품절된 상품은 장바구니에 담을 수 없습니다')
    }

    const cart = await this.getOrCreateCart(sessionId, userId, shopId)
    const price = publishedProduct.product.variants[0]?.price || 0

    const newSessionId = (cart as any).__newSessionId

    // 기존 아이템 확인
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        publishedProductId,
        variantId: variantId || null,
      },
    })

    const isExisting = !!existingItem

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      })
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          publishedProductId,
          variantId: variantId || null,
          quantity,
          priceAt: price,
        },
      })
    }

    const updatedCart = await this.getOrCreateCart(newSessionId || sessionId, userId, shopId)
    return {
      cart: this.formatCart(updatedCart),
      isExisting,
      newSessionId,
    }
  }

  /**
   * 장바구니 아이템 수량 업데이트
   */
  async updateItemQuantity(
    sessionId: string,
    itemId: number,
    quantity: number,
    userId: number | null = null,
    shopId: number | null = null
  ): Promise<CartResponse> {
    if (!itemId) {
      throw new ValidationError('아이템 ID는 필수입니다')
    }

    // 로그인 여부 및 Shop에 따라 다른 카트 찾기
    let cart
    if (userId) {
      cart = await prisma.cart.findFirst({
        where: { userId, shopId },
      })
    } else if (sessionId) {
      cart = await prisma.cart.findFirst({
        where: {
          sessionId,
          userId: null,
          shopId,
        },
      })
    }

    if (!cart) {
      throw new NotFoundError('장바구니', sessionId || '')
    }

    if (quantity <= 0) {
      await prisma.cartItem.delete({
        where: { id: itemId, cartId: cart.id },
      })
    } else {
      await prisma.cartItem.update({
        where: { id: itemId, cartId: cart.id },
        data: { quantity },
      })
    }

    const updatedCart = await this.getOrCreateCart(sessionId || cart.sessionId, userId, shopId)
    return this.formatCart(updatedCart)
  }

  /**
   * 장바구니에서 아이템 삭제
   */
  async removeItem(
    sessionId: string,
    itemId: number,
    userId: number | null = null,
    shopId: number | null = null
  ): Promise<CartResponse> {
    return this.updateItemQuantity(sessionId, itemId, 0, userId, shopId)
  }

  /**
   * 장바구니 전체 비우기
   */
  async clearCart(
    sessionId: string | null,
    userId: number | null = null,
    shopId: number | null = null
  ): Promise<void> {
    let cart
    if (userId) {
      cart = await prisma.cart.findFirst({
        where: { userId, shopId },
      })
    } else if (sessionId) {
      cart = await prisma.cart.findFirst({
        where: {
          sessionId,
          userId: null,
          shopId,
        },
      })
    }

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      })
    }
  }

  /**
   * 장바구니 조회 (포맷팅된 응답)
   */
  async getCart(
    sessionId: string,
    userId: number | null = null,
    shopId: number | null = null
  ): Promise<{
    cart: CartResponse
    newSessionId?: string
  }> {
    const cart = await this.getOrCreateCart(sessionId, userId, shopId)
    const newSessionId = (cart as any).__newSessionId
    return {
      cart: this.formatCart(cart),
      newSessionId,
    }
  }

  /**
   * userId로 카트 조회 (결제 처리용)
   */
  async getCartByUserId(userId: number, shopId: number | null = null): Promise<any> {
    return prisma.cart.findFirst({
      where: { userId, shopId },
      include: {
        items: {
          include: {
            publishedProduct: {
              include: {
                product: {
                  include: { variants: { take: 1 } },
                },
              },
            },
            variant: true,
          },
        },
      },
    })
  }

  /**
   * sessionId로 비로그인 카트 조회 (결제 처리용)
   */
  async getCartBySessionId(sessionId: string, shopId: number | null = null): Promise<any> {
    return prisma.cart.findFirst({
      where: {
        sessionId,
        userId: null,
        shopId,
      },
      include: {
        items: {
          include: {
            publishedProduct: {
              include: {
                product: {
                  include: { variants: { take: 1 } },
                },
              },
            },
            variant: true,
          },
        },
      },
    })
  }
}

// Singleton 인스턴스
export const cartService = new CartService()

// Factory function
export function getCartService(): CartService {
  return cartService
}
