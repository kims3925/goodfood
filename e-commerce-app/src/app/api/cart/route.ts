/**
 * Cart API
 * 세션 + 사용자 기반 장바구니 CRUD
 * 로그인 사용자는 userId로 장바구니 관리
 * product_publish 기반으로 변경
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus } from '@bandauto/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { v4 as uuidv4 } from 'uuid'

// 세션 만료 시간 (7일)
const SESSION_EXPIRY_DAYS = 7
// 로그인 사용자 장바구니 만료 시간 (30일)
const USER_CART_EXPIRY_DAYS = 30

function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
}

function createSessionResponse(response: NextResponse, sessionId: string): NextResponse {
  response.cookies.set('cart_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * SESSION_EXPIRY_DAYS,
  })
  return response
}

// 현재 로그인한 사용자 ID 가져오기
async function getCurrentUserId(): Promise<number | null> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return null
    return typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id
  } catch {
    return null
  }
}

// 장바구니 조회에 필요한 include 옵션
const cartIncludeOptions = {
  items: {
    include: {
      productPublish: {
        include: {
          product: {
            include: {
              post: {
                include: {
                  images: {
                    orderBy: { sortOrder: 'asc' as const },
                    take: 1,
                  },
                },
              },
              variants: {
                take: 1,
              },
            },
          },
          retailBand: true,
        },
      },
      variant: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
}

/**
 * 장바구니 조회 또는 생성
 *
 * 핵심 로직:
 * - 로그인 사용자: userId로만 장바구니 관리 (세션과 완전 분리)
 * - 비로그인 사용자: sessionId로만 장바구니 관리 (userId가 null인 것만)
 * - 로그인 시: 비로그인 세션 카트가 있으면 → 사용자 카트로 이전
 * - 로그아웃 시: 사용자 카트는 그대로 유지, 새 세션 카트 시작
 */
