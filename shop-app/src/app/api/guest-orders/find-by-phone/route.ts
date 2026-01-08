export const dynamic = 'force-dynamic'

/**
 * 비회원 주문 목록 조회 API
 * 휴대폰번호 + 주문자이름으로 조회 (주문번호를 모를 때 사용)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

/**
 * POST /api/guest-orders/find-by-phone
 * 휴대폰번호 + 이름으로 비회원 주문 목록 조회
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, name } = body

    // 입력 검증
    if (!phone) {
      return NextResponse.json(
        { success: false, error: '휴대폰번호를 입력해주세요' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: '주문자 이름을 입력해주세요' },
        { status: 400 }
      )
    }

    // 휴대폰번호 정규화 (하이픈 제거)
    const normalizedPhone = phone.replace(/-/g, '')
    const trimmedName = name.trim()

    // 최근 90일 이내 주문만 조회 (보안상 제한)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    // 비회원 주문 목록 조회
    const guestOrders = await prisma.guestOrder.findMany({
      where: {
        guestPhone: normalizedPhone,
        guestName: trimmedName,
        orderedAt: {
          gte: ninetyDaysAgo,
        },
      },
      include: {
        items: {
          take: 1, // 대표 상품 1개만
          include: {
            shopProduct: {
              include: {
                product: {
                  select: {
                    name: true,
                    thumbnailUrl: true,
                  },
                },
              },
            },
          },
        },
        payment: {
          select: {
            status: true,
            method: true,
          },
        },
      },
      orderBy: {
        orderedAt: 'desc',
      },
      take: 20, // 최대 20건
    })

    if (guestOrders.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '주문 내역을 찾을 수 없습니다. 입력하신 정보를 다시 확인해주세요.'
        },
        { status: 404 }
      )
    }

    // 응답 형식 변환 (주문번호 일부 마스킹 없이 전체 표시)
    const orders = guestOrders.map((order) => {
      const firstItem = order.items[0]
      const itemCount = order.items.length

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        // 대표 상품 정보
        representativeItem: {
          name: firstItem?.productName || firstItem?.shopProduct?.product?.name || '상품',
          thumbnailUrl: firstItem?.thumbnailUrl || firstItem?.shopProduct?.product?.thumbnailUrl,
          itemCount, // 총 상품 수
        },
        // 금액 정보
        totalAmount: Number(order.totalAmount),
        // 일시 정보
        orderedAt: order.orderedAt.toISOString(),
        // 결제 상태
        paymentStatus: order.payment?.status || null,
        paymentMethod: order.payment?.method || null,
      }
    })

    return NextResponse.json({
      success: true,
      orders,
      totalCount: orders.length,
    })
  } catch (error: any) {
    console.error('Guest order find-by-phone error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 조회 실패' },
      { status: 500 }
    )
  }
}
