/**
 * 인박스 에스컬레이션 알림 헬퍼 (작업지시서 §6)
 *
 * shouldEscalate() 가 true 반환 시 호출 → Notification DB 레코드 생성.
 * 기존 알림 시스템(Notification)을 재사용하여 /sourcing/notification 에서
 * 동일하게 표시. 클릭 시 /sourcing/inbox?messageId=N 으로 이동.
 *
 * type='INQUIRY' (기존 enum 재사용 — "고객 문의 → 사장님 검토 필요" 의미상 일치)
 */

import prisma from '@bandauto/db'

const CHANNEL_LABELS: Record<string, string> = {
  BAND_COMMENT: '밴드 댓글',
  BAND_CHAT: '밴드 채팅',
  KAKAO: '카카오톡',
  SMS: 'SMS',
}

const INTENT_LABELS: Record<string, string> = {
  ORDER: '주문',
  PRICE: '가격문의',
  STOCK: '재고문의',
  DELIVERY: '배송문의',
  PAYMENT: '결제안내',
  DEPOSIT: '입금확인',
  RETURN: '교환/반품',
  COMPLAINT: '불만',
  RESTOCK: '재입고',
  RECOMMEND: '추천',
  INFO: '영업정보',
  GENERAL: '잡담',
}

export async function createInboxEscalationNotification(
  messageId: number,
  reason: string
): Promise<void> {
  try {
    const msg = await prisma.inboxMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        userId: true,
        channel: true,
        senderName: true,
        senderId: true,
        content: true,
        intent: true,
      },
    })
    if (!msg) return

    // 본인 활성 쇼핑몰 1개 (있으면 shopId 채움)
    const shop = await prisma.shop.findFirst({
      where: { userId: msg.userId, isActive: true, deletedAt: null },
      select: { id: true },
    })

    const channelLabel = CHANNEL_LABELS[msg.channel] || msg.channel
    const intentLabel = msg.intent ? INTENT_LABELS[msg.intent] || msg.intent : '미분류'
    const sender = msg.senderName || msg.senderId
    const preview = msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content

    await prisma.notification.create({
      data: {
        userId: msg.userId,
        shopId: shop?.id ?? null,
        section: 'sourcing', // /sourcing/notification 에 표시
        type: 'INQUIRY',
        title: `[${channelLabel}] AI 검토 필요 — ${intentLabel}`,
        message: `${sender}: ${preview}\n사유: ${reason}`,
        link: `/sourcing/inbox?messageId=${messageId}`,
        metadata: {
          inboxMessageId: messageId,
          channel: msg.channel,
          intent: msg.intent,
          reason,
        } as any,
      },
    })
  } catch (err) {
    console.error('[Inbox Notifier] 알림 생성 실패:', err)
  }
}

/**
 * 자동 주문 생성 시 알림 (어드민/사장님이 검토 후 입금 확인)
 */
export async function createInboxAutoOrderNotification(
  messageId: number,
  orderInfo: { orderNumber: string; totalAmount: number; productName: string; quantity: number }
): Promise<void> {
  try {
    const msg = await prisma.inboxMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        userId: true,
        channel: true,
        senderName: true,
        senderId: true,
      },
    })
    if (!msg) return

    const shop = await prisma.shop.findFirst({
      where: { userId: msg.userId, isActive: true, deletedAt: null },
      select: { id: true },
    })

    const channelLabel = CHANNEL_LABELS[msg.channel] || msg.channel
    const sender = msg.senderName || msg.senderId

    await prisma.notification.create({
      data: {
        userId: msg.userId,
        shopId: shop?.id ?? null,
        section: 'sourcing',
        type: 'ORDER',
        title: `[${channelLabel}] AI 자동 주문 접수`,
        message: `${sender}: ${orderInfo.productName} × ${orderInfo.quantity} (${orderInfo.totalAmount.toLocaleString('ko-KR')}원) — 주문번호 ${orderInfo.orderNumber}, 입금 대기 중`,
        link: `/sourcing/inbox?messageId=${messageId}`,
        metadata: {
          inboxMessageId: messageId,
          channel: msg.channel,
          orderNumber: orderInfo.orderNumber,
          totalAmount: orderInfo.totalAmount,
        } as any,
      },
    })
  } catch (err) {
    console.error('[Inbox Notifier] 자동 주문 알림 실패:', err)
  }
}
