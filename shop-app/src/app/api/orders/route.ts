/**
 * Orders API
 * 주문 생성 및 조회
 * OrderService 사용
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { getOrderService } from '@/modules/order/services/order.service'

async function getCurrentUserId(): Promise<number | null> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return null
    return typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id
  } catch {
    return null
  }
}

function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
}

const orderService = getOrderService()

/**
 * POST /api/orders
 * 주문 생성
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      items,
      customerInfo,
      shippingAddress,
      fromCart = true,
      userId,
    } = body

    // 고객 정보 검증
    if (!customerInfo?.name || !customerInfo?.phone) {
      return NextResponse.json(
        { success: false, error: '고객 정보(이름, 전화번호)는 필수입니다' },
        { status: 400 }
      )
    }

    // 배송 주소 검증
    if (!shippingAddress?.address || !shippingAddress?.postalCode) {
      return NextResponse.json(
        { success: false, error: '배송 주소는 필수입니다' },
        { status: 400 }
      )
    }

    // 사용자 ID 검증
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    let result

    if (fromCart) {
      // 장바구니에서 주문 생성
      result = await orderService.createOrderFromCart({
        userId,
        customerInfo,
        shippingAddress,
      })
    } else {
      // 직접 상품 지정
      if (!items || items.length === 0) {
        return NextResponse.json(
          { success: false, error: '주문 상품이 없습니다' },
          { status: 400 }
        )
      }

      result = await orderService.createOrderFromItems({
        userId,
        items: items.map((item: any) => ({
          publishedProductId: parseInt(item.publishedProductId),
          variantId: item.variantId ? parseInt(item.variantId) : undefined,
          quantity: item.quantity || 1,
        })),
        customerInfo,
        shippingAddress,
      })
    }

    // 장바구니 비우기 (장바구니에서 주문한 경우)
    if (fromCart) {
      const sessionId = getSessionId(req)
      await orderService.clearCartAfterOrder(userId, sessionId)
    }

    return NextResponse.json({
      success: true,
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        status: result.order.status,
        totalAmount: result.order.totalAmount,
        items: result.order.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      },
      payment: result.payment,
      message: '주문이 생성되었습니다',
    })
  } catch (error: any) {
    console.error('Orders POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 생성 실패' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/orders
 * 주문 목록 조회 (이메일 또는 주문번호 기반)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    const orderNumber = searchParams.get('orderNumber')

    if (orderNumber) {
      // 주문번호로 단건 조회
      const order = await orderService.findByOrderNumber(orderNumber)

      return NextResponse.json({
        success: true,
        order,
      })
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: '이메일 또는 주문번호가 필요합니다' },
        { status: 400 }
      )
    }

    // 이메일로 주문 목록 조회
    const orders = await orderService.findByEmail(email)

    return NextResponse.json({
      success: true,
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        itemCount: order.items.length,
        firstItemName: order.items[0]?.productName,
        orderedAt: order.orderedAt,
        paidAt: order.paidAt,
      })),
    })
  } catch (error: any) {
    console.error('Orders GET error:', error)

    // NotFoundError 처리
    if (error.name === 'NotFoundError') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: error.message || '주문 조회 실패' },
      { status: 500 }
    )
  }
}
