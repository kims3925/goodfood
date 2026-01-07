export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * POST /api/admin/wholesale-orders/:wholesaleChannelId/mark-shipped
 * 주문을 배송시작(SHIPPED) 상태로 변경 (발주 완료)
 *
 * Body:
 * - orderIds: { memberId?: number[], guestId?: number[] } - 선택 발주완료 시 사용
 * - markAll: boolean - true면 전체 발주완료
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

    const body = await request.json()
    const { orderIds, markAll } = body as {
      orderIds?: { memberIds?: number[], guestIds?: number[] }
      markAll?: boolean
    }

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

    let memberUpdatedCount = 0
    let guestUpdatedCount = 0

    if (markAll) {
      // 전체 발주완료: 해당 도매처의 모든 PAID/PREPARING 주문을 SHIPPED로 변경

      // 1. 회원 주문 조회
      const memberOrders = await prisma.orderItem.findMany({
        where: {
          order: {
            status: { in: ['PAID', 'PREPARING'] },
            paidAt: {
              not: null,
              gte: fromDate,
              lte: toDate,
            },
          },
          shopProduct: productCondition,
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
      if (memberOrderIds.length > 0) {
        const result = await prisma.order.updateMany({
          where: {
            id: { in: memberOrderIds },
            status: { in: ['PAID', 'PREPARING'] },
          },
          data: {
            status: 'SHIPPED',
            shippedAt: now,
          },
        })
        memberUpdatedCount = result.count
      }

      // 2. 비회원 주문 조회
      const guestOrders = await prisma.guestOrderItem.findMany({
        where: {
          guestOrder: {
            status: { in: ['PAID', 'PREPARING'] },
            paidAt: {
              not: null,
              gte: fromDate,
              lte: toDate,
            },
          },
          shopProduct: productCondition,
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
      if (guestOrderIds.length > 0) {
        const result = await prisma.guestOrder.updateMany({
          where: {
            id: { in: guestOrderIds },
            status: { in: ['PAID', 'PREPARING'] },
          },
          data: {
            status: 'SHIPPED',
            shippedAt: now,
          },
        })
        guestUpdatedCount = result.count
      }
    } else if (orderIds) {
      // 선택 발주완료: 선택된 주문만 SHIPPED로 변경

      // 회원 주문 업데이트
      if (orderIds.memberIds && orderIds.memberIds.length > 0) {
        const result = await prisma.order.updateMany({
          where: {
            id: { in: orderIds.memberIds },
            status: { in: ['PAID', 'PREPARING'] },
          },
          data: {
            status: 'SHIPPED',
            shippedAt: now,
          },
        })
        memberUpdatedCount = result.count
      }

      // 비회원 주문 업데이트
      if (orderIds.guestIds && orderIds.guestIds.length > 0) {
        const result = await prisma.guestOrder.updateMany({
          where: {
            id: { in: orderIds.guestIds },
            status: { in: ['PAID', 'PREPARING'] },
          },
          data: {
            status: 'SHIPPED',
            shippedAt: now,
          },
        })
        guestUpdatedCount = result.count
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'orderIds 또는 markAll이 필요합니다.' },
        { status: 400 }
      )
    }

    const totalUpdatedCount = memberUpdatedCount + guestUpdatedCount

    return NextResponse.json({
      success: true,
      updatedCount: totalUpdatedCount,
      memberUpdatedCount,
      guestUpdatedCount,
      message: `${totalUpdatedCount}건의 주문이 발주 완료(배송시작) 처리되었습니다.`,
    })
  } catch (error) {
    console.error('발주 완료 처리 실패:', error)
    return NextResponse.json(
      { success: false, error: '발주 완료 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
