/**
 * 자동 주문 생성 (작업지시서 §3 시나리오 1: ORDER)
 *
 * AI 가 의도='ORDER' 로 분류 + productName/quantity 추출 시 자동 호출.
 * GuestOrder PENDING 상태로 생성 → 사장님은 입금 확인 후 PAID 처리.
 *
 * 안전 정책:
 * - 신뢰도 < 0.7 이면 생성 중단 (모호한 주문 방지)
 * - product 매칭 실패 시 생성 중단
 * - 동일 메시지 ID 로 이미 주문 생성됐으면 중복 생성 안함
 * - 5만원 이상 고액 주문도 일단 생성하되 isEscalated=true 별도 처리
 *
 * 미구현 (사용자 결정 필요):
 * - 수령인 주소: 메시지에 없으므로 별도 수집 단계 필요 (현재는 임시값)
 * - 수령 전화번호: 발신자 ID 가 전화번호이면 사용, 아니면 임시값
 */

import prisma from '@bandauto/db'
import type { Intent } from '@/lib/inbox-intents'

export interface AutoOrderResult {
  ok: boolean
  reason?: string
  orderId?: number
  orderNumber?: string
  totalAmount?: number
}

const MIN_CONFIDENCE_FOR_AUTO_ORDER = 0.7

/**
 * 인박스 메시지 → GuestOrder 자동 생성.
 * 호출 전 메시지의 intent='ORDER' + classifyMessage() 가 metadata 에
 * productName/quantity 를 채워둔 상태여야 함.
 */
export async function tryCreateAutoOrder(messageId: number): Promise<AutoOrderResult> {
  const msg = await prisma.inboxMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      userId: true,
      senderId: true,
      senderName: true,
      content: true,
      intent: true,
      confidence: true,
      orderId: true,
      metadata: true,
      channel: true,
    },
  })
  if (!msg) return { ok: false, reason: 'message_not_found' }
  if (msg.intent !== 'ORDER') return { ok: false, reason: 'not_order_intent' }
  if (msg.orderId) return { ok: false, reason: 'already_ordered', orderId: msg.orderId }
  if ((msg.confidence ?? 0) < MIN_CONFIDENCE_FOR_AUTO_ORDER) {
    return { ok: false, reason: `low_confidence_${msg.confidence}` }
  }

  const meta = msg.metadata as { productName?: string | null; quantity?: number | null } | null
  if (!meta?.productName) return { ok: false, reason: 'no_product_name' }
  const requestedQty = Math.max(1, Math.floor(Number(meta.quantity) || 1))

  // 본인 활성 쇼핑몰
  const shop = await prisma.shop.findFirst({
    where: { userId: msg.userId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!shop) return { ok: false, reason: 'no_shop' }

  // 상품 매칭 (ShopProduct 가 있어야 주문 가능)
  const shopProduct = await prisma.shopProduct.findFirst({
    where: {
      shopId: shop.id,
      deletedAt: null,
      product: {
        userId: msg.userId,
        deletedAt: null,
        isActive: true,
        name: { contains: String(meta.productName) },
      },
    },
    select: {
      id: true,
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          shippingFee: true,
          thumbnailUrl: true,
        },
      },
    },
  })
  if (!shopProduct?.product) return { ok: false, reason: 'product_not_found' }
  const product = shopProduct.product

  // 가격 계산 (단순 — 1개 단가 × 수량 + 배송비)
  const unitPrice = Number(product.price ?? 0)
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return { ok: false, reason: 'invalid_price' }
  }
  const subtotal = unitPrice * requestedQty
  const shippingFee = Number(product.shippingFee ?? 0)
  const totalAmount = subtotal + shippingFee

  // 주문번호 생성 (XORD- prefix 로 외부 자동 생성 식별)
  const orderNumber = `XORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  // 게스트 정보 — 메시지 발신자에서 추출
  const guestName = msg.senderName || `자동주문-${msg.senderId.slice(0, 10)}`
  // 발신자 ID 가 전화번호 형태이면 사용, 아니면 placeholder
  const phoneRe = /^[\d\-\s]{9,15}$/
  const guestPhone = phoneRe.test(msg.senderId) ? msg.senderId : '미입력'

  // Phase 4: source 매핑 (KAKAO 채널은 'KAKAO', 그 외 밴드/SMS 등은 'CHAT')
  const source: 'CHAT' | 'KAKAO' = msg.channel === 'KAKAO' ? 'KAKAO' : 'CHAT'

  const created = await prisma.$transaction(async (tx) => {
    const order = await (tx as any).guestOrder.create({
      data: {
        shopId: shop.id,
        orderNumber,
        status: 'PENDING',
        guestName,
        guestPhone,
        subtotalAmount: subtotal,
        discountAmount: 0,
        totalAmount,
        // Phase 4 — 자동변환 경로 식별 + inbox 메시지 역참조
        source,
        externalKind: 'RETAIL',
        inboxMessageId: messageId,
      },
    })
    await tx.guestOrderItem.create({
      data: {
        guestOrderId: order.id,
        shopProductId: shopProduct.id,
        productName: product.name,
        thumbnailUrl: product.thumbnailUrl,
        quantity: requestedQty,
        unitPrice,
        totalPrice: subtotal,
      },
    })
    // 인박스 메시지에 orderId 연결
    await tx.inboxMessage.update({
      where: { id: messageId },
      data: { orderId: order.id, productId: product.id },
    })
    return order
  })

  return {
    ok: true,
    orderId: created.id,
    orderNumber: created.orderNumber,
    totalAmount,
  }
}
