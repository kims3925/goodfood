export const dynamic = 'force-dynamic'

/**
 * Cart Item API
 * 장바구니 아이템 개별 조작
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'

function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
}

async function getShopId(): Promise<number | null> {
  const headersList = await headers()
  const shopId = headersList.get('x-shop-id')
  return shopId ? parseInt(shopId) : null
}

async function getCurrentUserId(): Promise<number | null> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return null
    return typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id
  } catch {
    return null
  }
}

/**
 * 사용자 또는 세션으로 장바구니 조회 (Shop별)
 */
async function findCart(sessionId: string | null, userId: number | null, shopId: number | null) {
  // 로그인한 경우 userId + shopId로 찾기
  if (userId) {
    return prisma.cart.findFirst({
      where: { userId, shopId },
    })
  }
  // 비로그인은 sessionId + shopId로 찾기
  if (sessionId) {
    return prisma.cart.findFirst({
      where: { sessionId, shopId, userId: null },
    })
  }
  return null
}

/**
 * DELETE /api/cart/items/[id]
 * 장바구니 아이템 삭제
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionId = getSessionId(req)
    const userId = await getCurrentUserId()
    const shopId = await getShopId()

    if (!sessionId && !userId) {
      return NextResponse.json(
        { success: false, error: '장바구니가 없습니다' },
        { status: 400 }
      )
    }

    const itemId = parseInt(id)
    if (isNaN(itemId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 아이템 ID' },
        { status: 400 }
      )
    }

    const cart = await findCart(sessionId, userId, shopId)

    if (!cart) {
      return NextResponse.json(
        { success: false, error: '장바구니를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    await prisma.cartItem.delete({
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionId = getSessionId(req)
    const userId = await getCurrentUserId()
    const shopId = await getShopId()

    if (!sessionId && !userId) {
      return NextResponse.json(
        { success: false, error: '장바구니가 없습니다' },
        { status: 400 }
      )
    }

    const itemId = parseInt(id)
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

    const cart = await findCart(sessionId, userId, shopId)

    if (!cart) {
      return NextResponse.json(
        { success: false, error: '장바구니를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    await prisma.cartItem.update({
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
