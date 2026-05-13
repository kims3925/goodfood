/**
 * POST /api/inbox/test-classify
 *
 * AI 챗 설정 페이지의 "테스트" 섹션 전용 엔드포인트.
 * 입력 메시지에 대해 intent 분류 + 응답 초안 + 에스컬레이션 판단을 즉시 반환한다.
 * DB 저장 X (테스트 전용).
 *
 * Body: { message: string, channelKind?: string }
 * 응답: { intent, confidence, reasoning, replyDraft, escalate, reason }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { getClaudeConfigForUser } from '@/modules/ai/claude.client'
import { classifyIntent } from '@/modules/inbox/intent-classifier'
import { generateReply } from '@/modules/inbox/reply-generator'
import { INTENT_ALWAYS_ESCALATE, isValidIntent } from '@/lib/inbox-intents'

const ESCALATE_CONFIDENCE_THRESHOLD = 0.6
const ESCALATE_HIGH_AMOUNT = 50000

export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) {
    return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const message = String(body?.message ?? '').trim()
  if (!message) {
    return NextResponse.json(
      { success: false, error: '테스트할 메시지를 입력하세요.' },
      { status: 400 }
    )
  }
  if (message.length > 2000) {
    return NextResponse.json(
      { success: false, error: '메시지가 너무 깁니다 (최대 2000자).' },
      { status: 400 }
    )
  }

  // Claude 키 등록 여부 사전 점검
  const config = await getClaudeConfigForUser(me.userId)
  if (!config) {
    return NextResponse.json(
      {
        success: false,
        error: 'Claude API 키가 등록되어 있지 않습니다. /sourcing/settings/ai 에서 등록 후 다시 시도하세요.',
      },
      { status: 400 }
    )
  }

  try {
    // 1. 의도 분류 (DB 저장 X)
    const result = await classifyIntent(me.userId, message)

    // 2. 응답 초안 생성 (컨텍스트 없이)
    let replyDraft = ''
    try {
      replyDraft = await generateReply(me.userId, result.intent, message, {})
    } catch (e: any) {
      replyDraft = `(응답 생성 실패: ${e?.message || '알 수 없는 오류'})`
    }

    // 3. 에스컬레이션 판단 (DB 없이 inline 로직 — inbox.service.shouldEscalate 와 동일 규칙)
    let escalate = false
    let reason: string | null = null
    if (isValidIntent(result.intent)) {
      if (INTENT_ALWAYS_ESCALATE[result.intent]) {
        escalate = true
        reason = `${result.intent} 의도는 항상 사장님 검토 필요`
      } else if (result.confidence < ESCALATE_CONFIDENCE_THRESHOLD) {
        escalate = true
        reason = `AI 분류 신뢰도 낮음 (${(result.confidence * 100).toFixed(0)}%)`
      } else if (
        result.intent === 'ORDER' &&
        Number.isFinite(Number(result.amount)) &&
        Number(result.amount) >= ESCALATE_HIGH_AMOUNT
      ) {
        escalate = true
        reason = `고액 주문 (${Number(result.amount).toLocaleString('ko-KR')}원)`
      } else {
        const profanity = ['씨발', 'ㅅㅂ', '좆', '병신', '개새끼']
        if (profanity.some((w) => message.includes(w))) {
          escalate = true
          reason = '비속어 감지 — AI 응답 차단'
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        intent: result.intent,
        confidence: result.confidence,
        reasoning: result.reasoning,
        productName: result.productName,
        quantity: result.quantity,
        amount: result.amount,
        replyDraft,
        escalate,
        reason,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '분류 실패' },
      { status: 500 }
    )
  }
}
