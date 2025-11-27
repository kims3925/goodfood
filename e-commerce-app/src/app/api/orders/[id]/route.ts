/**
 * Order Detail API
 * 특정 주문 상세 조회, 수정, 삭제 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { orderService } from '@/modules/order/domain/src/orders/services/order.service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'

/**
 * 주문번호/ID로 주문 찾기 헬퍼
 */
async function findOrder(idOrOrderNumber: string) {
  // 숫자인 경우 ID로 검색
  if (/^\d+$/.test(idOrOrderNumber)) {
    return await prisma.order.findUnique({
      where: { id: parseInt(idOrOrderNumber) },
      include: {
        payment: true,
        items: true,
        user: true
      }
    })
  }
  // 그 외는 orderNumber로 검색
  return await prisma.order.findUnique({
    where: { orderNumber: idOrOrderNumber },
    include: {
      payment: true,
      items: true,
      user: true
    }
  })
}

/**
 * GET /api/orders/[id]
 * 주문 상세 조회 (id 또는 orderNumber로 조회 가능)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const orderId = params.id

    // 주문 조회
    const order = await orderService.getOrderById(orderId)

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 권한 확인 (본인 주문이거나 관리자인 경우만)
    const userId = parseInt(session.user.id)
    if (order.customer.id !== userId && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      )
    }

    return NextResponse.json({ order })
  } catch (error: any) {
    console.error('주문 상세 조회 오류:', error)

    return NextResponse.json(
      {
        error: '주문 상세 조회 중 오류가 발생했습니다',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/orders/[id]
 * 주문 상태 업데이트 (관리자 전용)
 * Body: { status: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // 관리자 권한 확인
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      )
    }

    const orderId = params.id
    const body = await req.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: '상태값은 필수입니다' },
        { status: 400 }
      )
    }

    // 주문 상태 업데이트
    const order = await orderService.updateOrder(orderId, { status })

    return NextResponse.json({
      success: true,
      order,
      message: '주문 상태가 업데이트되었습니다'
    })
  } catch (error: any) {
    console.error('주문 상태 업데이트 오류:', error)

    return NextResponse.json(
      {
        error: '주문 상태 업데이트 중 오류가 발생했습니다',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/orders/[id]
 * 주문 삭제 (결제 실패 시, id 또는 orderNumber 사용 가능)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const idOrOrderNumber = params.id

    // 주문 확인
    const order = await findOrder(idOrOrderNumber)

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 이미 결제가 완료된 주문은 삭제할 수 없음
    if (order.payment && order.payment.status === 'DONE') {
      return NextResponse.json(
        { success: false, error: '결제가 완료된 주문은 삭제할 수 없습니다' },
        { status: 400 }
      )
    }

    // PENDING 상태의 주문만 삭제 가능
    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'PENDING 상태의 주문만 삭제할 수 있습니다' },
        { status: 400 }
      )
    }

    // 주문 및 관련 데이터 삭제 (트랜잭션)
    await prisma.$transaction(async (tx) => {
      // OrderItem 삭제
      await tx.orderItem.deleteMany({
        where: { orderId: order.id },
      })

      // Payment 삭제 (있는 경우)
      if (order.payment) {
        await tx.payment.delete({
          where: { orderId: order.id },
        })
      }

      // Order 삭제
      await tx.order.delete({
        where: { id: order.id },
      })
    })

    console.log(`주문 삭제 완료: ${order.orderNumber} (결제 실패)`)

    return NextResponse.json({
      success: true,
      message: '주문이 삭제되었습니다',
    })
  } catch (error: any) {
    console.error('Order DELETE error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 삭제 실패' },
      { status: 500 }
    )
  }
}
