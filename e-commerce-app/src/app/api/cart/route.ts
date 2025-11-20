/**
 * Cart API Routes
 * 장바구니 CRUD API 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server'
import { cartService } from '@/modules/cart/domain/src/cart/services/cart.service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/cart
 * 장바구니 조회
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionId = req.cookies.get('cart_session')?.value || cartService.generateSessionId()
    const userId = session?.user?.id ? parseInt(session.user.id) : undefined

    const cart = await cartService.getCartBySessionOrUser(sessionId, userId)

    if (!cart) {
      return NextResponse.json({
        cart: null,
        sessionId
      })
    }

    return NextResponse.json({
      cart,
      sessionId
    })
  } catch (error: any) {
    console.error('Cart GET error:', error)
    return NextResponse.json(
      { error: error.message || '장바구니 조회 실패' },
      { status: error.statusCode || 500 }
    )
  }
}

/**
 * POST /api/cart
 * 장바구니에 상품 추가
 * Body: { productId: number, quantity: number }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()
    const { productId, quantity = 1 } = body

    if (!productId) {
      return NextResponse.json(
        { error: '상품 ID는 필수입니다' },
        { status: 400 }
      )
    }

    let sessionId = req.cookies.get('cart_session')?.value
    if (!sessionId) {
      sessionId = cartService.generateSessionId()
    }

    const userId = session?.user?.id ? parseInt(session.user.id) : undefined

    const cart = await cartService.addItemToCart(
      sessionId,
      parseInt(productId),
      parseInt(quantity),
      userId
    )

    const response = NextResponse.json({ cart, sessionId })

    // 세션 ID를 쿠키에 저장 (7일)
    response.cookies.set('cart_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7일
    })

    return response
  } catch (error: any) {
    console.error('Cart POST error:', error)
    return NextResponse.json(
      { error: error.message || '장바구니 추가 실패' },
      { status: error.statusCode || 500 }
    )
  }
}

/**
 * DELETE /api/cart
 * 장바구니 전체 비우기
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionId = req.cookies.get('cart_session')?.value

    if (!sessionId && !session?.user?.id) {
      return NextResponse.json(
        { error: '세션 또는 로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = session?.user?.id ? parseInt(session.user.id) : undefined

    await cartService.clearCart(sessionId || '', userId)

    return NextResponse.json({ success: true, message: '장바구니가 비워졌습니다' })
  } catch (error: any) {
    console.error('Cart DELETE error:', error)
    return NextResponse.json(
      { error: error.message || '장바구니 삭제 실패' },
      { status: error.statusCode || 500 }
    )
  }
}
