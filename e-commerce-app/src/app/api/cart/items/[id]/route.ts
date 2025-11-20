/**
 * Cart Item API Routes
 * 장바구니 아이템별 수정/삭제 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { cartService } from '@/modules/cart/domain/src/cart/services/cart.service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * PATCH /api/cart/items/[id]
 * 장바구니 아이템 수량 변경
 * Body: { quantity: number }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()
    const { quantity } = body
    const itemId = parseInt(params.id)

    if (!quantity || quantity < 0) {
      return NextResponse.json(
        { error: '유효한 수량을 입력해주세요' },
        { status: 400 }
      )
    }

    const sessionId = req.cookies.get('cart_session')?.value

    if (!sessionId && !session?.user?.id) {
      return NextResponse.json(
        { error: '세션 또는 로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = session?.user?.id ? parseInt(session.user.id) : undefined

    const cart = await cartService.updateItemQuantity(
      sessionId || '',
      itemId,
      parseInt(quantity),
      userId
    )

    return NextResponse.json({ cart })
  } catch (error: any) {
    console.error('Cart item PATCH error:', error)
    return NextResponse.json(
      { error: error.message || '수량 변경 실패' },
      { status: error.statusCode || 500 }
    )
  }
}

/**
 * DELETE /api/cart/items/[id]
 * 장바구니 아이템 삭제
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const itemId = parseInt(params.id)

    const sessionId = req.cookies.get('cart_session')?.value

    if (!sessionId && !session?.user?.id) {
      return NextResponse.json(
        { error: '세션 또는 로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = session?.user?.id ? parseInt(session.user.id) : undefined

    const cart = await cartService.removeItemFromCart(
      sessionId || '',
      itemId,
      userId
    )

    return NextResponse.json({ cart })
  } catch (error: any) {
    console.error('Cart item DELETE error:', error)
    return NextResponse.json(
      { error: error.message || '아이템 삭제 실패' },
      { status: error.statusCode || 500 }
    )
  }
}
