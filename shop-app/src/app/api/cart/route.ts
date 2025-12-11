/**
 * Cart API
 * 세션 + 사용자 + Shop 기반 장바구니 CRUD
 * CartService 사용
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { getCartService } from '@/modules/cart/services/cart.service'
import { v4 as uuidv4 } from 'uuid'
import prisma from '@bandauto/db'

// 세션 만료 시간 (7일)
const SESSION_EXPIRY_DAYS = 7

function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
}

function getShopId(req: NextRequest): number | null {
  const shopIdHeader = req.headers.get('x-shop-id')
  if (shopIdHeader) {
    const parsed = parseInt(shopIdHeader)
    return isNaN(parsed) ? null : parsed
  }
  return null
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

async function getCurrentUserId(): Promise<number | null> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return null
    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    // User 존재 여부 확인 (삭제된 사용자 처리)
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })

    return userExists ? userId : null
  } catch {
    return null
  }
}

const cartService = getCartService()

/**
 * GET /api/cart
 * 장바구니 조회
 */
export async function GET(req: NextRequest) {
  try {
    let sessionId = getSessionId(req)
    const userId = await getCurrentUserId()
    const shopId = getShopId(req)

    if (!sessionId) {
      sessionId = uuidv4()
    }

    const result = await cartService.getCart(sessionId, userId, shopId)

    const response = NextResponse.json({
      success: true,
      cart: result.cart,
      isLoggedIn: !!userId,
      shopId,
    })

    if ((!getSessionId(req) || result.newSessionId) && sessionId) {
      return createSessionResponse(response, result.newSessionId || sessionId)
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
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { publishedProductId, variantId, quantity = 1, sessionId: bodySessionId } = body

    if (!publishedProductId) {
      return NextResponse.json(
        { success: false, error: 'publishedProductId는 필수입니다' },
        { status: 400 }
      )
    }

    let sessionId = getSessionId(req) || bodySessionId
    const isNewSession = !getSessionId(req)
    const userId = await getCurrentUserId()
    const shopId = getShopId(req)

    if (!sessionId) {
      sessionId = uuidv4()
    }

    const result = await cartService.addItem(
      sessionId,
      {
        publishedProductId: parseInt(publishedProductId),
        variantId: variantId ? parseInt(variantId) : undefined,
        quantity: parseInt(quantity),
      },
      userId,
      shopId
    )

    const response = NextResponse.json({
      success: true,
      cart: result.cart,
      message: '장바구니에 추가되었습니다',
      isExisting: result.isExisting,
    })

    if (isNewSession || result.newSessionId) {
      return createSessionResponse(response, result.newSessionId || sessionId)
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
    const userId = await getCurrentUserId()
    const shopId = getShopId(req)

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

    const cart = await cartService.updateItemQuantity(
      sessionId || '',
      parseInt(itemId),
      parseInt(quantity),
      userId,
      shopId
    )

    return NextResponse.json({
      success: true,
      cart,
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
    const userId = await getCurrentUserId()
    const shopId = getShopId(req)

    if (!sessionId && !userId) {
      return NextResponse.json({
        success: true,
        message: '장바구니가 이미 비어있습니다',
      })
    }

    await cartService.clearCart(sessionId, userId, shopId)

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
