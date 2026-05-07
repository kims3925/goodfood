/**
 * Inbox 서비스 — 메시지 처리 파이프라인 + 컨텍스트 조회 + 에스컬레이션 판단.
 *
 * 1. classifyMessage(messageId) — Claude 로 의도 분류 + DB 저장
 * 2. generateAndSaveReply(messageId) — AI 응답 생성 + DB 저장 (발송 X)
 * 3. shouldEscalate(message) — 사장님 알림 필요 여부 판단
 * 4. resolveContext(message) — 의도별 필요한 데이터 조회 (상품/주문/셀러)
 */

import prisma from '@bandauto/db'
import { classifyIntent } from './intent-classifier'
import { generateReply, type ReplyContext } from './reply-generator'
import {
  INTENT_ALWAYS_ESCALATE,
  isValidIntent,
  type Intent,
} from '@/lib/inbox-intents'

const ESCALATE_CONFIDENCE_THRESHOLD = 0.6
const ESCALATE_HIGH_AMOUNT = 50000 // 5만원 이상 주문은 검토
const ESCALATE_REPEAT_COUNT = 3    // 같은 발신자 3회 이상 재질문

export async function classifyMessage(messageId: number) {
  const msg = await prisma.inboxMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      content: true,
      threadId: true,
      userId: true,
      senderId: true,
    },
  })
  if (!msg) throw new Error('메시지를 찾을 수 없습니다.')

  // 같은 thread 의 최근 메시지 (컨텍스트)
  const recentMessages = await prisma.inboxMessage.findMany({
    where: { threadId: msg.threadId, id: { not: msg.id } },
    select: { content: true, direction: true, senderName: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  const result = await classifyIntent(msg.userId, msg.content, {
    recentMessages: recentMessages.map(
      (m) => `[${m.direction === 'INBOUND' ? '고객' : '셀러'}] ${m.content}`
    ),
  })

  await prisma.inboxMessage.update({
    where: { id: messageId },
    data: {
      intent: result.intent,
      confidence: result.confidence,
      metadata: {
        reasoning: result.reasoning,
        productName: result.productName,
        quantity: result.quantity,
        amount: result.amount,
      } as any,
    },
  })

  return result
}

export async function generateAndSaveReply(messageId: number) {
  const msg = await prisma.inboxMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      content: true,
      intent: true,
      userId: true,
      senderId: true,
      senderName: true,
      metadata: true,
    },
  })
  if (!msg) throw new Error('메시지를 찾을 수 없습니다.')
  if (!msg.intent || !isValidIntent(msg.intent)) {
    throw new Error('먼저 의도 분류를 실행하세요.')
  }

  // Phase 3: senderInfo 전달 → resolveContext 가 발신자 매칭 강화
  const ctx = await resolveContext(msg.userId, msg.intent, msg.metadata as any, {
    senderId: msg.senderId,
    senderName: msg.senderName,
  })
  const reply = await generateReply(msg.userId, msg.intent, msg.content, ctx)

  await prisma.inboxMessage.update({
    where: { id: messageId },
    data: { aiReply: reply },
  })

  return reply
}

