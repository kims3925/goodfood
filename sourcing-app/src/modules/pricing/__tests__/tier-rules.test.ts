/**
 * tier-rules.service.ts 단위 검증
 *
 * ts-jest 가 환경에 없으므로 별도 의존성 없이 ts-node 로 실행 가능하도록 작성.
 * 실행:
 *   pnpm --filter sourcing-app exec ts-node --transpile-only src/modules/pricing/__tests__/tier-rules.test.ts
 *
 * 또는 jest 가 추후 도입되면 동일 파일을 `describe/it` 로 변환만 하면 됨.
 */

import {
  applyTierRules,
  applyMarginString,
  evaluateCondition,
  parseTierRules,
  validateTierRulesJson,
} from '../tier-rules.service'

// ── 미니 테스트 러너 (jest 없이도 동작) ─────────────────
let passed = 0
let failed = 0
const failures: string[] = []

function assert(cond: boolean, name: string): void {
  if (cond) {
    passed++
    // 통과 메시지는 너무 시끄러우므로 콘솔 X
  } else {
    failed++
    failures.push(name)
    // eslint-disable-next-line no-console
    console.error(`✗ FAIL: ${name}`)
  }
}

function eq<T>(actual: T, expected: T, name: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) {
    // eslint-disable-next-line no-console
    console.error(`   actual=${JSON.stringify(actual)}  expected=${JSON.stringify(expected)}`)
  }
  assert(ok, name)
}

// ── 시나리오 1: postType == 'self' → 30% 마진 ────────
const FAMILY_RULES = {
  type: 'tiered',
  rules: [
    { condition: "postType == 'self'", margin: '30%', desc: '자체발송' },
    { condition: "postType == 'outsource'", margin: '20%', desc: '외주발송' },
    { condition: 'price >= 100000', margin: '15%', desc: '고가 상품' },
    { condition: 'default', margin: '25%', desc: '기본 마진' },
  ],
}

{
  const r = applyTierRules(10000, FAMILY_RULES, { price: 10000, postType: 'self' })
  eq(r.finalPrice, 13000, 'self 30% margin → 10000 * 1.3 = 13000')
  eq(r.matchedRule?.desc, '자체발송', 'matched rule = 자체발송')
}

// ── 시나리오 2: postType == 'outsource' → 20% 마진 ───
{
  const r = applyTierRules(10000, FAMILY_RULES, { price: 10000, postType: 'outsource' })
  eq(r.finalPrice, 12000, 'outsource 20% margin → 10000 * 1.2 = 12000')
  eq(r.matchedRule?.desc, '외주발송', 'matched rule = 외주발송')
}

// ── 시나리오 3: price >= 100000 → 15% 마진 (postType 미일치) ─
{
  const r = applyTierRules(120000, FAMILY_RULES, { price: 120000, postType: 'shared' })
  eq(r.finalPrice, 138000, 'price >= 100000 → 120000 * 1.15 = 138000')
  eq(r.matchedRule?.desc, '고가 상품', 'matched rule = 고가 상품')
}

// ── 시나리오 4: 어느 조건도 매치 안 됨 → default 25% ──
{
  const r = applyTierRules(10000, FAMILY_RULES, { price: 10000, postType: 'shared' })
  eq(r.finalPrice, 12500, 'default 25% margin → 10000 * 1.25 = 12500')
  eq(r.matchedRule?.desc, '기본 마진', 'matched rule = 기본 마진')
}

// ── 추가: 안전성 / 폴백 ──────────────────────────────
{
  // tierRules 가 null → basePrice 그대로
  const r = applyTierRules(10000, null)
  eq(r.finalPrice, 10000, 'null tierRules → basePrice 유지')
  eq(r.matchedRule, null, 'matchedRule 은 null')
}

{
  // 잘못된 JSON 문자열 → basePrice 그대로
  const r = applyTierRules(10000, '{not json')
  eq(r.finalPrice, 10000, '잘못된 JSON → basePrice 유지')
}

{
  // 빈 rules 배열 → basePrice 그대로
  const r = applyTierRules(10000, { type: 'tiered', rules: [] })
  eq(r.finalPrice, 10000, '빈 rules → basePrice 유지')
}

