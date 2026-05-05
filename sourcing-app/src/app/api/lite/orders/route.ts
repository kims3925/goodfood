/**
 * GET /api/lite/orders
 * Lite Manager — 셀러용 주문 리스트 (마스킹 적용)
 *
 * F2 주문 리스트 (읽기 중심) 명세:
 *  - 시간순/상태별 주문 카드
 *  - 이름 마스킹 (홍**), 연락처 끝 4자리만
 *  - 자동 발주 호출 금지 (조회만)
 *
 * 응답 형식: { success, data: { orders: [...], total } }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { maskName, maskPhone, maskAddress } from '@/lib/lite-mask'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)
    const cursor = searchParams.get('cursor') // pagination — 마지막 ordered_at ISO

    // 셀러는 자기가 운영하는 shop 의 주문만 본다 — User.shops 의 shopIds
    const userShops = await prisma.shop.findMany({
      where: { userId: user.userId, isActive: true },
      select: { id: true },
    })
    const shopIds = userShops.map((s) => s.id)

    if (shopIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          orders: [],
          total: 0,
          hasMore: false,
          message: '아직 운영 중인 쇼핑몰이 없습니다. 마이샵에서 첫 상품을 업로드하세요.',
        },
      })
    }

    const where: any = {
      shopId: { in: shopIds },
    }

    if (status) {
      // 주문 상태 매핑 (Prisma enum)
      const statusMap: Record<string, string> = {
        pending: 'PENDING',
        paid: 'PAID',
        preparing: 'PREPARING',
        shipped: 'SHIPPED',
        delivered: 'DELIVERED',
        cancelled: 'CANCELLED',
      }
      const enumStatus = statusMap[status.toLowerCase()]
      if (enumStatus) where.status = enumStatus
    }

    if (cursor) {
      where.orderedAt = { lt: new Date(cursor) }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            select: {
              id: true,
              productName: true,
              optionSummary: true,
              quantity: true,
              unitPrice: true,
            },
          },
          shippingAddress: {
            select: {
              recipientName: true,
              recipientPhone: true,
              address: true,
              addressDetail: true,
            },
          },
          shop: {
            select: { id: true, name: true, subdomain: true },
          },
        },
        orderBy: { orderedAt: 'desc' },
        take: limit,
      }),
      prisma.order.count({ where: { shopId: { in: shopIds } } }),
    ])

    const masked = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalAmount: o.totalAmount,
      orderedAt: o.orderedAt,
      paidAt: o.paidAt,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
      shop: {
        id: o.shop?.id,
        name: o.shop?.name,
        subdomain: o.shop?.subdomain,
      },
      items: o.items.map((item) => ({
        productName: item.productName,
        optionSummary: item.optionSummary,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      // 마스킹된 구매자 정보 (Lite 강제)
      buyer: {
        name: maskName(o.shippingAddress?.recipientName),
        phone: maskPhone(o.shippingAddress?.recipientPhone),
        address: maskAddress(o.shippingAddress?.address),
      },
    }))

    return NextResponse.json({
      success: true,
      data: {
        orders: masked,
        total,
        hasMore: orders.length === limit,
        nextCursor: orders.length === limit ? orders[orders.length - 1].orderedAt.toISOString() : null,
      },
    })
  } catch (error: any) {
    console.error('[Lite Orders] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '주문 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
