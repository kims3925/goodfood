/**
 * Publish Tier Pricing — 다단계 발행(fan-out) 가격 tier 결정 엔진
 *
 * 배경 (bandauto-v2-multitier-publish-pricing-directive.md §3.2):
 *   하나의 소스 상품(AI 1회 가공)을 여러 발행 대상에 가격정책을 다르게 적용해 발행한다.
 *   - WHOLESALE tier (가족도매방밴드): 소스 도매가 그대로 (INHERIT_SOURCE, 마진 0)
 *   - RETAIL    tier (쇼핑몰/소매밴드): 소매 마진가 (기존 동작)
 *
 * ⚠️ 설계 결정 — 머니 수학 중복 금지:
 *   현행 시스템은 AI 가공 시점에 이미 소매 마진가(`Product.price` / `ProductVariant.price`)와
 *   소스 도매가(`wholesalePrice`)를 **둘 다 산출·저장**한다. 따라서 발행 시점에 마진을
 *   다시 계산하면 기존 정책 엔진(`price-calculator.ts` + `tier-rules.service.ts`)과
 *   값이 갈라질 위험("도매가가 소매로 새거나 그 반대" — 지시서 §9)이 있다.
 *
 *   그래서 라이브 경로(`resolveTierUnitPrice`)는 **이미 저장된 값을 tier 별로 선택**만 한다:
 *     - WHOLESALE → 저장된 wholesalePrice (INHERIT_SOURCE)
 *     - RETAIL    → 저장된 retailPrice + 배송비 (기존 calculateSellingPrice 와 동일 공식)
 *
 *   아래 `computePolicyPrice` 계열(MARKUP/FIXED_MARGIN/rounding/MAP)은 지시서가 요구한
 *   PricingEngine 의 순수 구현 + 골든 테스트(G1~G5)를 제공하되, **소매 라이브 가격 산출에
 *   배선하지 않는다.** 소매 마진은 기존 엔진이 계속 담당한다. MARKUP/FIXED_MARGIN 을
 *   라이브 소매 경로에 연결하려면 시니어 리뷰 + 정산 영향 검토가 선행돼야 한다(지시서 §3.2·§7).
 *
 * 외부 의존 X — 순수 함수. ts-node / jest 어디서나 import 가능.
 */

// ── 타입 ───────────────────────────────────────────────

/** 발행 대상의 가격 tier — Prisma enum PriceTier 와 1:1 */
export type PublishPriceTier = 'WHOLESALE' | 'RETAIL'

/** 가격정책 모드 (지시서 §2.1 PricingMode) */
export type PricingMode = 'INHERIT_SOURCE' | 'MARKUP' | 'FIXED_MARGIN'

/** 마크업 유형 */
export type MarkupType = 'PERCENT' | 'AMOUNT'

/** 라운딩 규칙 */
export type RoundingRule = 'END_900' | 'ROUND_100' | null | undefined

/** 합배송 타입 (BundleShippingType 와 동일 의미) */
export type BundleShippingType = 'NONE' | 'INCLUDED' | 'SEPARATE' | string | null | undefined

/** 가격정책 명세 (지시서 §2.1 PricingPolicy 의 가격 계산 필드만 추린 순수 명세) */
export interface PricingPolicySpec {
  mode: PricingMode
  markupType?: MarkupType
  markupValue?: number | null
  roundingRule?: RoundingRule
  mapFloor?: number | null
  priceCeiling?: number | null
}

/** computePolicyPrice 결과 — 클램프 여부/경고를 명시(무음 클램프 금지, 지시서 §3.2) */
export interface PolicyPriceResult {
  price: number
  /** MAP 하한/상한에 의해 클램프됐는지 */
  clamped: boolean
  /** 클램프 시 경고 메시지 (셀러 알림/로그용). 없으면 null */
  warning: string | null
}

// ── 순수 가격정책 엔진 (지시서 PricingEngine — 골든 테스트 G1~G5) ─────────────
//
// ⚠️ 라이브 소매 가격 산출에 배선되어 있지 않음 (위 설계 결정 참조).

/** 모드별 기본 가격 계산. 라운딩/MAP 미적용. */
export function applyPricingMode(
  mode: PricingMode,
  basePrice: number,
  opts?: { cost?: number; markupType?: MarkupType; markupValue?: number | null }
): number {
  const markupValue = Number(opts?.markupValue ?? 0)
  switch (mode) {
    case 'INHERIT_SOURCE':
      return basePrice
    case 'MARKUP':
      return opts?.markupType === 'AMOUNT'
        ? basePrice + markupValue
        : basePrice * (1 + markupValue / 100)
    case 'FIXED_MARGIN': {
      // 원가 기준 고정 마진: 판매가 = cost / (1 - margin%)
      const cost = Number(opts?.cost ?? basePrice)
      const denom = 1 - markupValue / 100
      if (denom <= 0) return basePrice // 안전 폴백 (100% 이상 마진 불가)
      return cost / denom
    }
    default:
      return basePrice
  }
}

