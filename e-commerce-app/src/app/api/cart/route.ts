/**
 * Cart API
 * 세션 기반 장바구니 CRUD
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { v4 as uuidv4 } from 'uuid'

// 세션 만료 시간 (7일)
const SESSION_EXPIRY_DAYS = 7

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

// 장바구니 조회 또는 생성
async function getOrCreateCart(sessionId: string) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS)

  let cart = await prisma.sessionCart.findUnique({
    where: { sessionId },
    include: {
      items: {
        include: {
          product: {
            include: {
              post: {
                include: {
                  images: {
                    orderBy: { sortOrder: 'asc' },
                    take: 1,
                  },
                },
              },
              variants: {
                take: 1,
              },
            },
          },
          variant: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!cart) {
    cart = await prisma.sessionCart.create({
      data: {
        sessionId,
        expiresAt,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                post: {
                  include: {
                    images: {
                      orderBy: { sortOrder: 'asc' },
                      take: 1,
                    },
                  },
                },
                variants: {
                  take: 1,
                },
              },
            },
            variant: true,
          },
        },
      },
    })
  }

  return cart
}

// 장바구니 데이터 포맷팅
function formatCart(cart: any) {
  const items = cart.items.map((item: any) => {
    const product = item.product
    const variant = item.variant
    const mainVariant = product.variants[0]
    const image = product.post?.images?.[0]?.imageUrl || product.thumbnailUrl || '/placeholder.jpg'

    return {
      id: item.id,
      productId: product.id,
      variantId: variant?.id || null,
      name: product.name,
      optionSummary: variant?.optionSummary || null,
      image,
      price: variant?.price || mainVariant?.price || product.price || 0,
      quantity: item.quantity,
      stock: variant?.stock || mainVariant?.stock || 100,
    }
  })

  const totalItems = items.reduce((sum: number, item: any) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0)
  const shippingFee = subtotal >= 30000 ? 0 : 3000
  const total = subtotal + shippingFee

  return {
    id: cart.id,
    sessionId: cart.sessionId,
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
 */
export async function GET(req: NextRequest) {
  try {
    let sessionId = getSessionId(req)

    if (!sessionId) {
      sessionId = uuidv4()
      const cart = await getOrCreateCart(sessionId)
      const response = NextResponse.json({
        success: true,
        cart: formatCart(cart),
      })
      return createSessionResponse(response, sessionId)
    }

    const cart = await getOrCreateCart(sessionId)
    return NextResponse.json({
      success: true,
      cart: formatCart(cart),
    })
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
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productId, variantId, quantity = 1 } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: '상품 ID는 필수입니다' },
        { status: 400 }
      )
    }

    // 상품 확인
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: { variants: { take: 1 } },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 세션 ID 가져오기 또는 생성
    let sessionId = getSessionId(req)
    const isNewSession = !sessionId

    if (!sessionId) {
      sessionId = uuidv4()
    }

    const cart = await getOrCreateCart(sessionId)
    const price = product.variants[0]?.price || product.price || 0

    // 기존 아이템 확인
    const existingItem = await prisma.sessionCartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: parseInt(productId),
        variantId: variantId ? parseInt(variantId) : null,
      },
    })

    if (existingItem) {
      // 수량 업데이트
      await prisma.sessionCartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + parseInt(quantity) },
      })
    } else {
      // 새 아이템 추가
      await prisma.sessionCartItem.create({
        data: {
          cartId: cart.id,
          productId: parseInt(productId),
          variantId: variantId ? parseInt(variantId) : null,
          quantity: parseInt(quantity),
          priceAt: price,
        },
      })
    }

    // 업데이트된 장바구니 조회
    const updatedCart = await getOrCreateCart(sessionId)
    const response = NextResponse.json({
      success: true,
      cart: formatCart(updatedCart),
      message: '장바구니에 추가되었습니다',
    })

    if (isNewSession) {
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
 */
export async function PUT(req: NextRequest) {
  try {
    const sessionId = getSessionId(req)
    if (!sessionId) {
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

    const cart = await prisma.sessionCart.findUnique({
      where: { sessionId },
    })

    if (!cart) {
      return NextResponse.json(
        { success: false, error: '장바구니를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (quantity <= 0) {
      // 삭제
      await prisma.sessionCartItem.delete({
        where: { id: parseInt(itemId), cartId: cart.id },
      })
    } else {
      // 수량 업데이트
      await prisma.sessionCartItem.update({
        where: { id: parseInt(itemId), cartId: cart.id },
        data: { quantity: parseInt(quantity) },
      })
    }

    const updatedCart = await getOrCreateCart(sessionId)
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
 */
export async function DELETE(req: NextRequest) {
  try {
    const sessionId = getSessionId(req)
    if (!sessionId) {
      return NextResponse.json({
        success: true,
        message: '장바구니가 이미 비어있습니다',
      })
    }

    const cart = await prisma.sessionCart.findUnique({
      where: { sessionId },
    })

    if (cart) {
      await prisma.sessionCartItem.deleteMany({
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
