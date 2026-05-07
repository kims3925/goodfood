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
      senderName: true,
      metadata: true,
    },
  })
  if (!msg) throw new Error('메시지를 찾을 수 없습니다.')
  if (!msg.intent || !isValidIntent(msg.intent)) {
    throw new Error('먼저 의도 분류를 실행하세요.')
  }

  const ctx = await resolveContext(msg.userId, msg.intent, msg.metadata as any)
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
  metadata?: { productName?: string | null; orderNumber?: string | null }
): Promise<ReplyContext> {
  const ctx: ReplyContext = {}

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

  // 주문 컨텍스트 (DELIVERY, DEPOSIT)
  if (['DELIVERY', 'DEPOSIT'].includes(intent)) {
    // 매칭 단순화 — 가장 최근 주문 사용. 운영에서는 senderName/phone 매칭 강화 가능.
    const recentOrder = await prisma.order.findFirst({
      where: {
        shop: { userId },
      },
      select: {
        orderNumber: true,
        status: true,
        totalAmount: true,
        items: {
          select: {
            productName: true,
            quantity: true,
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    })
    if (recentOrder) {
      ctx.order = {
        orderNumber: recentOrder.orderNumber,
        status: recentOrder.status,
        totalAmount: Number(recentOrder.totalAmount),
        items: recentOrder.items,
      }
    }
  }

  return ctx
}

export async function shouldEscalate(messageId: number): Promise<{
  escalate: boolean
  reason: string | null
}> {
  const msg = await prisma.inboxMessage.findUnique({
    where: { id: messageId },
    select: {
      intent: true,
      confidence: true,
      senderId: true,
      userId: true,
      metadata: true,
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

  // 5. 욕설/비속어 (단순 키워드 검사)
  const profanity = ['씨발', 'ㅅㅂ', '좆', '병신', '개새끼']
  const meta_ = msg.metadata as any
  // 비속어 검사는 content 가 필요하므로 별도 조회
  const content = await prisma.inboxMessage.findUnique({
    where: { id: messageId },
    select: { content: true },
  })
  if (content && profanity.some((w) => content.content.includes(w))) {
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
