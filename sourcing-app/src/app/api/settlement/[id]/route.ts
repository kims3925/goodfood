import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 정산 상세 조회
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

    const settlement = await prisma.settlement.findFirst({
      where: {
        id: parseInt(id),
        userId: user.userId,
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            coverUrl: true,
            theme: {
              select: { logoUrl: true },
            },
          },
        },
        items: {
          include: {
            // OrderItem 정보가 필요하면 별도 조회
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!settlement) {
      return NextResponse.json(
        { success: false, error: '정산을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 정산에 포함된 주문 아이템 상세 정보 조회
    const orderItemIds = settlement.items.map(i => i.orderItemId)
    const orderItems = await prisma.orderItem.findMany({
      where: { id: { in: orderItemIds } },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            orderedAt: true,
            shippingAddress: {
              select: { recipientName: true },
            },
          },
        },
      },
    })

    const orderItemMap = new Map(orderItems.map(item => [item.id, item]))

    return NextResponse.json({
      success: true,
      data: {
        id: settlement.id,
        shop: {
          id: settlement.shop.id,
          name: settlement.shop.name,
          coverUrl: settlement.shop.coverUrl,
          logoUrl: settlement.shop.theme?.logoUrl || null,
        },
        periodStart: settlement.periodStart.toISOString(),
        periodEnd: settlement.periodEnd.toISOString(),
        totalOrders: settlement.totalOrders,
        totalAmount: Number(settlement.totalAmount),
        status: settlement.status,
        memo: settlement.memo,
        settledAt: settlement.settledAt?.toISOString() || null,
        createdAt: settlement.createdAt.toISOString(),
        items: settlement.items.map(item => {
          const orderItem = orderItemMap.get(item.orderItemId)
          return {
            id: item.id,
            orderItemId: item.orderItemId,
            orderId: item.orderId,
            orderNumber: orderItem?.order?.orderNumber || null,
            customerName: orderItem?.order?.shippingAddress?.recipientName || '알 수 없음',
            productName: orderItem?.productName || null,
            thumbnailUrl: orderItem?.thumbnailUrl || null,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            orderStatus: orderItem?.order?.status || null,
            orderedAt: orderItem?.order?.orderedAt?.toISOString() || null,
          }
        }),
      },
    })
  } catch (error) {
    console.error('정산 상세 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 상세 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 정산 상태 변경
export async function PUT(
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
    const { status } = body

    if (!status || !['PENDING', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상태입니다.' },
        { status: 400 }
      )
    }

    // 기존 정산 조회
    const existingSettlement = await prisma.settlement.findFirst({
      where: {
        id: parseInt(id),
        userId: user.userId,
      },
    })

    if (!existingSettlement) {
      return NextResponse.json(
        { success: false, error: '정산을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 완료된 정산은 취소만 가능
    if (existingSettlement.status === 'COMPLETED' && status !== 'COMPLETED' && status !== 'CANCELLED') {
      return NextResponse.json(
        { success: false, error: '완료된 정산은 취소만 가능합니다.' },
        { status: 400 }
      )
    }

    // 취소된 정산은 상태 변경 불가
    if (existingSettlement.status === 'CANCELLED') {
      return NextResponse.json(
        { success: false, error: '취소된 정산은 상태를 변경할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 상태 변경
    const updateData: any = { status }
    if (status === 'COMPLETED') {
      updateData.settledAt = new Date()
    }

    const updatedSettlement = await prisma.settlement.update({
      where: { id: parseInt(id) },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedSettlement.id,
        status: updatedSettlement.status,
        settledAt: updatedSettlement.settledAt?.toISOString() || null,
        message: status === 'COMPLETED' ? '정산이 완료되었습니다.' : status === 'CANCELLED' ? '정산이 취소되었습니다.' : '정산 상태가 변경되었습니다.',
      },
    })
  } catch (error) {
    console.error('정산 상태 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 상태 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 정산 삭제
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

    // 기존 정산 조회
    const existingSettlement = await prisma.settlement.findFirst({
      where: {
        id: parseInt(id),
        userId: user.userId,
      },
    })

    if (!existingSettlement) {
      return NextResponse.json(
        { success: false, error: '정산을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 완료된 정산은 삭제 불가
    if (existingSettlement.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: '완료된 정산은 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 정산 삭제 (CASCADE로 SettlementItem도 삭제됨)
    await prisma.settlement.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: '정산이 삭제되었습니다.',
      },
    })
  } catch (error) {
    console.error('정산 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
