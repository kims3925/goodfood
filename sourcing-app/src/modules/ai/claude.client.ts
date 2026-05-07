/**
 * Claude API client (anthropic SDK 래퍼)
 *
 * AI 채팅 자동응답 시스템에서 의도 분류 + 응답 생성에 사용.
 * 키 저장: AiApiConfig (userId+provider=CLAUDE) — /sourcing/settings/ai 에서 셀러가 직접 등록.
 *
 * 환경변수 ANTHROPIC_API_KEY 는 더 이상 사용하지 않음 (셀러별 키로 전환).
 */

import Anthropic from '@anthropic-ai/sdk'
import prisma from '@bandauto/db'

const FALLBACK_MODEL = 'claude-haiku-4-5'
const DEFAULT_MAX_TOKENS = 1024

export interface ClaudeConfig {
  apiKey: string
  model: string
  configId: number
}

/**
 * 사용자의 활성 Claude API 설정 조회.
 * @returns 설정 없으면 null (호출 측에서 안내 메시지 반환)
 */
export async function getClaudeConfigForUser(userId: number): Promise<ClaudeConfig | null> {
  const config = await prisma.aiApiConfig.findFirst({
    where: { userId, provider: 'CLAUDE', isActive: true },
    select: { id: true, apiKey: true, model: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (!config?.apiKey) return null
  return {
    apiKey: config.apiKey,
    model: config.model || FALLBACK_MODEL,
    configId: config.id,
  }
}

/**
 * 사용량 카운터 증가 (낙관적 — 실패해도 응답 생성은 계속).
 */
export async function bumpClaudeUsage(configId: number): Promise<void> {
  try {
    await prisma.aiApiConfig.update({
      where: { id: configId },
      data: {
        usageCount: { increment: 1 },
        dailyUsageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    })
  } catch (err) {
    console.warn('[Claude usage] update failed', (err as Error).message)
  }
}

export interface ClaudeOptions {
  maxTokens?: number
  temperature?: number
  system?: string
}

/**
 * Claude 텍스트 호출.
 * @param userId 사용자 ID — AiApiConfig 에서 키 조회
 * @returns 응답 텍스트 (실패 시 throw)
 */
export async function callClaude(
  userId: number,
  prompt: string,
  opts: ClaudeOptions = {}
): Promise<string> {
  const config = await getClaudeConfigForUser(userId)
  if (!config) {
    throw new Error(
      'Claude API 키가 등록되어 있지 않습니다. /sourcing/settings/ai 페이지에서 Claude API 키를 등록해 주세요.'
    )
  }

  const client = new Anthropic({ apiKey: config.apiKey })
  const res = await client.messages.create({
    model: config.model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: opts.temperature ?? 0.4,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: 'user', content: prompt }],
  })

  // 사용량 카운터 (비동기 — 실패해도 무시)
  bumpClaudeUsage(config.configId).catch(() => {})

  const text = res.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim()

  if (!text) throw new Error('Claude 응답이 비어 있습니다.')
  return text
}

/**
 * JSON 형식 응답을 강제로 받아오기 위한 헬퍼.
 */
export async function callClaudeJson<T = unknown>(
  userId: number,
  prompt: string,
  opts: ClaudeOptions = {}
): Promise<T> {
  const text = await callClaude(userId, prompt, {
    temperature: 0.2,
    ...opts,
    system: opts.system
      ? opts.system + '\n\n반드시 유효한 JSON 만 응답하세요. 마크다운/주석/추가 설명 금지.'
      : '반드시 유효한 JSON 만 응답하세요. 마크다운/주석/추가 설명 금지.',
  })

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

/**
 * 사용자에게 Claude 설정이 있는지 확인 (null/존재).
 * 라우트 사전 검사용.
 */
export async function hasClaudeConfig(userId: number): Promise<boolean> {
  const config = await getClaudeConfigForUser(userId)
  return config !== null
}
