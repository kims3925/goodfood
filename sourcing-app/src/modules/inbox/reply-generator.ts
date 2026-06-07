/**
 * AI 응답 생성기 (작업지시서 §3 시나리오)
 * 의도 + 컨텍스트 → 친근한 한국어 응답 생성.
 *
 * 컨텍스트 데이터:
 * - shop: 셀러 쇼핑몰 정보 (이름/연락처/계좌)
 * - product: 매칭된 상품 (가격/재고)
 * - order: 매칭된 주문 (상태/금액)
 */

// 오디세이우스 우선 → 실패 시 callClaude 자동 폴백 (ODYSSEUS_ENABLED=false 면 기존과 동일)
import { aiText } from '@/modules/ai/odysseus.client'
import type { Intent } from '@/lib/inbox-intents'

export interface ReplyContext {
  shop?: {
    name: string
    bankName?: string | null
    bankAccount?: string | null
    accountHolder?: string | null
    contactPhone?: string | null
    subdomain?: string | null
  } | null
  product?: {
    name: string
    price?: number | null
    shippingFee?: number | null
    stock?: number | null
    description?: string | null
  } | null
  order?: {
    orderNumber: string
    status: string
    totalAmount: number
    items?: Array<{ productName: string; quantity: number }>
  } | null
  customMessage?: string  // 의도별 커스텀 템플릿/지시
  orderMatchConfidence?: 'high' | 'low' // Phase 3: 주문 매칭 신뢰도
}

const SYSTEM_PROMPT = `당신은 한국 수산물/농산물 셀러의 친절한 고객 응대 챗봇입니다.

응답 원칙:
- 한국어로 자연스럽고 따뜻한 어투
- 짧고 명확하게 (3-5줄 권장)
- 이모지 적절히 사용 (1-2개)
- 거짓 정보 절대 금지 — 데이터에 없는 가격/재고/배송 등 추측하지 마세요
- 응답 마지막에 추가 도움 제안 (필요 시)
- 카카오톡/문자 같은 짧은 채널 친화적 어투`

function shopContextLine(ctx: ReplyContext): string {
  if (!ctx.shop) return ''
  const lines = [`- 쇼핑몰: ${ctx.shop.name}`]
  if (ctx.shop.contactPhone) lines.push(`- 연락처: ${ctx.shop.contactPhone}`)
  if (ctx.shop.bankName && ctx.shop.bankAccount) {
    lines.push(
      `- 계좌: ${ctx.shop.bankName} ${ctx.shop.bankAccount} (${ctx.shop.accountHolder || ctx.shop.name})`
    )
  }
  if (ctx.shop.subdomain) {
    lines.push(`- 쇼핑몰 URL: https://${ctx.shop.subdomain}.snsauto.kr`)
  }
  return lines.join('\n')
}

function productContextLine(ctx: ReplyContext): string {
  if (!ctx.product) return ''
  const lines = [`- 상품: ${ctx.product.name}`]
  if (ctx.product.price != null) lines.push(`- 가격: ${ctx.product.price.toLocaleString('ko-KR')}원`)
  if (ctx.product.shippingFee != null && ctx.product.shippingFee > 0) {
    lines.push(`- 배송비: ${ctx.product.shippingFee.toLocaleString('ko-KR')}원`)
  } else if (ctx.product.shippingFee === 0) {
    lines.push(`- 배송비: 무료`)
  }
  if (ctx.product.stock != null) {
    lines.push(`- 재고: ${ctx.product.stock > 0 ? `${ctx.product.stock}개 보유` : '품절'}`)
  }
  return lines.join('\n')
}

function orderContextLine(ctx: ReplyContext): string {
  if (!ctx.order) return ''
  const lines = [`- 주문번호: ${ctx.order.orderNumber}`, `- 상태: ${ctx.order.status}`]
  if (ctx.order.totalAmount) {
    lines.push(`- 결제 금액: ${Number(ctx.order.totalAmount).toLocaleString('ko-KR')}원`)
  }
  if (ctx.order.items?.length) {
    lines.push(
      `- 주문 상품: ${ctx.order.items
        .map((i) => `${i.productName} × ${i.quantity}`)
        .join(', ')}`
    )
  }
  return lines.join('\n')
}

