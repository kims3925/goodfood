import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * POST /api/admin/wholesale-orders/:wholesaleChannelId/mark-preparing
 * 해당 도매처의 PAID 상태 주문들을 PREPARING 상태로 변경
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wholesaleChannelId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { wholesaleChannelId } = await params
    const channelId = parseInt(wholesaleChannelId)

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json(
        { success: false, error: '기간(from, to)은 필수입니다.' },
        { status: 400 }
      )
    }

    const fromDate = new Date(from)
    fromDate.setHours(0, 0, 0, 0)
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)

    const now = new Date()

    // 공통 쿼리 조건 (Product의 channelId 참조 - 소싱 출처인 도매처)
    const productCondition = {
      userId: user.userId,
      product: {
        channelId: channelId,
      },
    }

    // 1. 회원 주문 업데이트 - PAID 상태이고 해당 도매채널의 상품이 포함된 주문들 조회
    const memberOrders = await prisma.orderItem.findMany({
      where: {
        order: {
          status: 'PAID',
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
        },
        publishedProduct: productCondition,
      },
      select: {
        order: {
          select: {
            id: true,
          },
        },
      },
    })

    // 중복 제거하여 주문 ID 목록 추출
    const memberOrderIds = [...new Set(memberOrders.map(item => item.order.id))]

    // 회원 주문 상태 업데이트
    let memberUpdatedCount = 0
    if (memberOrderIds.length > 0) {
      const result = await prisma.order.updateMany({
        where: {
          id: { in: memberOrderIds },
          status: 'PAID',
        },
        data: {
          status: 'PREPARING',
          preparingAt: now,
        },
      })
      memberUpdatedCount = result.count
    }

    // 2. 비회원 주문 업데이트
    const guestOrders = await prisma.guestOrderItem.findMany({
      where: {
        guestOrder: {
          status: 'PAID',
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
        },
        publishedProduct: productCondition,
      },
      select: {
        guestOrder: {
          select: {
            id: true,
          },
        },
      },
    })

    // 중복 제거하여 주문 ID 목록 추출
    const guestOrderIds = [...new Set(guestOrders.map(item => item.guestOrder.id))]

    // 비회원 주문 상태 업데이트
    let guestUpdatedCount = 0
    if (guestOrderIds.length > 0) {
      const result = await prisma.guestOrder.updateMany({
        where: {
          id: { in: guestOrderIds },
          status: 'PAID',
        },
        data: {
          status: 'PREPARING',
          preparingAt: now,
        },
      })
      guestUpdatedCount = result.count
    }

    const totalUpdatedCount = memberUpdatedCount + guestUpdatedCount

    return NextResponse.json({
      success: true,
      updatedCount: totalUpdatedCount,
      message: `${totalUpdatedCount}건의 주문이 상품 준비중으로 변경되었습니다.`,
    })
  } catch (error) {
    console.error('주문 상태 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '상태 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
