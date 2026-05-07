/**
 * AI 의도 분류기 (작업지시서 §2)
 * Claude API 로 고객 메시지 → 12개 의도 + confidence 분류.
 */

import { callClaudeJson } from '@/modules/ai/claude.client'
import { INTENTS, INTENT_DESCRIPTIONS, isValidIntent, type Intent } from '@/lib/inbox-intents'

export interface IntentClassification {
  intent: Intent
  confidence: number
  reasoning: string
  // 선택적으로 추출된 엔티티
  productName?: string | null
  quantity?: number | null
  amount?: number | null
}

const SYSTEM_PROMPT = `당신은 한국 수산물/농산물 셀러의 고객 응대를 돕는 AI 분류기입니다.
고객이 보낸 메시지를 정확히 분석하여 의도를 분류하고, 가능한 경우 핵심 엔티티(상품명/수량/금액)를 추출해야 합니다.

분류 규칙:
- 메시지가 짧고 모호하면 confidence 를 낮게 (0.5 미만) 설정
- 욕설/불만은 COMPLAINT 로 분류 (높은 confidence)
- 인사/감사 등 잡담은 GENERAL
- 명확한 주문 표현(구매 의사 + 상품/수량)은 ORDER 로 높은 confidence`

const INTENT_LIST_FOR_PROMPT = INTENTS.map(
  (i) => `- ${i}: ${INTENT_DESCRIPTIONS[i]}`
).join('\n')

export async function classifyIntent(
  userId: number,
  customerMessage: string,
  context?: { recentMessages?: string[]; recentProductName?: string | null }
): Promise<IntentClassification> {
  const recent = context?.recentMessages?.length
    ? `\n\n[최근 대화 컨텍스트 (참고)]\n${context.recentMessages.slice(-5).join('\n')}`
    : ''
  const recentProduct = context?.recentProductName
    ? `\n\n[직전 게시물 상품명 (참고)]\n${context.recentProductName}`
    : ''

  const prompt = `다음 고객 메시지의 의도를 분류해 주세요.

[가능한 의도 12개]
${INTENT_LIST_FOR_PROMPT}
${recent}${recentProduct}

[고객 메시지]
${customerMessage}

[응답 JSON 형식]
{
  "intent": "ORDER" | "PRICE" | "STOCK" | "DELIVERY" | "PAYMENT" | "DEPOSIT" | "RETURN" | "COMPLAINT" | "RESTOCK" | "RECOMMEND" | "INFO" | "GENERAL",
  "confidence": 0.0 ~ 1.0,
  "reasoning": "왜 그렇게 분류했는지 한 줄 요약",
  "productName": "주문/문의 상품명 또는 null",
  "quantity": 수량 숫자 또는 null,
  "amount": 금액 숫자 또는 null
}`

  const result = await callClaudeJson<IntentClassification>(userId, prompt, {
    system: SYSTEM_PROMPT,
    maxTokens: 512,
  })

  // 검증 + 보정
  if (!isValidIntent(result.intent)) {
    return {
      intent: 'GENERAL',
      confidence: Math.min(result.confidence ?? 0, 0.5),
      reasoning: `잘못된 intent (${result.intent}) → GENERAL 폴백. ` + (result.reasoning || ''),
      productName: result.productName ?? null,
      quantity: result.quantity ?? null,
      amount: result.amount ?? null,
    }
  }

  // confidence 클램핑
  const conf = Number(result.confidence)
  return {
    intent: result.intent,
    confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
    reasoning: result.reasoning || '',
    productName: result.productName ?? null,
    quantity: result.quantity ?? null,
    amount: result.amount ?? null,
  }
}
