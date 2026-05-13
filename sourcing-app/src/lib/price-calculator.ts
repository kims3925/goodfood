/**
 * 가격 계산 공통 모듈
 * shop-app과 동일한 로직 유지
 */

import {
  applyTierRules as applyTierRulesEngine,
  type TierRuleApplied,
  type TierRuleContext,
} from '@/modules/pricing/tier-rules.service'

export type BundleShippingType = 'NONE' | 'INCLUDED' | 'SEPARATE'

/**
 * 단일 상품 판매가 계산 (수량 1개 기준)
 * 소매밴드 발행, 상품 API 응답 등에서 사용
 *
 * - 배송비 포함 상품 (INCLUDED): 판매가 = 소매가
 * - 배송비 별도 상품: 판매가 = 소매가 + 배송비
 */
export function calculateSellingPrice(
  basePrice: number,
  shippingFee: number,
  bundleShippingType: BundleShippingType | string | null
): number {
  if (bundleShippingType === 'INCLUDED') {
    return basePrice // 배송비 이미 포함
  }
  return basePrice + shippingFee // 배송비 추가
}

// ── tierRules 마진 엔진 hook (GBand SaaS Phase 3, 2026-05-13) ─────────────
//
// PricingPolicy.tierRules 가 있으면 우선 적용, 없으면 옛 로직 fallthrough.
// 옛 마진 로직 (텍스트 구간표 + AI 가공) 은 절대 삭제하지 않으며, 호출자가
// `applyTierMargin` 결과의 `applied=true` 만 신뢰하여 가격을 덮어쓰면 됨.
//
// 사용처 예시 (`modules/transformation/product.transformer.ts` 등):
//   const tier = applyTierMargin(variant.wholesalePrice ?? 0, policy?.tierRules, {
//     postType: channel?.postType,
//   })
//   if (tier.applied) variant.price = tier.finalPrice   // tierRules 우선
//   // tier.applied === false → 옛 AI/구간표 결과 그대로
export interface TierMarginResult {
  /** tierRules 가 실제로 적용됐는지 — false 면 호출자는 옛 로직 그대로 사용 */
  applied: boolean
  /** 최종 가격 (applied=false 면 basePrice 그대로) */
  finalPrice: number
  /** 디버그용 — 매칭된 규칙 desc */
  matchedDesc: string | null
  /** 디버그용 — 적용된 마진 문자열 */
  marginApplied: string | null
}

/**
 * PricingPolicy.tierRules 기반 마진 적용 (안전 폴백 포함).
 *
 * - tierRulesJson 이 null/undefined/빈값 → applied=false (옛 로직 사용)
 * - 매칭 규칙 없음 → applied=false
 * - 마진 파싱 실패 → applied=false
 * - 정상 매칭 → applied=true + finalPrice
 *
 * 옛 마진 로직과 완전히 독립이며, 단순히 "tierRules 가 있을 때만 우선 적용" 게이트.
 */
export function applyTierMargin(
  basePrice: number,
  tierRulesJson: unknown,
  ctx?: Partial<TierRuleContext>
): TierMarginResult {
  // tierRules 가 비어있으면 즉시 폴백 — 옛 로직 그대로
  if (tierRulesJson == null || tierRulesJson === '') {
    return {
      applied: false,
      finalPrice: Math.round(basePrice),
      matchedDesc: null,
      marginApplied: null,
    }
  }

  const result: TierRuleApplied = applyTierRulesEngine(basePrice, tierRulesJson, ctx)

  // matchedRule 이 있어야만 "적용됨" 으로 간주.
  // (rules 가 있어도 어느 조건도 매치 안 되면 옛 로직 폴백)
  if (!result.matchedRule) {
    return {
      applied: false,
      finalPrice: Math.round(basePrice),
      matchedDesc: null,
      marginApplied: null,
    }
  }

  return {
    applied: true,
    finalPrice: result.finalPrice,
    matchedDesc: result.matchedRule.desc ?? null,
    marginApplied: result.marginApplied,
  }
}
