/**
 * Tier Rules Service — PricingPolicy.tierRules JSON 기반 차등 마진 엔진
 *
 * 배경:
 *   가족도매방은 동일 채널이라도 "게시글 유형" (자체발송 / 외주발송 / 공유 등) 에 따라
 *   적용해야 하는 마진이 다르다. 기존 정책 content (텍스트 마진 구간표) 만으로는 표현이
 *   어려우므로 PricingPolicy.tier_rules (Json) 컬럼에 조건식 기반 규칙을 저장한다.
 *
 * tierRules JSON 스키마:
 *   {
 *     "type": "tiered",
 *     "rules": [
 *       { "condition": "postType == 'self'",      "margin": "30%",   "desc": "자체발송" },
 *       { "condition": "postType == 'outsource'", "margin": "20%",   "desc": "외주발송" },
 *       { "condition": "price >= 100000",         "margin": "15%",   "desc": "고가 상품" },
 *       { "condition": "default",                 "margin": "25%",   "desc": "기본 마진" }
 *     ]
 *   }
 *
 * 적용 우선순위:
 *   rules 배열은 위에서 아래로 평가되며, 첫 번째 매칭되는 규칙의 마진이 적용된다.
 *   "default" 조건은 항상 매칭 (catch-all). default 도 없으면 basePrice 그대로.
 *
 * 안전 원칙:
 *   - JSON 파싱 실패 → basePrice 반환 (no-op)
 *   - 조건식 파싱 실패 → 해당 규칙 스킵
 *   - margin 파싱 실패 → basePrice 반환
 *   - 결과가 NaN/음수 → basePrice 반환
 *
 * 외부 의존 X — 순수 함수. ts-node / jest 어디서나 import 가능.
 */

// ── 타입 정의 ─────────────────────────────────────────

/** 게시글 유형 (Channel.postType 과 매핑) */
export type TierPostType = 'self' | 'outsource' | 'shared' | string

/** 규칙 평가에 사용되는 컨텍스트 */
export interface TierRuleContext {
  /** 기준 가격 (보통 도매가) */
  price: number
  /** 게시글 유형 — 'self' | 'outsource' | 'shared' (대소문자 무관, 'SELF' 도 허용) */
  postType?: TierPostType | null
  /** 카테고리 코드 (SEA/AGR/...) — 향후 조건 확장용. 현재 파서는 미사용. */
  categoryCode?: string | null
}

/** 단일 규칙 */
export interface TierRule {
  condition: string
  margin: string
  desc?: string
}

/** tierRules JSON 의 최상위 스키마 */
export interface TierRulesPayload {
  type?: string
  rules?: TierRule[]
}

/** applyTierRules 결과 */
export interface TierRuleApplied {
  /** 최종 가격 (마진 적용 후) */
  finalPrice: number
  /** 적용된 규칙 (매칭 안 됐으면 null) */
  matchedRule: TierRule | null
  /** 디버그용 — 적용된 마진 문자열 */
  marginApplied: string | null
}

// ── 헬퍼: tierRules JSON 정규화 ────────────────────────

/**
 * tierRules 인자를 안전하게 객체로 변환.
 * - 문자열이면 JSON.parse
 * - 객체이면 그대로
 * - null/undefined/파싱 실패 → null
 */
export function parseTierRules(input: unknown): TierRulesPayload | null {
  if (input == null) return null

  // 이미 객체인 경우
  if (typeof input === 'object') {
    return input as TierRulesPayload
  }

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        return parsed as TierRulesPayload
      }
    } catch {
      return null
    }
  }

  return null
}

// ── 조건식 파서 ───────────────────────────────────────

/**
 * 단일 조건식 평가.
 *
 * 지원 문법 (대소문자 일부 무관):
 *   - postType == 'self'         (단일 인용부 / 더블쿼트 모두 허용, 값 대소문자 무관)
 *   - postType != 'shared'
 *   - price >= 100000            (>, <, >=, <=, ==, !=)
 *   - default                    (항상 true)
 *
 * 비교 연산은 좌변에 식별자(postType / price / categoryCode), 우변에 리터럴.
 * 파싱 실패 / 미지원 형식 → false (해당 규칙 스킵).
 */
