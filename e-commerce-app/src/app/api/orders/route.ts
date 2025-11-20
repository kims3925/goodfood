/**
 * Orders API Routes
 * 주문 생성 및 조회 API 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server'
import { orderService } from '@/modules/order/domain/src/orders/services/order.service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/orders
 * 주문 생성
 * Body: {
 *   productId: number,
 *   quantity: number,
 *   customerInfo: { name: string, phone: string, email?: string, memo?: string },
 *   shippingAddress: { zipCode: string, address: string, detailAddress: string }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()

    const {
      productId,
      quantity,
      customerInfo,
      shippingAddress
    } = body

    // 입력 검증
    if (!productId) {
      return NextResponse.json(
        { error: '상품 ID는 필수입니다' },
        { status: 400 }
      )
    }

    if (!quantity || quantity < 1) {
      return NextResponse.json(
        { error: '수량은 1개 이상이어야 합니다' },
        { status: 400 }
      )
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.phone) {
      return NextResponse.json(
        { error: '고객 정보(이름, 전화번호)는 필수입니다' },
        { status: 400 }
      )
    }

    if (!shippingAddress || !shippingAddress.address) {
      return NextResponse.json(
        { error: '배송 주소는 필수입니다' },
        { status: 400 }
      )
    }

    // 세션 ID 가져오기
    const sessionId = req.cookies.get('cart_session')?.value
    const userId = session?.user?.id ? parseInt(session.user.id) : undefined

    // 주문 생성
    const result = await orderService.createOrder({
      productId: parseInt(productId),
      quantity: parseInt(quantity),
      customerInfo,
      shippingAddress,
      sessionId,
      userId
    })

    console.log('주문 생성 성공:', result.order.orderNumber)

    return NextResponse.json({
      success: true,
      order: result.order,
      payment: result.paymentRequest,
      message: '주문이 성공적으로 생성되었습니다'
    })
  } catch (error: any) {
    console.error('주문 생성 오류:', error)

    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (error.name === 'NotFoundError') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    if (error.name === 'BusinessLogicError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: '주문 생성 중 오류가 발생했습니다',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/orders
 * 주문 목록 조회 (로그인 사용자의 주문만)
 * Query: page, limit, status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status') || undefined

    const userId = parseInt(session.user.id)

    // 주문 목록 조회
    const result = await orderService.getUserOrders(userId, {
      page,
      limit,
      status
    })

    return NextResponse.json({
      orders: result.orders,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    })
  } catch (error: any) {
    console.error('주문 목록 조회 오류:', error)

    return NextResponse.json(
      {
        error: '주문 목록 조회 중 오류가 발생했습니다',
        details: error.message
      },
      { status: 500 }
    )
  }
}