export async function resolveContext(
  userId: number,
  intent: Intent,
  metadata?: { productName?: string | null; orderNumber?: string | null },
  senderInfo?: { senderId?: string | null; senderName?: string | null }
): Promise<ReplyContext & { orderMatchConfidence?: 'high' | 'low' }> {
  const ctx: ReplyContext & { orderMatchConfidence?: 'high' | 'low' } = {}

  // 셀러 정보 (모든 의도에서 필요)
  const shop = await prisma.shop.findFirst({
    where: { userId, isActive: true, deletedAt: null },
    select: {
      name: true,
      bankName: true,
      bankAccount: true,
      accountHolder: true,
      contactPhone: true,
      subdomain: true,
    },
  })
  if (shop) ctx.shop = shop

  // 상품 컨텍스트 (PRICE, STOCK, ORDER, RECOMMEND, RESTOCK)
  if (
    metadata?.productName &&
    ['PRICE', 'STOCK', 'ORDER', 'RECOMMEND', 'RESTOCK'].includes(intent)
  ) {
    const productMatch = await prisma.product.findFirst({
      where: {
        userId,
        deletedAt: null,
        isActive: true,
        name: { contains: String(metadata.productName) },
      },
      select: {
        name: true,
        price: true,
        shippingFee: true,
        description: true,
        // 재고 추적 필드는 현재 스키마 미지원 — null 로 폴백
      },
    })
    if (productMatch) {
      ctx.product = {
        name: productMatch.name,
        price: productMatch.price ? Number(productMatch.price) : null,
        shippingFee: productMatch.shippingFee,
        stock: null,
        description: productMatch.description,
      }
    }
  }

  // 주문 컨텍스트 (DELIVERY, DEPOSIT, RETURN, PAYMENT)
  // Phase 3: 발신자 매칭 강화. Order 엔 customerName 없으니 ShippingAddress.recipientName/Phone 으로 조회.
  if (['DELIVERY', 'DEPOSIT', 'RETURN', 'PAYMENT'].includes(intent)) {
    type OrderShape = {
      orderNumber: string
      status: string
      totalAmount: any
      items: Array<{ productName: string; quantity: number }>
    }
    const orderSelect = {
      orderNumber: true,
      status: true,
      totalAmount: true,
      items: {
        select: { productName: true, quantity: true },
      },
    } as const
    let matchedOrder: OrderShape | null = null
    let confidence: 'high' | 'low' = 'low'

    // 1순위: 메시지에서 추출된 주문번호로 직접 매칭
    if (metadata?.orderNumber) {
      matchedOrder = await prisma.order.findFirst({
        where: { shop: { userId }, orderNumber: metadata.orderNumber },
        select: orderSelect,
      })
      if (matchedOrder) confidence = 'high'
    }

    // 2순위: 발신자 이름/전화 → ShippingAddress.recipientName/recipientPhone 매칭
    if (!matchedOrder && (senderInfo?.senderName || senderInfo?.senderId)) {
      const phoneRe = /^[\d\s\-]{9,15}$/
      const senderIsPhone = senderInfo?.senderId && phoneRe.test(senderInfo.senderId)

      const orConds: any[] = []
      if (senderInfo?.senderName) {
        orConds.push({
          shippingAddress: { recipientName: { contains: senderInfo.senderName } },
        })
      }
      if (senderIsPhone) {
        orConds.push({
          shippingAddress: { recipientPhone: { contains: senderInfo.senderId } },
        })
      }
      if (orConds.length > 0) {
        matchedOrder = await prisma.order.findFirst({
          where: { shop: { userId }, OR: orConds },
          select: orderSelect,
          orderBy: { orderedAt: 'desc' },
        })
        if (matchedOrder) confidence = 'high'
      }
    }

    // 3순위 (폴백): 최근 주문 — 신뢰도 낮음 표시
    if (!matchedOrder) {
      matchedOrder = await prisma.order.findFirst({
        where: { shop: { userId } },
        select: orderSelect,
        orderBy: { orderedAt: 'desc' },
      })
      // confidence 는 'low' 유지 (기본값)
    }

    if (matchedOrder) {
      ctx.order = {
        orderNumber: matchedOrder.orderNumber,
        status: matchedOrder.status,
        totalAmount: Number(matchedOrder.totalAmount),
        items: matchedOrder.items,
      }
      ctx.orderMatchConfidence = confidence
    }
  }

  return ctx
}

export async function shouldEscalate(messageId: number): Promise<{
  escalate: boolean
  reason: string | null
}> {
  // Phase 8: content 도 함께 select 하여 비속어 검사 시 추가 조회 제거
  const msg = await prisma.inboxMessage.findUnique({
    where: { id: messageId },
    select: {
      intent: true,
      confidence: true,
      senderId: true,
      userId: true,
      metadata: true,
      content: true,
    },
  })
  if (!msg || !msg.intent || !isValidIntent(msg.intent)) {
    return { escalate: false, reason: null }
  }

  // 1. 의도가 항상 에스컬레이션
  if (INTENT_ALWAYS_ESCALATE[msg.intent]) {
    return { escalate: true, reason: `${msg.intent} 의도는 항상 사장님 검토 필요` }
  }

  // 2. AI 신뢰도 낮음
  if (msg.confidence != null && msg.confidence < ESCALATE_CONFIDENCE_THRESHOLD) {
    return {
      escalate: true,
      reason: `AI 분류 신뢰도 낮음 (${(msg.confidence * 100).toFixed(0)}%)`,
    }
  }

  // 3. 고액 주문
  const meta = msg.metadata as any
  const amount = Number(meta?.amount)
  if (msg.intent === 'ORDER' && Number.isFinite(amount) && amount >= ESCALATE_HIGH_AMOUNT) {
    return { escalate: true, reason: `고액 주문 (${amount.toLocaleString('ko-KR')}원)` }
  }

  // 4. 같은 발신자 반복 질문
  const repeatCount = await prisma.inboxMessage.count({
    where: {
      userId: msg.userId,
      senderId: msg.senderId,
      direction: 'INBOUND',
      isAutoReplied: true,
    },
  })
  if (repeatCount >= ESCALATE_REPEAT_COUNT) {
    return { escalate: true, reason: `같은 고객 ${repeatCount}회 재질문 — AI 해결 불가 판단` }
  }

  // 5. 욕설/비속어 — 위에서 이미 select 한 msg.content 직접 사용
  const profanity = ['씨발', 'ㅅㅂ', '좆', '병신', '개새끼']
  if (profanity.some((w) => msg.content.includes(w))) {
    return { escalate: true, reason: '비속어 감지 — AI 응답 차단' }
  }

  return { escalate: false, reason: null }
}

/**
 * 의도별 자동응답 설정 12종 시드 (idempotent upsert).
 */
export async function seedAutoReplyConfigs(userId: number) {
  const { INTENTS, INTENT_ALWAYS_ESCALATE } = await import('@/lib/inbox-intents')
  for (const intent of INTENTS) {
    await prisma.autoReplyConfig.upsert({
      where: { userId_intent: { userId, intent } },
      create: {
        userId,
        intent,
        isEnabled: true,
        escalateAlways: INTENT_ALWAYS_ESCALATE[intent],
        replyDelaySec: 30,
        maxAutoRetries: 2,
      },
      update: {},
    })
  }
}