const INTENT_GUIDES: Record<Intent, string> = {
  ORDER: `상황: 고객이 주문 의사를 밝혔습니다.
- 가능한 경우 주문 내역 확인 + 합계 + 입금 계좌 안내
- 모호한 경우 "어떤 상품/수량인지 알려주세요" 재질문
- 친근하고 감사하는 어투`,
  PRICE: `상황: 고객이 가격을 묻고 있습니다.
- 상품 가격 + 배송비를 명확히 안내
- 데이터에 가격 없으면 "잠시 후 확인 후 안내드릴게요" 응답`,
  STOCK: `상황: 고객이 재고를 묻고 있습니다.
- 재고 있으면 "재고 충분합니다" 또는 "현재 N개 보유"
- 품절이면 사과 + 재입고 알림 등록 제안`,
  DELIVERY: `상황: 고객이 배송 상태를 묻고 있습니다.
- 주문 상태별 맞춤 안내 (PENDING/PAID/SHIPPED/DELIVERED)
- 주문 정보가 없으면 "주문 성함이나 전화번호 알려주세요" 재질문`,
  PAYMENT: `상황: 고객이 결제 방법을 묻고 있습니다.
- 계좌이체 정보 (은행/계좌/예금주) 안내
- 입금 시 메모(이름+상품명) 부탁`,
  DEPOSIT: `상황: 고객이 입금 완료를 알리고 있습니다.
- 감사 인사 + "확인 후 발송 진행하겠습니다" 안내
- 매칭이 안되면 정중히 추가 정보 (성함/금액) 요청`,
  RETURN: `상황: 교환/반품 요청입니다.
- 정중한 사과 + "사장님께서 직접 확인하고 바로 연락드리겠습니다" 안내
- 사진 첨부 부탁 (가능하면)`,
  COMPLAINT: `상황: 불만/컴플레인입니다. 매우 신중히.
- 진심 어린 사과 (이모지 자제)
- 즉시 사장님이 확인하고 연락드린다는 안내
- 절대 변명/책임 회피 금지`,
  RESTOCK: `상황: 재입고 요청입니다.
- "재입고 시 가장 먼저 알려드리겠습니다" 약속
- 친근하게`,
  RECOMMEND: `상황: 추천/상담 요청입니다.
- 가능하면 제철/인기 상품 1-2개 추천
- 데이터 부족하면 "어떤 용도(가족/접대/선물)인지" 되묻기`,
  INFO: `상황: 영업시간/위치/연락처 등 정보 문의입니다.
- 쇼핑몰 정보(연락처/URL) 간단히 안내
- 영업시간 데이터 없으면 일반적 안내`,
  GENERAL: `상황: 인사/감사/잡담입니다.
- 친근한 인사 응답
- 자연스럽게 "주문/문의 도와드릴까요?" 한 줄 추가 (선택)`,
}

export async function generateReply(
  userId: number,
  intent: Intent,
  customerMessage: string,
  context: ReplyContext = {}
): Promise<string> {
  const shopCtx = shopContextLine(context)
  const productCtx = productContextLine(context)
  const orderCtx = orderContextLine(context)
  const customCtx = context.customMessage
    ? `\n\n[관리자 추가 지시]\n${context.customMessage}`
    : ''
  // Phase 3: 주문 매칭이 불확실하면 응답에 확인 유도 문구 포함
  const lowConfidenceHint =
    context.orderMatchConfidence === 'low' && context.order
      ? '\n\n[주문 매칭 주의]\n주문 정보가 발신자와 정확히 매칭되지 않습니다. 응답 시 "혹시 주문번호를 알려주시면 더 정확히 안내드리겠습니다" 라는 확인 유도 문구를 자연스럽게 포함하세요.'
      : ''

  const prompt = `[고객 메시지]
${customerMessage}

[분류된 의도]
${intent}

[의도별 응답 가이드]
${INTENT_GUIDES[intent]}

[셀러/상품/주문 컨텍스트]
${[shopCtx, productCtx, orderCtx].filter(Boolean).join('\n\n') || '(컨텍스트 없음 — 일반적 응답)'}${customCtx}${lowConfidenceHint}

위 컨텍스트만 사용하여 한국어로 친근한 응답을 작성하세요. 없는 정보는 추측 금지.`

  return aiText(userId, prompt, {
    system: SYSTEM_PROMPT,
    temperature: 0.5,
    maxTokens: 600,
  })
}
