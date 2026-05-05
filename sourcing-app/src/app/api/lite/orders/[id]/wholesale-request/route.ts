/**
 * POST /api/lite/orders/[id]/wholesale-request
 * Lite Manager — 반자동 발주 트리거 (A6 + C5)
 *
 * F6 (반자동 발주 트리거) 명세:
 *  - 셀러가 직접 [발주 요청] 버튼 클릭
 *  - 자동 실행 절대 금지 — "사람이 버튼 누르기"
 *  - 결과: Order.wholesaleOrderStatus = 'ORDERED', wholesaleOrderedAt = NOW
 *  - OrderEvent 'wholesale_requested' 기록
 *  - 도매처 fan-out (카톡/밴드/구글시트 알림)는 Phase 3 — 일단 OrderEvent 만 남김
 *
 * 권한:
 *  - 셀러는 자기 운영 shop 의 주문에만 발주 요청 가능
 *  - Order.status 가 PAID/PREPARING 이어야 함 (이미 결제 완료)
 *  - wholesaleOrderStatus 가 ORDERED 면 중복 발주 차단
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { id: idParam } = await params
    const orderId = Number(idParam)
    if (!orderId || Number.isNaN(orderId)) {
      return NextResponse.json({ success: false, error: '잘못된 orderId' }, { status: 400 })
    }

    // 셀러의 운영 shop 확인 + 주문 권한 검증
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        shop: { userId: user.userId, isActive: true },
      },
      select: {
        id: true,
        status: true,
        orderNumber: true,
        wholesaleOrderStatus: true,
        wholesaleOrderedAt: true,
        shopId: true,
        items: {
          select: {
            productName: true,
            optionSummary: true,
            quantity: true,
            shopProduct: {
              select: {
                product: { select: { channelId: true } }, // 도매 채널
              },
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

    if (!['PAID', 'PREPARING', 'SHIPPED'].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: `현재 상태(${order.status})에서는 발주 요청할 수 없습니다.` },
        { status: 400 }
      )
    }

    if (order.wholesaleOrderStatus === 'ORDERED' || order.wholesaleOrderStatus === 'CONFIRMED') {
      return NextResponse.json(
        {
          success: false,
          error: '이미 발주 요청된 주문입니다.',
          code: 'ALREADY_ORDERED',
          orderedAt: order.wholesaleOrderedAt,
        },
        { status: 400 }
      )
    }

    // 도매 채널 결정 — 첫 OrderItem 의 product.channelId 사용 (단일 채널 가정)
    // (여러 도매방 혼합 주문은 Pro 정산에서 분해)
    const channelId = order.items[0]?.shopProduct?.product?.channelId ?? null

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        wholesaleOrderStatus: 'ORDERED',
        wholesaleChannelId: channelId,
        wholesaleOrderedAt: new Date(),
        status: order.status === 'PAID' ? 'PREPARING' : order.status, // PAID → PREPARING
        preparingAt: order.status === 'PAID' ? new Date() : undefined,
      },
      select: { id: true, status: true, wholesaleOrderStatus: true, wholesaleOrderedAt: true, wholesaleChannelId: true },
    })

    // 도매처 fan-out 메시지 미리보기 (Phase 3 실제 발송 — 카톡/밴드/구글시트)
    const itemSummary = order.items
      .slice(0, 5)
      .map((it) => `- ${it.productName}${it.optionSummary ? ` (${it.optionSummary})` : ''} × ${it.quantity}`)
      .join('\n')
    const dispatchPreview = [
      `[발주 요청] 주문번호 ${order.orderNumber}`,
      itemSummary,
      order.items.length > 5 ? `(외 ${order.items.length - 5}건)` : '',
    ]
      .filter(Boolean)
      .join('\n')

    // OrderEvent 기록 — 감사 로그 + 향후 fan-out worker 가 읽음
    try {
      await prisma.orderEvent.create({
        data: {
          orderId,
          type: 'wholesale_requested',
          payload: {
            requestedByUserId: user.userId,
            channelId,
            dispatchPreview,
            triggeredAt: new Date().toISOString(),
          } as any,
        },
      })
    } catch (err) {
      console.warn('[Lite Wholesale Request] OrderEvent INSERT skip:', (err as Error).message)
    }

    return NextResponse.json({
      success: true,
      order: updated,
      dispatchPreview,
      note: '발주 요청이 기록되었습니다. 도매처 자동 알림은 Phase 3 에서 활성화됩니다.',
    })
  } catch (error: any) {
    console.error('[Lite Wholesale Request] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '발주 요청 중 오류' },
      { status: 500 }
    )
  }
}
