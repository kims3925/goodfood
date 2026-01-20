export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * DELETE /api/order/external/member/:id
 * 외부 회원 주문 삭제
 */
export async function DELETE(
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

    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 주문 ID입니다.' },
        { status: 400 }
      )
    }

    // 외부 주문 확인 (주문번호가 'x'로 시작하는지)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, userId: true },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 권한 확인
    if (order.userId !== user.userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 외부 주문인지 확인
    if (!order.orderNumber.toLowerCase().startsWith('x')) {
      return NextResponse.json(
        { success: false, error: '외부 주문만 삭제할 수 있습니다.' },
        { status: 400 }
      )
    }

    // Soft Delete (취소 처리로 대체)
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: '외부 주문 삭제',
        cancelledBy: 'admin',
      },
    })

    return NextResponse.json({
      success: true,
      message: '주문이 삭제되었습니다.',
    })
  } catch (error) {
    console.error('외부 회원 주문 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
