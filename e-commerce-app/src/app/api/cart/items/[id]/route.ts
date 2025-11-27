/**
 * Cart Item API
 * 장바구니 아이템 개별 조작
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
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
    const sessionId = getSessionId(req)
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: '장바구니가 없습니다' },
        { status: 400 }
      )
    }

    const itemId = parseInt(params.id)
    if (isNaN(itemId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 아이템 ID' },
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

    await prisma.sessionCartItem.delete({
      where: { id: itemId, cartId: cart.id },
    })

    return NextResponse.json({
      success: true,
      message: '상품이 삭제되었습니다',
    })
  } catch (error: any) {
    console.error('Cart item DELETE error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '삭제 실패' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/cart/items/[id]
 * 장바구니 아이템 수량 업데이트
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = getSessionId(req)
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: '장바구니가 없습니다' },
        { status: 400 }
      )
    }

    const itemId = parseInt(params.id)
    if (isNaN(itemId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 아이템 ID' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { quantity } = body

    if (quantity === undefined || quantity < 1) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 수량' },
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

    await prisma.sessionCartItem.update({
      where: { id: itemId, cartId: cart.id },
      data: { quantity },
    })

    return NextResponse.json({
      success: true,
      message: '수량이 업데이트되었습니다',
    })
  } catch (error: any) {
    console.error('Cart item PATCH error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '업데이트 실패' },
      { status: 500 }
    )
  }
}
