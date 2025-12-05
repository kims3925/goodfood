import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/order/unified/[id]
 * 주문 상세 조회
 */
export async function GET(
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
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') // SHOPPING_MALL or GOOGLE_FORM

    if (source === 'SHOPPING_MALL') {
      const order = await prisma.order.findFirst({
        where: {
          id: parseInt(id),
          items: {
            some: {
              publishedProduct: {
                userId: user.userId,
              },
            },
          },
        },
        include: {
          shippingAddress: true,
          items: {
            include: {
              publishedProduct: {
                include: {
                  product: true,
                },
              },
            },
          },
          payment: true,
        },
      })

      if (!order) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: order,
      })
    } else if (source === 'GOOGLE_FORM') {
      const order = await prisma.orderTest.findFirst({
        where: {
          id: parseInt(id),
          userId: user.userId,
        },
        include: {
          publishedProduct: {
            include: {
              product: true,
            },
          },
        },
      })

      if (!order) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: order,
      })
    }

    return NextResponse.json(
      { success: false, error: 'source 파라미터가 필요합니다.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('주문 상세 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/order/unified/[id]
 * 주문 상태 변경
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

    const { id } = await params
    const body = await request.json()
    const { source, status } = body

    if (!source || !status) {
      return NextResponse.json(
        { success: false, error: 'source와 status가 필요합니다.' },
        { status: 400 }
      )
    }

    if (source === 'SHOPPING_MALL') {
      // 권한 확인: 관리자가 발행한 상품이 포함된 주문인지
      const order = await prisma.order.findFirst({
        where: {
          id: parseInt(id),
          items: {
            some: {
              publishedProduct: {
                userId: user.userId,
              },
            },
          },
        },
      })

      if (!order) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없거나 권한이 없습니다.' },
          { status: 404 }
        )
      }

      // 유효한 상태인지 확인
      const validStatuses = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 상태입니다.' },
          { status: 400 }
        )
      }

      // 상태 변경 시 관련 날짜 필드도 업데이트
      const updateData: any = { status }

      switch (status) {
        case 'PAID':
          updateData.paidAt = new Date()
          break
        case 'SHIPPED':
          updateData.shippedAt = new Date()
          break
        case 'DELIVERED':
          updateData.deliveredAt = new Date()
          break
        case 'CANCELLED':
          updateData.cancelledAt = new Date()
          updateData.cancelledBy = 'ADMIN'
          break
      }

      await prisma.order.update({
        where: { id: parseInt(id) },
        data: updateData,
      })

      return NextResponse.json({
        success: true,
        message: '주문 상태가 변경되었습니다.',
      })
    } else if (source === 'GOOGLE_FORM') {
      // OrderTest는 상태 필드가 없으므로 현재는 지원 안함
      return NextResponse.json(
        { success: false, error: '밴드 주문은 상태 변경을 지원하지 않습니다.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: '유효하지 않은 source입니다.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('주문 상태 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '상태 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
