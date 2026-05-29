/**
 * 경영밴드 이원화 가격정책 — 소매채널별 적용 모드 분기 (resolveRetailPrice)
 *
 * 배경 (경영밴드_가격정책_로직_개발지침서_v1.docx §3, §6):
 *   PricingPolicy 는 도매채널(WHOLESALE) 1건당 정의되지만, 같은 도매방 상품을
 *   소매채널(RETAIL) 별로 다르게 적용해야 하는 케이스가 있다:
 *     - 경영비공개밴드/외주밴드: 가족도매방 상품을 마진 0으로 그대로 발행 (ZERO_MARGIN)
 *     - 일반 소매밴드: 기존 PricingPolicy.content/tierRules 그대로 적용 (INHERIT)
 *
 *   PricingPolicyTarget 행을 (pricingPolicyId, retailChannelId) 로 두어
 *   소매채널별 applyMode 를 분기한다. 행이 없으면 INHERIT 기본 동작 → 기존 정책 그대로.
 *
 * ⚠️ Prisma 를 직접 import 하므로 server-only.
 *    클라이언트 컴포넌트가 import 할 수 있는 `lib/price-calculator.ts` 와는 분리한다.
 *
 * 호출 시점:
 *   - AI 가공 후처리 (transformation) 에서 소매채널 결정 후 가격 산출 직전
 *   - 발행 워크플로우 pre-flight (선택적) — 소매채널별 가격 미리보기 제공 시
 */

import prisma from '@bandauto/db'
import {
  applyTierMargin,
  calculateSellingPrice,
  type BundleShippingType,
} from './price-calculator'

export type PolicyApplyMode = 'INHERIT' | 'ZERO_MARGIN' | 'CUSTOM'

export type PolicyResolveMode =
  | 'NO_POLICY'      // 도매방 정책 자체가 없음 → basePrice 그대로
  | 'POLICY_INACTIVE' // 정책은 있지만 비활성 → basePrice 그대로
  | 'ZERO_MARGIN'    // PricingPolicyTarget.applyMode=ZERO_MARGIN → basePrice 그대로
  | 'CUSTOM'         // PricingPolicyTarget.applyMode=CUSTOM → customContent 적용 (현재 INHERIT 폴백)
  | 'TIER_RULES'     // INHERIT 흐름에서 tierRules 매칭됨
  | 'INHERIT'        // INHERIT 흐름인데 tierRules 매칭 없음 → 옛 bracket 로직 폴백 (호출자가 이어서 계산)

export interface ResolveRetailPriceParams {
  basePrice: number
  /** PricingPolicy.id — 도매채널 기준 정책 ID. null/undefined 면 NO_POLICY */
  policyId: number | null | undefined
  /** 발행 대상 소매 Channel.id */
  retailChannelId: number
  /** tierRules 평가 컨텍스트 */
  postType?: string
  /** 배송비 (INHERIT/bracket 폴백 시 calculateSellingPrice 에 전달) */
  shippingFee?: number
  bundleShippingType?: BundleShippingType | string | null
}

export interface ResolveRetailPriceResult {
  /**
   * 최종 가격 — 호출자가 그대로 Product/Variant.price 로 저장하거나 발행 본문에 사용.
   * INHERIT 모드에서 tierRules 매칭이 없을 때만 null 이며,
   * 이 경우 호출자가 옛 bracket 로직(`calculateSellingPrice` + content 기반)을 이어서 수행해야 한다.
   */
  price: number | null
  mode: PolicyResolveMode
  /** 디버그/로그용 */
  matchedDesc?: string | null
  marginApplied?: string | null
}

/**
 * 정책 + 소매채널 매칭 결과에 따라 최종 판매가를 결정한다.
 *
 * 우선순위 (지침서 §3.1):
 *   1. policyId 없음 / 정책 비활성 → basePrice 그대로 (NO_POLICY / POLICY_INACTIVE)
 *   2. PricingPolicyTarget 매칭 + applyMode=ZERO_MARGIN → basePrice 그대로
 *   3. PricingPolicyTarget 매칭 + applyMode=CUSTOM → customContent 적용 (현재는 INHERIT 폴백)
 *   4. INHERIT (매칭 없거나 applyMode=INHERIT) → tierRules 평가 → 매칭되면 TIER_RULES, 아니면 INHERIT(호출자 폴백)
 */
