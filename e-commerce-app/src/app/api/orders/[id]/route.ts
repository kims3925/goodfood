/**
 * Order Detail API
 * 특정 주문 상세 조회 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { orderService } from '@/modules/order/domain/src/orders/services/order.service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'

/**
 * GET /api/orders/[id]
 * 주문 상세 조회
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
