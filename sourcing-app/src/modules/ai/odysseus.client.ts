/**
 * Odysseus AI 호출 어댑터 (BandAuto × 오디세이우스 연동 — 1단계)
 *
 * 역할: 기존 callClaude/callClaudeJson 호출 자리를 "오디세이우스 우선 → 실패 시 기존 폴백"으로 라우팅.
 *  - ODYSSEUS_ENABLED!=='true' 또는 BASE/TOKEN 미설정이면 항상 기존 Claude 로 폴백 → 동작 변화 0.
 *  - 운영자가 토큰 발급(2단계) + ODYSSEUS_ENABLED=true 로 켜기 전까지는 기존과 100% 동일.
 *
 * 규격은 오디세이우스 실코드(routes/webhook_routes.py sync_chat, POST /api/v1/chat)에서 실측 확인:
 *  - 요청 본문: { message: string, model?, session?, api_key?, base_url?, provider? }  ← messages 배열 아님!
 *    · system 필드가 없으므로 system 프롬프트는 message 앞에 붙인다.
 *    · session 미전달 = 매 호출 독립(Case 3, 어드민에 설정된 ModelEndpoint 사용).
 *    · 토큰 scope 에 "chat" 필요. 토큰의 owner 가 세션 owner 로 사용됨(본문에 owner 불필요).
 *  - 응답 본문: { response: string, session_id: string, model: string }
 *
 * 시그니처는 실제 claude.client.ts 에 맞춤: userId 는 number, opts 는 ClaudeOptions 호환.
 */
import { callClaude, callClaudeJson } from './claude.client'

const BASE = process.env.ODYSSEUS_BASE_URL
const TOKEN = process.env.ODYSSEUS_CHAT_TOKEN
const SESSION = process.env.ODYSSEUS_SESSION // (선택) 세션 연속성 원하면 세션ID 지정. 기본 미사용=독립 호출
const MODEL = process.env.ODYSSEUS_MODEL // (선택) 특정 모델 강제. 기본 미사용=엔드포인트 기본값
const TIMEOUT = Number(process.env.ODYSSEUS_TIMEOUT_MS ?? 20000)
const ENABLED = process.env.ODYSSEUS_ENABLED === 'true'

export interface AiOpts {
  system?: string
  temperature?: number
  maxTokens?: number
}

async function callOdysseusRaw(prompt: string, opts: AiOpts = {}): Promise<string> {
  if (!ENABLED || !BASE || !TOKEN) throw new Error('ODYSSEUS_DISABLED')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    // system 필드가 없으므로 system 을 message 앞에 결합
    const message = opts.system ? `${opts.system}\n\n${prompt}` : prompt
    const reqBody: Record<string, unknown> = { message }
    if (SESSION) reqBody.session = SESSION
    if (MODEL) reqBody.model = MODEL

    const res = await fetch(`${BASE}/api/v1/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`ODYSSEUS_HTTP_${res.status}`)
    const data: any = await res.json()
    const text = data?.response ?? '' // 실측: { response, session_id, model }
    if (!text) throw new Error('ODYSSEUS_EMPTY')
    return String(text)
  } finally {
    clearTimeout(timer)
  }
}

function extractJson(s: string): string {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : s
  const m = body.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  return m ? m[1] : body
}

/** 텍스트: 오디세이우스 우선 → 실패 시 기존 callClaude 폴백 (동작 보존) */
export async function aiText(userId: number, prompt: string, opts: AiOpts = {}): Promise<string> {
  try {
    return await callOdysseusRaw(prompt, opts)
  } catch (e) {
    if ((e as Error).message !== 'ODYSSEUS_DISABLED') {
      console.warn('[odysseus] fallback→callClaude:', (e as Error).message)
    }
    return callClaude(userId, prompt, opts)
  }
}

/** JSON: 오디세이우스 우선 → 실패 시 기존 callClaudeJson 폴백 (동작 보존) */
export async function aiJson<T = unknown>(userId: number, prompt: string, opts: AiOpts = {}): Promise<T> {
  try {
    const raw = await callOdysseusRaw(prompt, {
      ...opts,
      system: (opts.system ? opts.system + '\n' : '') + '반드시 유효한 JSON 만 출력하세요.',
    })
    return JSON.parse(extractJson(raw)) as T
  } catch (e) {
    if ((e as Error).message !== 'ODYSSEUS_DISABLED') {
      console.warn('[odysseus] fallback→callClaudeJson:', (e as Error).message)
    }
    return callClaudeJson<T>(userId, prompt, opts)
  }
}