export async function resolveRetailPrice(
  params: ResolveRetailPriceParams
): Promise<ResolveRetailPriceResult> {
  const { basePrice, policyId, retailChannelId, postType } = params

  if (!policyId) {
    return { price: basePrice, mode: 'NO_POLICY' }
  }

  // 정책 + 매칭 타겟 한 번에 조회 (N+1 방지)
  const policy = await prisma.pricingPolicy.findFirst({
    where: { id: policyId },
    include: {
      targets: { where: { retailChannelId } },
    },
  })

  if (!policy) {
    return { price: basePrice, mode: 'NO_POLICY' }
  }
  if (!policy.isActive) {
    return { price: basePrice, mode: 'POLICY_INACTIVE' }
  }

  const target = policy.targets[0] // (pricingPolicyId, retailChannelId) unique 보장
  const applyMode: PolicyApplyMode = (target?.applyMode as PolicyApplyMode) ?? 'INHERIT'

  if (applyMode === 'ZERO_MARGIN') {
    return { price: basePrice, mode: 'ZERO_MARGIN' }
  }

  if (applyMode === 'CUSTOM') {
    // TODO(v1.1): customContent 를 bracket 파싱해서 별도 마진 규칙 적용.
    // 현재는 안전 폴백: INHERIT 와 동일하게 처리 (정책 본체의 tierRules → bracket).
    // 향후 customContent 가 채워졌을 때 별도 구간표 파서를 끼우면 됨.
    // 폴백을 명시적으로 표시하기 위해 mode 는 'CUSTOM' 유지하되 price 는 INHERIT 와 동일 산출.
    const tier = applyTierMargin(basePrice, policy.tierRules, { postType })
    if (tier.applied) {
      return {
        price: tier.finalPrice,
        mode: 'CUSTOM',
        matchedDesc: tier.matchedDesc,
        marginApplied: tier.marginApplied,
      }
    }
    return { price: null, mode: 'CUSTOM' } // 호출자가 bracket 로직 이어서
  }

  // INHERIT — tierRules 우선 평가
  const tier = applyTierMargin(basePrice, policy.tierRules, { postType })
  if (tier.applied) {
    return {
      price: tier.finalPrice,
      mode: 'TIER_RULES',
      matchedDesc: tier.matchedDesc,
      marginApplied: tier.marginApplied,
    }
  }

  // tierRules 매칭 안 됨 — 호출자가 옛 bracket(content 기반) 로직 이어서
  return { price: null, mode: 'INHERIT' }
}

/**
 * 편의 함수 — resolveRetailPrice 의 결과에 배송비까지 반영해서 최종 판매가를 돌려준다.
 * 호출자가 더 이상 후처리할 필요 없는 케이스(ZERO_MARGIN / TIER_RULES) 와
 * 폴백(INHERIT) 케이스를 한 번에 처리.
 *
 * INHERIT 폴백일 때는 호출자가 PricingPolicy.content 의 bracket 파싱 결과를 별도로 적용해야
 * 하지만, 그 경로가 이미 transformation 단계에 잘 동작 중이므로 본 함수는 그 입력값을
 * `bracketFallbackPrice` 로 받아 합산만 한다. 합산 = retailPrice + (배송비 별도 시 shippingFee).
 */
export async function resolveRetailPriceWithShipping(
  params: ResolveRetailPriceParams & { bracketFallbackPrice: number }
): Promise<ResolveRetailPriceResult & { finalSellingPrice: number }> {
  const { shippingFee = 0, bundleShippingType = null, bracketFallbackPrice } = params
  const r = await resolveRetailPrice(params)

  // ZERO_MARGIN 은 정책 의미상 배송비 미합산이 맞다 (지침서 §1.3 — 공급가=판매가).
  // 일반 마진가는 calculateSellingPrice 와 동일 공식.
  const effective = r.price ?? bracketFallbackPrice
  const finalSellingPrice =
    r.mode === 'ZERO_MARGIN'
      ? effective
      : calculateSellingPrice(effective, shippingFee, bundleShippingType as BundleShippingType)

  return { ...r, finalSellingPrice }
}
