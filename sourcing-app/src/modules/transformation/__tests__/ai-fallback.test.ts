/**
 * generateContentWithFallback / isProviderUnavailableError 단위 검증
 * — Gemini↔Claude↔OpenAI 자동 호환(폴백) 로직.
 *
 * ts-jest 없이 ts-node 로 실행:
 *   pnpm --filter sourcing-app exec ts-node --transpile-only \
 *     --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
 *     src/modules/transformation/__tests__/ai-fallback.test.ts
 */

import {
  generateContentWithFallback,
  isProviderUnavailableError,
  BaseAiClient,
  AiClientConfig,
  AiResponse,
} from '../ai.client'
import { ProductTransformationError, TransformationErrorCode, TransformationErrorType } from '../product.types'

// ── 미니 러너 ─────────────────────────────────────────
let passed = 0
let failed = 0
const failures: string[] = []
function assert(cond: boolean, name: string) {
  if (cond) passed++
  else { failed++; failures.push(name); console.error(`✗ FAIL: ${name}`) }
}

// ── 가짜 클라이언트 (실제 API 호출 없음) ───────────────
class FakeClient extends BaseAiClient {
  constructor(cfg: AiClientConfig, private behavior: () => AiResponse) { super(cfg) }
  async generateContent(): Promise<AiResponse> { return this.behavior() }
}

function ok(provider: any): AiResponse {
  return { content: `${provider}-OK`, model: 'm', provider }
}
function creditError(): never {
  throw new ProductTransformationError(
    'Claude API 크레딧이 부족합니다.',
    TransformationErrorCode.AI_API_ERROR,
    {},
    TransformationErrorType.PERMANENT
  )
}
function parseError(): never {
  throw new ProductTransformationError(
    '응답 파싱 실패',
    TransformationErrorCode.PARSING_ERROR,
    {},
    TransformationErrorType.PERMANENT
  )
}

const cfg = (provider: any): AiClientConfig => ({ provider, apiKey: 'k', model: 'm' })

;(async () => {
  // 1) primary(CLAUDE) 크레딧 실패 → GEMINI 폴백 성공
  {
    const factory = (c: AiClientConfig) =>
      new FakeClient(c, c.provider === 'CLAUDE' ? creditError : () => ok(c.provider))
    const res = await generateContentWithFallback([cfg('CLAUDE'), cfg('GEMINI')], 'p', undefined, factory)
    assert(res.provider === 'GEMINI' && res.content === 'GEMINI-OK', '1) CLAUDE 크레딧 실패 → GEMINI 폴백 성공')
  }

  // 2) primary(GEMINI) 성공 → 폴백 미사용
  {
    let claudeCalled = false
    const factory = (c: AiClientConfig) =>
      new FakeClient(c, () => { if (c.provider === 'CLAUDE') claudeCalled = true; return ok(c.provider) })
    const res = await generateContentWithFallback([cfg('GEMINI'), cfg('CLAUDE')], 'p', undefined, factory)
    assert(res.provider === 'GEMINI', '2) GEMINI 성공 → GEMINI 반환')
    assert(claudeCalled === false, '2) 폴백(CLAUDE) 호출 안 됨')
  }

  // 3) 모든 provider 크레딧 실패 → 마지막 에러 throw
  {
    const factory = (c: AiClientConfig) => new FakeClient(c, creditError)
    let threw = false
    try { await generateContentWithFallback([cfg('CLAUDE'), cfg('GEMINI')], 'p', undefined, factory) }
    catch (e) { threw = isProviderUnavailableError(e) }
    assert(threw, '3) 전 provider 실패 → AI_API_ERROR throw')
  }

  // 4) 폴백 무의미한 에러(파싱)는 즉시 throw, 다음 provider 시도 안 함
  {
    let geminiCalled = false
    const factory = (c: AiClientConfig) =>
      new FakeClient(c, c.provider === 'CLAUDE' ? parseError : () => { geminiCalled = true; return ok(c.provider) })
    let caught: any
    try { await generateContentWithFallback([cfg('CLAUDE'), cfg('GEMINI')], 'p', undefined, factory) }
    catch (e) { caught = e }
    assert(caught instanceof ProductTransformationError, '4) 파싱 에러 즉시 throw')
    assert(geminiCalled === false, '4) 파싱 에러 시 폴백 시도 안 함')
  }

  // 5) 3단 폴백: CLAUDE 실패 → GEMINI 실패 → OPENAI 성공
  {
    const factory = (c: AiClientConfig) =>
      new FakeClient(c, c.provider === 'OPENAI' ? () => ok(c.provider) : creditError)
    const res = await generateContentWithFallback([cfg('CLAUDE'), cfg('GEMINI'), cfg('OPENAI')], 'p', undefined, factory)
    assert(res.provider === 'OPENAI', '5) CLAUDE→GEMINI→OPENAI 3단 폴백 성공')
  }

  // 6) isProviderUnavailableError 판정
  {
    const credit = new ProductTransformationError('x', TransformationErrorCode.AI_API_ERROR, {}, TransformationErrorType.PERMANENT)
    assert(isProviderUnavailableError(credit) === true, '6) AI_API_ERROR → 폴백 대상')
    assert(isProviderUnavailableError(new Error('generic')) === false, '6) 일반 에러 → 폴백 대상 아님')
  }

  console.log(`\nAI Fallback — passed=${passed}  failed=${failed}`)
  if (failed > 0) {
    console.error(`Failed:\n  - ${failures.join('\n  - ')}`)
    if (typeof process !== 'undefined' && process.exit) process.exit(1)
  }
})()

export {}