/** 라운딩 규칙 적용. */
export function applyRounding(price: number, rule: RoundingRule): number {
  if (!rule) return Math.round(price)
  switch (rule) {
    case 'END_900': {
      // 끝자리를 900 으로 — 천원 미만 절사 후 +900, 그 값이 원가보다 작으면 +1000
      const base = Math.floor(price / 1000) * 1000
      let candidate = base + 900
      if (candidate < price) candidate += 1000
      return candidate
    }
    case 'ROUND_100':
      return Math.round(price / 100) * 100
    default:
      return Math.round(price)
  }
}

/**
 * MAP 가드레일 — 하한/상한 위반 시 클램프 + 경고(무음 통과 금지, 지시서 §3.2).
 */
export function clampWithMapGuardrail(
  price: number,
  mapFloor?: number | null,
  priceCeiling?: number | null
): PolicyPriceResult {
  if (mapFloor != null && price < mapFloor) {
    return {
      price: mapFloor,
      clamped: true,
      warning: `MAP 하한(${mapFloor}) 위반 — 산출가 ${price} → ${mapFloor} 로 클램프`,
    }
  }
  if (priceCeiling != null && price > priceCeiling) {
    return {
      price: priceCeiling,
      clamped: true,
      warning: `상한(${priceCeiling}) 초과 — 산출가 ${price} → ${priceCeiling} 로 클램프`,
    }
  }
  return { price, clamped: false, warning: null }
}

/**
 * 정책 1건을 basePrice 에 적용한 최종가 (모드 → 라운딩 → MAP 클램프).
 *
 * INHERIT_SOURCE 는 마진 0 · 라운딩/MAP 미적용이 기본 (지시서 §3.2, 골든 G1).
 */
export function computePolicyPrice(
  policy: PricingPolicySpec,
  basePrice: number,
  ctx?: { cost?: number }
): PolicyPriceResult {
  if (policy.mode === 'INHERIT_SOURCE') {
    return { price: basePrice, clamped: false, warning: null }
  }
  const raw = applyPricingMode(policy.mode, basePrice, {
    cost: ctx?.cost,
    markupType: policy.markupType,
    markupValue: policy.markupValue,
  })
  const rounded = applyRounding(raw, policy.roundingRule)
  return clampWithMapGuardrail(rounded, policy.mapFloor, policy.priceCeiling)
}

// ── 라이브 경로: tier 별 단가 선택 (저장된 값 선택만, 재계산 X) ──────────────

/**
 * 배송비 반영 (기존 calculateSellingPrice 와 동일 공식 — 라이브 소매 경로의 단일 권위).
 * 별도 import 없이 순수 검증 가능하도록 동일 로직을 명시.
 */
export function applyShipping(
  basePrice: number,
  shippingFee: number,
  bundleShippingType: BundleShippingType
): number {
  if (bundleShippingType === 'INCLUDED') return basePrice
  return basePrice + (shippingFee || 0)
}

export interface ResolveTierUnitPriceParams {
  tier: PublishPriceTier
  /** 소스 도매가 (Product/Variant.wholesalePrice) */
  wholesalePrice: number | null | undefined
  /** 소매 마진가 (Product/Variant.price) — AI 가공 시점에 이미 산출됨 */
  retailPrice: number
  shippingFee?: number
  bundleShippingType?: BundleShippingType
}

export interface ResolveTierUnitPriceResult {
  tier: PublishPriceTier
  /** 발행 본문에 표기할 단가 */
  unitPrice: number
  /** 본문 라벨 ("도매가" | "판매가") */
  label: string
  /**
   * WHOLESALE 인데 wholesalePrice 가 없어 retailPrice 로 폴백했는지.
   * 폴백은 "더 비싼 소매가"를 쓰므로 도매방 underprice 사고를 일으키지 않는 안전 방향.
   */
  wholesaleFallback: boolean
}

/**
 * tier 에 따라 발행 본문에 노출할 단가를 선택한다.
 *
 * - WHOLESALE: wholesalePrice 그대로 (INHERIT_SOURCE — 마진 0, 배송비/라운딩 미반영).
 *   wholesalePrice 가 없으면 retailPrice 로 폴백(안전 방향) + wholesaleFallback=true.
 * - RETAIL: 기존 calculateSellingPrice 공식 (retailPrice + 배송비).
 *
 * 순수·결정적 — 같은 입력은 항상 같은 출력 (스냅샷 불변성 G8 의 토대).
 */
export function resolveTierUnitPrice(params: ResolveTierUnitPriceParams): ResolveTierUnitPriceResult {
  const { tier, wholesalePrice, retailPrice, shippingFee = 0, bundleShippingType = null } = params

  if (tier === 'WHOLESALE') {
    const hasWholesale = wholesalePrice != null && Number(wholesalePrice) > 0
    return {
      tier,
      unitPrice: hasWholesale ? Number(wholesalePrice) : retailPrice,
      label: '도매가',
      wholesaleFallback: !hasWholesale,
    }
  }

  return {
    tier,
    unitPrice: applyShipping(retailPrice, shippingFee, bundleShippingType),
    label: '판매가',
    wholesaleFallback: false,
  }
}

/** Prisma PriceTier(string enum) → 내부 타입 정규화 (null/undefined → RETAIL 기본). */
export function normalizePriceTier(value: unknown): PublishPriceTier {
  return value === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL'
}
