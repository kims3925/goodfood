/**
 * AI 의도 분류기 (작업지시서 §2)
 * Claude API 로 고객 메시지 → 12개 의도 + confidence 분류.
 */

// 오디세이우스 우선 → 실패 시 callClaudeJson 자동 폴백 (ODYSSEUS_ENABLED=false 면 기존과 동일)
import { aiJson } from '@/modules/ai/odysseus.client'
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

const SYSTEM_PROMPT = `당신은 한국 수산물/농산물/축산물/가공식품/건강식품 셀러의 고객 응대를 돕는 AI 분류기입니다.
고객이 보낸 메시지를 정확히 분석하여 의도를 분류하고, 가능한 경우 핵심 엔티티(상품명/수량/금액)를 추출해야 합니다.

분류 규칙:
- 메시지가 짧고 모호하면 confidence 를 낮게 (0.5 미만) 설정
- 욕설/불만은 COMPLAINT 로 분류 (높은 confidence)
- 인사/감사 등 잡담은 GENERAL
- 명확한 주문 표현(구매 의사 + 상품/수량)은 ORDER 로 높은 confidence

[수산물 도메인 예시]
- "포항물회 2개 보내주세요" → ORDER (productName="포항물회", quantity=2)
- "통영 굴 1kg 얼마예요?" → PRICE (productName="통영 굴")
- "오징어 아직 있어요?" → STOCK (productName="오징어")
- "광어회 언제 도착하나요?" → DELIVERY

[농산물 도메인 예시]
- "제주 감귤 5kg 한 박스 주문할게요" → ORDER (productName="제주 감귤", quantity=1)
- "햇사과 입고됐어요?" → RESTOCK (productName="햇사과")
- "쌀 20kg 가격 알려주세요" → PRICE (productName="쌀 20kg")

[축산물/반찬/가공식품 예시]
- "한우 등심 200g x 2팩" → ORDER (productName="한우 등심", quantity=2)
- "어묵탕 밀키트 3개" → ORDER (productName="어묵탕 밀키트", quantity=3)
- "젓갈류 어떤 종류 있어요?" → INFO

[입금 확인 예시]
- "방금 35,000원 입금했어요. 김영자" → DEPOSIT (amount=35000)
- "이체 완료했습니다" → DEPOSIT

[반품/불만 예시]
- "회가 비린내가 너무 심해요" → COMPLAINT
- "상품 교환 가능한가요" → RETURN

수산물·농산물은 무게/박스/팩 단위가 흔함. quantity 는 "묶음/팩/박스" 등의 수를 우선,
"kg/g/리터" 등 단위는 productName 에 포함시켜 변형 옵션 매칭이 가능하게 합니다.`

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

  const result = await aiJson<IntentClassification>(userId, prompt, {
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
