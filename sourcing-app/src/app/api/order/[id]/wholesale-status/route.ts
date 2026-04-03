export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * PATCH /api/order/[id]/wholesale-status
 * 도매 발주 상태 업데이트 (카톡 발주 완료 처리)
 *
 * Body:
 *   - status: 'ORDERED' | 'CONFIRMED'
 *   - wholesaleChannelId: number (optional)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { id: orderNumber } = await params
    const body = await request.json()
    const { status, wholesaleChannelId } = body

    if (!status || !['ORDERED', 'CONFIRMED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: '유효한 발주 상태가 필요합니다. (ORDERED, CONFIRMED)' },
        { status: 400 }
      )
    }

    const now = new Date()

    // 회원 주문 먼저 조회
    const order = await prisma.order.findFirst({
      where: {
        orderNumber,
        items: {
          some: {
            shopProduct: {
              userId: user.userId,
            },
          },
        },
      },
    })

    if (order) {
      await prisma.order.update({
        where: { orderNumber },
        data: {
          wholesaleOrderStatus: status,
          ...(wholesaleChannelId && { wholesaleChannelId }),
          ...(status === 'ORDERED' && !order.wholesaleOrderedAt && { wholesaleOrderedAt: now }),
        },
      })

      return NextResponse.json({
        success: true,
        message: '발주 상태가 업데이트되었습니다.',
      })
    }

    // 비회원 주문 조회
    const guestOrder = await prisma.guestOrder.findFirst({
      where: {
        orderNumber,
        items: {
          some: {
            shopProduct: {
              userId: user.userId,
            },
          },
        },
      },
    })

    if (guestOrder) {
      await prisma.guestOrder.update({
        where: { orderNumber },
        data: {
          wholesaleOrderStatus: status,
          ...(wholesaleChannelId && { wholesaleChannelId }),
          ...(status === 'ORDERED' && !guestOrder.wholesaleOrderedAt && { wholesaleOrderedAt: now }),
        },
      })

      return NextResponse.json({
        success: true,
        message: '발주 상태가 업데이트되었습니다.',
      })
    }

    return NextResponse.json(
      { success: false, error: '주문을 찾을 수 없습니다.' },
      { status: 404 }
    )
  } catch (error) {
    console.error('발주 상태 업데이트 실패:', error)
    return NextResponse.json(
      { success: false, error: '발주 상태 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}
