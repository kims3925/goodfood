import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, OrderStatus } from '@prisma/client'
import { getCurrentUser } from '@/modules/auth/auth.service'

const prisma = new PrismaClient()

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

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.userId,
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

// PATCH: 주문 수정 (상태 변경, 메모, 배송정보 등)
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
        userId: user.userId,
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

    if (body.status) {
      updateData.status = body.status as OrderStatus

      // 상태에 따라 자동으로 시간 기록
      if (body.status === 'SHIPPING' && !existingOrder.shippedAt) {
        updateData.shippedAt = new Date()
      }
      if (body.status === 'DELIVERED' && !existingOrder.deliveredAt) {
        updateData.deliveredAt = new Date()
      }
    }

    if (body.adminMemo !== undefined) {
      updateData.adminMemo = body.adminMemo
    }

    if (body.trackingNumber !== undefined) {
      updateData.trackingNumber = body.trackingNumber
    }

    if (body.customerAddress !== undefined) {
      updateData.customerAddress = body.customerAddress
    }

    if (body.quantity !== undefined) {
      updateData.quantity = body.quantity
    }

    if (body.unitPrice !== undefined) {
      updateData.unitPrice = body.unitPrice
    }

    if (body.totalPrice !== undefined) {
      updateData.totalPrice = body.totalPrice
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

// DELETE: 주문 삭제
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

    // 기존 주문 확인
    const existingOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.userId,
      },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 주문 삭제
    await prisma.order.delete({
      where: { id: orderId },
    })

    return NextResponse.json({
      success: true,
      message: '주문이 삭제되었습니다.',
    })
  } catch (error) {
    console.error('주문 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
