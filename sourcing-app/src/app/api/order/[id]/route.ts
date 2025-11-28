import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 주문 상세 조회
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
    const orderId = parseInt(id)

    // Order 조회 (OrderItem, ProductPublish, RetailBand, User 포함)
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        // 판매자 기준: 주문 아이템의 ProductPublish가 내 것인지 확인
        items: {
          some: {
            productPublish: {
              userId: user.userId,
            },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            productPublish: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    thumbnailUrl: true,
                    price: true,
                  },
                },
                retailBand: {
                  select: {
                    id: true,
                    name: true,
                    coverUrl: true,
                  },
                },
              },
            },
            variant: true,
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
  } catch (error) {
    console.error('주문 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PATCH: 주문 상태 수정
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
    const orderId = parseInt(id)
    const body = await request.json()

    // 기존 주문 확인
    const existingOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        items: {
          some: {
            productPublish: {
              userId: user.userId,
            },
          },
        },
      },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 업데이트 데이터 구성
    const updateData: any = {}

    if (body.status !== undefined) {
      updateData.status = body.status

      // 상태에 따른 타임스탬프 업데이트
      if (body.status === 'SHIPPED') {
        updateData.shippedAt = new Date()
      } else if (body.status === 'DELIVERED') {
        updateData.deliveredAt = new Date()
      } else if (body.status === 'CANCELLED') {
        updateData.cancelledAt = new Date()
      }
    }

    if (body.deliveryMemo !== undefined) {
      updateData.deliveryMemo = body.deliveryMemo
    }

    // 주문 업데이트
    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      message: '주문이 수정되었습니다.',
      data: order,
    })
  } catch (error) {
    console.error('주문 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}