{
  // postType 대소문자 무관 (SELF, Self 모두 매칭)
  const r = applyTierRules(10000, FAMILY_RULES, { price: 10000, postType: 'SELF' })
  eq(r.finalPrice, 13000, 'postType=SELF (대문자) → self 매칭')
}

// ── applyMarginString 단독 검증 ────────────────────
{
  eq(applyMarginString(10000, '30%'), 13000, 'applyMarginString 30% = +30%')
  eq(applyMarginString(10000, '5000'), 15000, 'applyMarginString 5000 = +5000')
  eq(applyMarginString(10000, '+5000'), 15000, 'applyMarginString +5000 (명시) = +5000')
  eq(applyMarginString(10000, '-1000'), 9000, 'applyMarginString -1000 = 9000')
  eq(applyMarginString(10000, '5,000'), 15000, 'applyMarginString "5,000" 콤마 허용')
  eq(applyMarginString(10000, '5000원'), 15000, 'applyMarginString "5000원" 단위 허용')
  eq(applyMarginString(10000, 'invalid'), null, 'applyMarginString invalid → null')
  eq(applyMarginString(10000, '-50%'), 5000, 'applyMarginString -50% = 5000')
}

// ── evaluateCondition 단독 검증 ────────────────────
{
  assert(evaluateCondition('default', { price: 0 }), 'default 항상 true')
  assert(
    evaluateCondition("postType == 'self'", { price: 0, postType: 'self' }),
    "postType == 'self' 매칭"
  )
  assert(
    !evaluateCondition("postType == 'self'", { price: 0, postType: 'outsource' }),
    "postType == 'self' (outsource 시 false)"
  )
  assert(
    evaluateCondition('price >= 100000', { price: 120000 }),
    'price >= 100000 (120000)'
  )
  assert(
    !evaluateCondition('price >= 100000', { price: 50000 }),
    'price >= 100000 (50000) false'
  )
  assert(
    !evaluateCondition('unknownVar == 1', { price: 0 }),
    '미지원 식별자 → false (안전)'
  )
}

// ── validateTierRulesJson 검증 ──────────────────────
{
  const ok = validateTierRulesJson(JSON.stringify(FAMILY_RULES))
  assert(ok.ok === true, 'validateTierRulesJson — 정상 JSON 통과')

  const fail1 = validateTierRulesJson('not-json')
  assert(fail1.ok === false, 'validateTierRulesJson — 잘못된 JSON 실패')

  const fail2 = validateTierRulesJson('{"rules": "notarray"}')
  assert(fail2.ok === false, 'validateTierRulesJson — rules 가 배열 아니면 실패')

  const fail3 = validateTierRulesJson('{"rules": [{"condition":"", "margin":"10%"}]}')
  assert(fail3.ok === false, 'validateTierRulesJson — 빈 condition 실패')
}

// ── parseTierRules 검증 ────────────────────────────
{
  eq(parseTierRules(null), null, 'parseTierRules(null) = null')
  eq(parseTierRules(''), null, 'parseTierRules("") = null')
  const obj = parseTierRules('{"type":"tiered","rules":[]}')
  assert(obj !== null && obj.type === 'tiered', 'parseTierRules — 문자열 JSON 파싱')
  const passthrough = parseTierRules({ type: 'x', rules: [] })
  assert(passthrough !== null && passthrough.type === 'x', 'parseTierRules — 객체 통과')
}

// ── 결과 출력 ─────────────────────────────────────
// eslint-disable-next-line no-console
console.log(`\nTier Rules Service — passed=${passed}  failed=${failed}`)
if (failed > 0) {
  // eslint-disable-next-line no-console
  console.error(`Failed tests:\n  - ${failures.join('\n  - ')}`)
  // ts-node 직접 실행 시 종료코드 반영. jest 도입 시 이 줄 제거.
  if (typeof process !== 'undefined' && typeof process.exit === 'function') {
    process.exit(1)
  }
}

export {} // ESM 환경에서 isolatedModules 통과
