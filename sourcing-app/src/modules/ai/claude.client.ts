/**
 * Claude API client (anthropic SDK 래퍼)
 *
 * AI 채팅 자동응답 시스템에서 의도 분류 + 응답 생성에 사용.
 * 환경변수: ANTHROPIC_API_KEY (필수). 미설정 시 throw.
 *
 * 모델: claude-haiku-4-5 (가장 가성비 좋음, 한국어 우수)
 */

import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_MODEL = 'claude-haiku-4-5'
const DEFAULT_MAX_TOKENS = 1024

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (client) return client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. .env.local 또는 docker compose 환경변수에 등록해 주세요.'
    )
  }
  client = new Anthropic({ apiKey })
  return client
}

export interface ClaudeOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  system?: string
}

/**
 * Claude 텍스트 호출 — 단순 프롬프트→응답.
 * @returns 응답 텍스트 (실패 시 throw)
 */
export async function callClaude(prompt: string, opts: ClaudeOptions = {}): Promise<string> {
  const c = getClient()
  const res = await c.messages.create({
    model: opts.model || DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: opts.temperature ?? 0.4,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: 'user', content: prompt }],
  })

  // content 는 ContentBlock[] — text 블록만 골라서 합침
  const text = res.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim()

  if (!text) throw new Error('Claude 응답이 비어 있습니다.')
  return text
}

/**
 * JSON 형식 응답을 강제로 받아오기 위한 헬퍼.
 * Claude 가 ```json ... ``` 마크다운으로 감싸는 경우도 자동 파싱.
 */
export async function callClaudeJson<T = unknown>(
  prompt: string,
  opts: ClaudeOptions = {}
): Promise<T> {
  const text = await callClaude(prompt, {
    temperature: 0.2,
    ...opts,
    system: opts.system
      ? opts.system + '\n\n반드시 유효한 JSON 만 응답하세요. 마크다운/주석/추가 설명 금지.'
      : '반드시 유효한 JSON 만 응답하세요. 마크다운/주석/추가 설명 금지.',
  })

  // ```json ... ``` 또는 첫 { ... } / [ ... ] 추출
  let jsonStr = text
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) jsonStr = fence[1]
  const objMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (objMatch) jsonStr = objMatch[1]

  try {
    return JSON.parse(jsonStr) as T
  } catch (err) {
    throw new Error(`Claude JSON 파싱 실패: ${(err as Error).message}\n원본: ${text.slice(0, 500)}`)
  }
}

export function hasClaudeApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}
