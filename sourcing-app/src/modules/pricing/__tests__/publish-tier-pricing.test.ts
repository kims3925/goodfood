/**
 * publish-tier-pricing.ts 단위 검증 — 다단계 발행 가격 골든 케이스
 * (bandauto-v2-multitier-publish-pricing-directive.md §6 G1~G5 + tier 선택기)
 *
 * ts-jest 가 환경에 없으므로 별도 의존성 없이 ts-node 로 실행 가능하도록 작성.
 * 실행:
 *   pnpm --filter sourcing-app exec ts-node --transpile-only src/modules/pricing/__tests__/publish-tier-pricing.test.ts
 */

import {
  applyPricingMode,
  applyRounding,
  clampWithMapGuardrail,
  computePolicyPrice,
  applyShipping,
  resolveTierUnitPrice,
  normalizePriceTier,
} from '../publish-tier-pricing'

// ── 미니 테스트 러너 (jest 없이도 동작) ─────────────────
let passed = 0
let failed = 0
const failures: string[] = []

function assert(cond: boolean, name: string): void {
  if (cond) {
    passed++
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

// ── G1: INHERIT_SOURCE, 소스가 12,000 → 12,000 (라운딩·MAP 미적용) ──────────
{
  const r = computePolicyPrice({ mode: 'INHERIT_SOURCE', roundingRule: 'END_900', mapFloor: 14000 }, 12000)
  eq(r.price, 12000, 'G1: INHERIT_SOURCE 12000 → 12000 (라운딩·MAP 무시)')
  eq(r.clamped, false, 'G1: INHERIT_SOURCE 는 클램프 안 함')
}

// ── G2: MARKUP PERCENT 30%, 소스가 12,000 → 15,600 ────────────────────────
{
  const r = computePolicyPrice({ mode: 'MARKUP', markupType: 'PERCENT', markupValue: 30 }, 12000)
  eq(r.price, 15600, 'G2: MARKUP 30% on 12000 → 15600')
}

// ── G3: MARKUP AMOUNT 3,000, 소스가 12,000 → 15,000 ───────────────────────
{
  const r = computePolicyPrice({ mode: 'MARKUP', markupType: 'AMOUNT', markupValue: 3000 }, 12000)
  eq(r.price, 15000, 'G3: MARKUP +3000 on 12000 → 15000')
}

// ── G4: 라운딩 END_900, 결과 15,600 → 15,900 ──────────────────────────────
{
  eq(applyRounding(15600, 'END_900'), 15900, 'G4: END_900 15600 → 15900')
  eq(applyRounding(15000, 'END_900'), 15900, 'G4b: END_900 15000 → 15900')
  eq(applyRounding(15950, 'END_900'), 16900, 'G4c: END_900 15950 → 16900 (초과 시 +1000)')
  eq(applyRounding(15900, 'END_900'), 15900, 'G4d: END_900 이미 15900 → 15900')
  // MARKUP + END_900 결합 (G2 결과에 라운딩)
  const r = computePolicyPrice({ mode: 'MARKUP', markupType: 'PERCENT', markupValue: 30, roundingRule: 'END_900' }, 12000)
  eq(r.price, 15900, 'G4e: MARKUP 30% (15600) + END_900 → 15900')
}

// ── G5: MAP 하한 14,000, 산출가 13,500 → 14,000 클램프 + 경고 ──────────────
{
  const r = clampWithMapGuardrail(13500, 14000, null)
  eq(r.price, 14000, 'G5: MAP 하한 14000, 13500 → 14000 클램프')
  eq(r.clamped, true, 'G5: clamped=true')
  assert(typeof r.warning === 'string' && r.warning.includes('14000'), 'G5: 경고 메시지 발생(무음 클램프 금지)')
  // 정책 경유 (MARKUP 결과가 하한 미달인 케이스)
  const r2 = computePolicyPrice({ mode: 'MARKUP', markupType: 'AMOUNT', markupValue: 1500, mapFloor: 14000 }, 12000)
  eq(r2.price, 14000, 'G5b: 12000+1500=13500 < 14000 → 14000 클램프')
  assert(r2.clamped === true && r2.warning !== null, 'G5b: 클램프+경고')
}

// ── 상한(priceCeiling) 가드레일 ───────────────────────────────────────────
{
  const r = clampWithMapGuardrail(50000, null, 40000)
  eq(r.price, 40000, '상한 40000, 50000 → 40000 클램프')
  assert(r.clamped === true && r.warning !== null, '상한 클램프+경고')
}

// ── applyPricingMode FIXED_MARGIN ─────────────────────────────────────────
{
  // 원가 7000, 마진 30% → 7000 / 0.7 = 10000
  eq(Math.round(applyPricingMode('FIXED_MARGIN', 0, { cost: 7000, markupValue: 30 })), 10000, 'FIXED_MARGIN cost7000 30% → 10000')
  // 마진 100%+ → 안전 폴백 (basePrice 반환)
  eq(applyPricingMode('FIXED_MARGIN', 9999, { cost: 7000, markupValue: 100 }), 9999, 'FIXED_MARGIN 100% → 안전 폴백')
}

// ── applyShipping (calculateSellingPrice 동일 공식) ───────────────────────
{
  eq(applyShipping(10000, 3000, 'SEPARATE'), 13000, 'applyShipping SEPARATE → +배송비')
  eq(applyShipping(10000, 3000, 'INCLUDED'), 10000, 'applyShipping INCLUDED → 배송비 미반영')
  eq(applyShipping(10000, 3000, 'NONE'), 13000, 'applyShipping NONE → +배송비')
  eq(applyShipping(10000, 0, null), 10000, 'applyShipping 배송비 0 → 그대로')
}

// ── resolveTierUnitPrice: tier 별 단가 선택 ───────────────────────────────
{
  // WHOLESALE → wholesalePrice 그대로 (INHERIT_SOURCE, 배송비 미반영)
  const w = resolveTierUnitPrice({ tier: 'WHOLESALE', wholesalePrice: 12000, retailPrice: 15600, shippingFee: 3000, bundleShippingType: 'SEPARATE' })
  eq(w.unitPrice, 12000, 'WHOLESALE → 도매가 12000 (배송비/마진 무시)')
  eq(w.label, '도매가', 'WHOLESALE label = 도매가')
  eq(w.wholesaleFallback, false, 'WHOLESALE 정상 → fallback=false')

  // RETAIL → retailPrice + 배송비
  const r = resolveTierUnitPrice({ tier: 'RETAIL', wholesalePrice: 12000, retailPrice: 15600, shippingFee: 3000, bundleShippingType: 'SEPARATE' })
  eq(r.unitPrice, 18600, 'RETAIL → 15600 + 3000 = 18600')
  eq(r.label, '판매가', 'RETAIL label = 판매가')

  // RETAIL INCLUDED → 배송비 미반영
  const r2 = resolveTierUnitPrice({ tier: 'RETAIL', wholesalePrice: 12000, retailPrice: 15600, shippingFee: 3000, bundleShippingType: 'INCLUDED' })
  eq(r2.unitPrice, 15600, 'RETAIL INCLUDED → 15600 (배송비 포함)')

  // WHOLESALE 인데 도매가 없음 → retailPrice 폴백(안전 방향) + flag
  const wf = resolveTierUnitPrice({ tier: 'WHOLESALE', wholesalePrice: null, retailPrice: 15600 })
  eq(wf.unitPrice, 15600, 'WHOLESALE 도매가 없음 → retailPrice 폴백(더 비싼 쪽 = 안전)')
  eq(wf.wholesaleFallback, true, 'WHOLESALE 폴백 시 flag=true')
}

// ── normalizePriceTier ────────────────────────────────────────────────────
{
  eq(normalizePriceTier('WHOLESALE'), 'WHOLESALE', "normalize 'WHOLESALE'")
  eq(normalizePriceTier('RETAIL'), 'RETAIL', "normalize 'RETAIL'")
  eq(normalizePriceTier(null), 'RETAIL', 'normalize null → RETAIL 기본')
  eq(normalizePriceTier(undefined), 'RETAIL', 'normalize undefined → RETAIL 기본')
}

// ── G8 토대: 결정적/순수 — 같은 입력 = 같은 출력 (스냅샷 불변성) ───────────
{
  const a = resolveTierUnitPrice({ tier: 'RETAIL', wholesalePrice: 12000, retailPrice: 15600, shippingFee: 3000, bundleShippingType: 'SEPARATE' })
  const b = resolveTierUnitPrice({ tier: 'RETAIL', wholesalePrice: 12000, retailPrice: 15600, shippingFee: 3000, bundleShippingType: 'SEPARATE' })
  eq(a.unitPrice, b.unitPrice, 'G8: 결정적 — 동일 입력 동일 출력 (스냅샷 안정)')
}

// ── 결과 출력 ─────────────────────────────────────────
// eslint-disable-next-line no-console
console.log(`\nPublish Tier Pricing — passed=${passed}  failed=${failed}`)
if (failed > 0) {
  // eslint-disable-next-line no-console
  console.error(`Failed tests:\n  - ${failures.join('\n  - ')}`)
  if (typeof process !== 'undefined' && typeof process.exit === 'function') {
    process.exit(1)
  }
}

export {} // ESM 환경에서 isolatedModules 통과
