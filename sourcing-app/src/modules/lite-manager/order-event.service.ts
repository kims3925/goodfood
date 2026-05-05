/**
 * Lite Manager — 주문 이벤트 발행 서비스
 *
 * 주문이 생성/상태변경 될 때 호출되어:
 *  1) DB OrderEvent INSERT (감사 로그)
 *  2) liteEventBus emit (실시간 SSE push)
 *
 * 호출 위치:
 *  - 주문 생성 webhook (shop-app 의 결제 완료 처리)
 *  - 관리자 수동 발주 트리거 (Phase 2)
 *  - 테스트 endpoint /api/lite/events/test (개발/베타 검증용)
 */
import prisma from '@bandauto/db'
import { liteEventBus, type LiteOrderCreatedPayload } from '@/lib/lite-events'
import { maskName, maskPhone } from '@/lib/lite-mask'

/**
 * 주문 발생 이벤트 — DB 기록 + SSE 푸시
 */
export async function emitOrderCreated(orderId: number): Promise<{
  success: boolean
  reason?: string
  payload?: LiteOrderCreatedPayload
}> {
  // 주문 + 셀러 정보 조회
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        select: {
          productName: true,
          optionSummary: true,
          quantity: true,
        },
        take: 1,
      },
      shippingAddress: {
        select: {
          recipientName: true,
          recipientPhone: true,
        },
      },
      shop: {
        select: {
          id: true,
          userId: true, // 셀러 user.id
        },
      },
    },
  })

  if (!order) {
    return { success: false, reason: 'order_not_found' }
  }

  // 셀러 user.id 결정 — Order.shop.userId 가 셀러 (구매자는 Order.userId)
  const sellerUserId = order.shop?.userId
  if (!sellerUserId) {
    return { success: false, reason: 'seller_not_resolved' }
  }

  const itemCount = await prisma.orderItem.count({ where: { orderId } })
  const topItem = order.items[0] || null

  const payload: LiteOrderCreatedPayload = {
    orderId: order.id,
    shopId: order.shopId,
    userId: sellerUserId,
    totalAmount: Number(order.totalAmount),
    itemCount,
    buyer: {
      name: maskName(order.shippingAddress?.recipientName),
      phone: maskPhone(order.shippingAddress?.recipientPhone),
    },
    topItem: topItem
      ? {
          productName: topItem.productName,
          optionSummary: topItem.optionSummary,
          quantity: topItem.quantity,
        }
      : null,
    orderedAt: order.orderedAt.toISOString(),
  }

  // DB 기록 — 멱등성 위해 중복 방지 (동일 orderId+type 이미 존재 시 skip)
  try {
    await prisma.orderEvent.create({
      data: {
        orderId,
        type: 'created',
        payload: payload as any,
      },
    })
  } catch (err) {
    // 중복 등은 무시 (이미 emit 된 적 있음)
    console.warn('[LiteOrderEvent] DB insert 실패 (skip):', (err as Error).message)
  }

  // 실시간 SSE 푸시
  liteEventBus.emitOrderCreated(payload)

  return { success: true, payload }
}