export function evaluateCondition(condition: string, ctx: TierRuleContext): boolean {
  if (typeof condition !== 'string') return false
  const expr = condition.trim()
  if (!expr) return false

  // default — 항상 매칭 (catch-all)
  if (/^default$/i.test(expr)) return true

  // 비교 연산: <lhs> <op> <rhs>
  //   op: ==, !=, >=, <=, >, <  (=== 도 == 와 동일 취급)
  const m = expr.match(
    /^\s*([A-Za-z_][A-Za-z_0-9]*)\s*(===|==|!==|!=|>=|<=|>|<)\s*(.+?)\s*$/
  )
  if (!m) return false

  const lhsName = m[1]
  const opRaw = m[2]
  const op = opRaw === '===' ? '==' : opRaw === '!==' ? '!=' : opRaw

  // 우변 리터럴 정규화
  const rhsRaw = m[3].trim()
  // 따옴표 제거 (',",``)
  const rhsStr = rhsRaw.replace(/^['"`](.*)['"`]$/, '$1')
  const rhsNum = Number(rhsRaw)

  // 좌변 값 추출 — 알려진 식별자만 허용 (그 외는 false)
  let lhsVal: string | number | null | undefined
  switch (lhsName) {
    case 'postType':
      lhsVal = ctx.postType == null ? '' : String(ctx.postType).toLowerCase()
      break
    case 'price':
      lhsVal = typeof ctx.price === 'number' ? ctx.price : Number(ctx.price)
      break
    case 'categoryCode':
      lhsVal = ctx.categoryCode == null ? '' : String(ctx.categoryCode)
      break
    default:
      return false
  }

  // 비교 실행
  // 문자열 비교 — postType / categoryCode 는 lowercase 매칭으로 일관
  if (lhsName === 'postType' || lhsName === 'categoryCode') {
    const l = String(lhsVal)
    const r = rhsStr.toLowerCase()
    if (op === '==') return l === r
    if (op === '!=') return l !== r
    return false // 문자열에 부등호는 미지원
  }

  // 숫자 비교 — price
  const lNum = typeof lhsVal === 'number' ? lhsVal : Number(lhsVal)
  if (!Number.isFinite(lNum) || !Number.isFinite(rhsNum)) return false

  switch (op) {
    case '==': return lNum === rhsNum
    case '!=': return lNum !== rhsNum
    case '>=': return lNum >= rhsNum
    case '<=': return lNum <= rhsNum
    case '>':  return lNum > rhsNum
    case '<':  return lNum < rhsNum
    default:   return false
  }
}

// ── 마진 문자열 파서 ───────────────────────────────────

/**
 * 마진 문자열을 basePrice 에 적용.
 *
 * 지원 형식:
 *   - "30%"      → basePrice × 1.30
 *   - "-10%"     → basePrice × 0.90
 *   - "5000"     → basePrice + 5000  (정수 — 고정 마진)
 *   - "+5000"    → basePrice + 5000  (명시적 + 부호)
 *   - "-3000"    → basePrice - 3000  (감액)
 *   - 1.5 (number) → basePrice + 1.5 (숫자 입력도 허용 — 고정 가산)
 *
 * 파싱 실패 → null 반환 (호출자가 basePrice 폴백).
 * 음수 결과 / NaN → null 반환.
 */
export function applyMarginString(basePrice: number, margin: string | number): number | null {
  if (!Number.isFinite(basePrice) || basePrice < 0) return null
  if (margin == null) return null

  let result: number
  if (typeof margin === 'number') {
    if (!Number.isFinite(margin)) return null
    result = basePrice + margin
  } else if (typeof margin === 'string') {
    const trimmed = margin.trim()
    if (!trimmed) return null

    // 백분율
    const pctMatch = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*%$/)
    if (pctMatch) {
      const pct = Number(pctMatch[1])
      if (!Number.isFinite(pct)) return null
      result = basePrice * (1 + pct / 100)
    } else {
      // 고정 가산/감액 (콤마 / 원 / 공백 허용)
      const cleaned = trimmed.replace(/[,원₩\s]/g, '')
      const num = Number(cleaned)
      if (!Number.isFinite(num)) return null
      result = basePrice + num
    }
  } else {
    return null
  }

  if (!Number.isFinite(result) || result < 0) return null
  return Math.round(result)
}

// ── 메인 진입점 ───────────────────────────────────────

/**
 * basePrice 에 tierRules 를 적용해 최종 가격 반환.
 *
 * 동작:
 *   1. tierRulesJson 파싱 — 실패 시 { finalPrice: basePrice, matchedRule: null }
 *   2. rules 배열을 위에서 아래로 평가 → 첫 매칭 규칙의 margin 적용
 *   3. 매칭 없음 → basePrice 그대로
 *   4. margin 적용 실패 → basePrice 그대로 (안전)
 *
 * @param basePrice  기준 가격 (보통 도매가)
 * @param tierRulesJson  PricingPolicy.tierRules 값 (Json 또는 stringified JSON)
 * @param ctx        평가 컨텍스트 { price, postType?, categoryCode? }
 *                   ctx.price 가 없으면 basePrice 가 자동으로 ctx.price 로 사용됨.
 */
export function applyTierRules(
  basePrice: number,
  tierRulesJson: unknown,
  ctx?: Partial<TierRuleContext>
): TierRuleApplied {
  const noop: TierRuleApplied = {
    finalPrice: Math.round(basePrice),
    matchedRule: null,
    marginApplied: null,
  }

  if (!Number.isFinite(basePrice) || basePrice < 0) return noop

  const payload = parseTierRules(tierRulesJson)
  if (!payload) return noop

  const rules = Array.isArray(payload.rules) ? payload.rules : null
  if (!rules || rules.length === 0) return noop

  // ctx 보강 — price 누락 시 basePrice 사용
  const effectiveCtx: TierRuleContext = {
    price: ctx?.price ?? basePrice,
    postType: ctx?.postType != null ? String(ctx.postType).toLowerCase() : null,
    categoryCode: ctx?.categoryCode ?? null,
  }

  for (const rule of rules) {
    if (!rule || typeof rule.condition !== 'string') continue
    let matched = false
    try {
      matched = evaluateCondition(rule.condition, effectiveCtx)
    } catch {
      matched = false
    }
    if (!matched) continue

    const applied = applyMarginString(basePrice, rule.margin)
    if (applied == null) {
      // 마진 파싱 실패 → 안전 폴백 (옛 가격 유지)
      return noop
    }
    return {
      finalPrice: applied,
      matchedRule: rule,
      marginApplied: typeof rule.margin === 'string' ? rule.margin : String(rule.margin),
    }
  }

  return noop
}

/**
 * tierRules JSON 의 형식적 유효성만 검증 (UI 단에서 textarea 저장 전 사용).
 *
 * @returns { ok: true } | { ok: false, error: string }
 */
export function validateTierRulesJson(
  raw: string
): { ok: true; payload: TierRulesPayload } | { ok: false; error: string } {
  const trimmed = (raw || '').trim()
  if (!trimmed) return { ok: false, error: '빈 JSON 입니다.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (e: any) {
    return { ok: false, error: `JSON 파싱 실패: ${e?.message || 'invalid JSON'}` }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: '최상위는 객체여야 합니다 ({"type": "...", "rules": [...]})' }
  }

  const payload = parsed as TierRulesPayload
  if (!Array.isArray(payload.rules)) {
    return { ok: false, error: '"rules" 배열이 필요합니다.' }
  }

  for (let i = 0; i < payload.rules.length; i++) {
    const r = payload.rules[i]
    if (!r || typeof r !== 'object') {
      return { ok: false, error: `rules[${i}] 가 객체가 아닙니다.` }
    }
    if (typeof r.condition !== 'string' || !r.condition.trim()) {
      return { ok: false, error: `rules[${i}].condition 이 비어있습니다.` }
    }
    if (typeof r.margin !== 'string' && typeof r.margin !== 'number') {
      return { ok: false, error: `rules[${i}].margin 은 string 또는 number 여야 합니다.` }
    }
  }

  return { ok: true, payload }
}