async function getOrCreateCart(sessionId: string, userId: number | null = null) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + (userId ? USER_CART_EXPIRY_DAYS : SESSION_EXPIRY_DAYS))

  // ========== 로그인 사용자인 경우 ==========
  if (userId) {
    // 1. 사용자 ID로 기존 장바구니 찾기
    let userCart = await prisma.cart.findFirst({
      where: { userId },
      include: cartIncludeOptions,
    })

    // 2. 비로그인 세션 카트 찾기 (userId가 null인 세션 카트만)
    const sessionCart = await prisma.cart.findFirst({
      where: {
        sessionId,
        userId: null, // 중요: 사용자가 연결되지 않은 세션 카트만
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
        const newSessionId = `user_${userId}_${Date.now()}`
        try {
          userCart = await prisma.cart.create({
            data: { sessionId: newSessionId, userId, expiresAt },
            include: cartIncludeOptions,
          })
          return userCart
        } catch (error: any) {
          if (error.code === 'P2002') {
            // 이미 존재하면 다시 조회
            userCart = await prisma.cart.findFirst({
              where: { userId },
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
      // 세션 장바구니 아이템들을 사용자 장바구니로 이동
      for (const item of sessionCart.items) {
        const existingItem = userCart.items.find(
          (ui: any) => ui.productPublishId === item.productPublishId && ui.variantId === item.variantId
        )
        if (existingItem) {
          // 이미 있으면 수량 합산
          await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: existingItem.quantity + item.quantity },
          })
          // 세션 카트의 중복 아이템 삭제
          await prisma.cartItem.delete({
            where: { id: item.id },
          })
        } else {
          // 없으면 아이템을 사용자 카트로 이동
          await prisma.cartItem.update({
            where: { id: item.id },
            data: { cartId: userCart.id },
          })
        }
      }
      // 빈 세션 장바구니 삭제
      await prisma.cart.delete({ where: { id: sessionCart.id } })

      // 업데이트된 장바구니 다시 조회
      userCart = await prisma.cart.findUnique({
        where: { id: userCart.id },
        include: cartIncludeOptions,
      })
    }

    // 만료 시간 업데이트
    if (userCart) {
      await prisma.cart.update({
        where: { id: userCart.id },
        data: { expiresAt },
      })
    }

    return userCart!
  }

  // ========== 비로그인 사용자 - 세션 기반 ==========
  // 중요: userId가 null인 세션 카트만 조회/생성
  try {
    // 먼저 userId가 null인 세션 카트 찾기
    let cart = await prisma.cart.findFirst({
      where: {
        sessionId,
        userId: null, // 사용자가 연결되지 않은 세션 카트만
      },
      include: cartIncludeOptions,
    })

    if (cart) {
      // 만료 시간 업데이트
      await prisma.cart.update({
        where: { id: cart.id },
        data: { expiresAt },
      })
      return cart
    }

    // 없으면 새로 생성
    cart = await prisma.cart.create({
      data: { sessionId, expiresAt, userId: null },
      include: cartIncludeOptions,
    })
    return cart
  } catch (error: any) {
    if (error.code === 'P2002') {
      // unique constraint 에러 - sessionId가 이미 사용 중(다른 userId로)
      // userId가 null인 카트 다시 조회
      const existingCart = await prisma.cart.findFirst({
        where: {
          sessionId,
          userId: null,
        },
        include: cartIncludeOptions,
      })
      if (existingCart) return existingCart

      // sessionId가 다른 userId에 연결되어 있음 - 새 sessionId로 카트 생성
      const newSessionId = uuidv4()
      const newCart = await prisma.cart.create({
        data: { sessionId: newSessionId, expiresAt, userId: null },
        include: cartIncludeOptions,
      })
      // 새 sessionId를 카트 객체에 표시 (호출자가 쿠키 업데이트 할 수 있도록)
      ;(newCart as any).__newSessionId = newSessionId
      return newCart
    }
    throw error
  }
}

// 장바구니 데이터 포맷팅
function formatCart(cart: any) {
  const items = cart.items.map((item: any) => {
    const productPublish = item.productPublish
    const product = productPublish.product
    const variant = item.variant
    const mainVariant = product.variants[0]
    const image = product.post?.images?.[0]?.imageUrl || product.thumbnailUrl || '/placeholder.jpg'

    return {
      id: item.id,
      productPublishId: productPublish.id,
      productId: product.id,
      variantId: variant?.id || null,
      retailBandId: productPublish.retailBandId,
      retailBandName: productPublish.retailBand?.name || null,
      name: product.name,
      optionSummary: variant?.optionSummary || null,
      image,
      price: variant?.price || mainVariant?.price || product.price || 0,
      quantity: item.quantity,
      stock: variant?.stock || mainVariant?.stock || 100,
    }
  })

  // 모든 아이템이 동일한 retailBandId를 가지고 있는지 확인
  const retailBandIds = items.map((item: any) => item.retailBandId).filter(Boolean)
  const uniqueRetailBandIds = [...new Set(retailBandIds)]
  const retailBandId = uniqueRetailBandIds.length === 1 ? uniqueRetailBandIds[0] : null

  const totalItems = items.reduce((sum: number, item: any) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0)
  const shippingFee = subtotal >= 30000 ? 0 : 3000
  const total = subtotal + shippingFee

  return {
    id: cart.id,
    sessionId: cart.sessionId,
    retailBandId,
    items,
    totalItems,
    subtotal,
    shippingFee,
    total,
  }
}

/**
 * GET /api/cart
 * 장바구니 조회
 * 로그인 사용자는 userId로 조회, 비로그인은 세션으로 조회
 */
export async function GET(req: NextRequest) {
  try {
    let sessionId = getSessionId(req)
    const userId = await getCurrentUserId()

    // 세션 ID가 없으면 생성
    if (!sessionId) {
      sessionId = uuidv4()
    }

    const cart = await getOrCreateCart(sessionId, userId)

    // 새 sessionId가 생성되었는지 확인 (unique 충돌로 인해)
    const newSessionId = (cart as any).__newSessionId
    if (newSessionId) {
      sessionId = newSessionId
    }

    const response = NextResponse.json({
      success: true,
      cart: formatCart(cart),
      isLoggedIn: !!userId,
    })

    // 세션 쿠키 설정 (새 세션이거나 sessionId가 변경된 경우)
    if ((!getSessionId(req) || newSessionId) && sessionId) {
      return createSessionResponse(response, sessionId)
    }

    return response
  } catch (error: any) {
    console.error('Cart GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '장바구니 조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cart
 * 장바구니에 상품 추가
 * productPublishId를 받아서 처리
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productPublishId, variantId, quantity = 1, sessionId: bodySessionId } = body

    if (!productPublishId) {
      return NextResponse.json(
        { success: false, error: 'productPublishId는 필수입니다' },
        { status: 400 }
      )
    }

    // productPublish 확인 (STATUS가 SUCCESS인 것만)
    const productPublish = await prisma.productPublish.findFirst({
      where: {
        id: parseInt(productPublishId),
        status: PublishStatus.SUCCESS,
      },
      include: {
        product: {
          include: {
            variants: { take: 1 },
          },
        },
      },
    })

    if (!productPublish) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없거나 판매 중인 상품이 아닙니다' },
        { status: 404 }
      )
    }

    // 세션 ID 가져오기 또는 생성
    let sessionId = getSessionId(req) || bodySessionId
    const isNewSession = !getSessionId(req)
    const userId = await getCurrentUserId()

    if (!sessionId) {
      sessionId = uuidv4()
    }

    const cart = await getOrCreateCart(sessionId, userId)
    const price = productPublish.product.variants[0]?.price || productPublish.product.price || 0

    // 새 sessionId가 생성되었는지 확인 (unique 충돌로 인해)
    const newSessionId = (cart as any).__newSessionId
    if (newSessionId) {
      sessionId = newSessionId
    }

    // 기존 아이템 확인
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productPublishId: parseInt(productPublishId),
        variantId: variantId ? parseInt(variantId) : null,
      },
    })

    const isExisting = !!existingItem

    if (existingItem) {
      // 수량 업데이트
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + parseInt(quantity) },
      })
    } else {
      // 새 아이템 추가
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productPublishId: parseInt(productPublishId),
          variantId: variantId ? parseInt(variantId) : null,
          quantity: parseInt(quantity),
          priceAt: price,
        },
      })
    }

    // 업데이트된 장바구니 조회
    const updatedCart = await getOrCreateCart(sessionId, userId)
    const response = NextResponse.json({
      success: true,
      cart: formatCart(updatedCart),
      message: '장바구니에 추가되었습니다',
      isExisting, // 이미 담긴 상품의 수량 추가 여부
    })

    // 새 세션이거나 sessionId가 변경된 경우 쿠키 업데이트
    if (isNewSession || newSessionId) {
      return createSessionResponse(response, sessionId)
    }

    return response
  } catch (error: any) {
    console.error('Cart POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '장바구니 추가 실패' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/cart
 * 장바구니 아이템 수량 업데이트
 * 로그인 사용자: userId로 카트 찾기
 * 비로그인 사용자: sessionId + userId=null로 카트 찾기
 */
export async function PUT(req: NextRequest) {
  try {
    const sessionId = getSessionId(req)
    const userId = await getCurrentUserId()

    if (!sessionId && !userId) {
      return NextResponse.json(
        { success: false, error: '장바구니가 없습니다' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { itemId, quantity } = body

    if (!itemId || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: '아이템 ID와 수량은 필수입니다' },
        { status: 400 }
      )
    }

    // 로그인 여부에 따라 다른 카트 찾기
    let cart
    if (userId) {
      // 로그인 사용자: userId로만 찾기
      cart = await prisma.cart.findFirst({
        where: { userId },
      })
    } else if (sessionId) {
      // 비로그인 사용자: sessionId + userId가 null인 것만
      cart = await prisma.cart.findFirst({
        where: {
          sessionId,
          userId: null,
        },
      })
    }

    if (!cart) {
      return NextResponse.json(
        { success: false, error: '장바구니를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (quantity <= 0) {
      // 삭제
      await prisma.cartItem.delete({
        where: { id: parseInt(itemId), cartId: cart.id },
      })
    } else {
      // 수량 업데이트
      await prisma.cartItem.update({
        where: { id: parseInt(itemId), cartId: cart.id },
        data: { quantity: parseInt(quantity) },
      })
    }

    const updatedCart = await getOrCreateCart(sessionId || cart.sessionId, userId)
    return NextResponse.json({
      success: true,
      cart: formatCart(updatedCart),
    })
  } catch (error: any) {
    console.error('Cart PUT error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '장바구니 업데이트 실패' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cart
 * 장바구니 전체 비우기
 * 로그인 사용자: userId 카트만 비우기
 * 비로그인 사용자: 세션 카트만 비우기
 */
export async function DELETE(req: NextRequest) {
  try {
    const sessionId = getSessionId(req)
    const userId = await getCurrentUserId()

    if (!sessionId && !userId) {
      return NextResponse.json({
        success: true,
        message: '장바구니가 이미 비어있습니다',
      })
    }

    // 로그인 여부에 따라 다른 카트 찾기
    let cart
    if (userId) {
      // 로그인 사용자: userId 카트만
      cart = await prisma.cart.findFirst({
        where: { userId },
      })
    } else if (sessionId) {
      // 비로그인 사용자: 세션 카트만 (userId가 null인 것)
      cart = await prisma.cart.findFirst({
        where: {
          sessionId,
          userId: null,
        },
      })
    }

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      })
    }

    return NextResponse.json({
      success: true,
      message: '장바구니가 비워졌습니다',
    })
  } catch (error: any) {
    console.error('Cart DELETE error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '장바구니 삭제 실패' },
      { status: 500 }
    )
  }
}
