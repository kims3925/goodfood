/**
 * 가격 계산 공통 모듈
 * 합배송, 배송비 포함/별도 등 모든 가격 계산 로직을 통합
 *
 * 사용처:
 * - 상품 상세 페이지 (ProductDetailClient.tsx)
 * - 장바구니 페이지 (cart/page.tsx)
 * - 주문 페이지 (checkout/page.tsx)
 */

export type BundleShippingType = 'NONE' | 'INCLUDED' | 'SEPARATE'

export interface PriceCalculationInput {
  /**
   * 옵션별 기준 가격
   * - INCLUDED (할인형): 배송비가 포함된 판매가 (예: 12,000원 = 상품가 9,000 + 배송비 3,000)
   * - SEPARATE (배송비형): 배송비 미포함 원가 (예: 9,000원)
   * - NONE: 그대로 사용
   */
  basePrice: number
  shippingFee: number         // 배송비
  quantity: number            // 수량
  bundleMaxQty: number        // 합배송 최대 수량 (1이면 합배송 없음)
  bundleUnit: number          // 옵션별 합배송 단위 (예: 2박스 옵션이면 2)
  bundleShippingType: BundleShippingType | string | null  // 합배송 타입
}

export interface PriceCalculationResult {
  unitPrice: number           // 할인/배송비 반영된 단가
  originalPrice: number       // 배송비 미포함 원가
  itemTotal: number           // 정확한 아이템 총액
  discountAmount: number      // 할인 금액 (합배송 할인)
  shippingCount: number       // 배송 횟수
  isBundleDiscount: boolean   // 할인형 여부
}

/**
 * 단일 상품 판매가 계산 (수량 1개 기준)
 * 소매밴드 발행, 상품 API 응답 등에서 사용
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

/**
 * 합배송 가격 계산 (수량에 따른 총액 계산)
 * 장바구니, 주문 등에서 사용
 *
 * 합배송 타입:
 * - INCLUDED (할인형): 소매가에 배송비 포함, 합배송 시 할인
 * - SEPARATE (배송비형): 소매가 + 배송비, 합배송 시 배송비 절약
 * - NONE: 합배송 없음
 */
export function calculateItemPrice(input: PriceCalculationInput): PriceCalculationResult {
  const {
    basePrice,
    shippingFee,
    quantity,
    bundleMaxQty,
    bundleUnit,
    bundleShippingType,
  } = input

  const isBundleDiscount = bundleShippingType === 'INCLUDED'

  let unitPrice = basePrice
  let itemTotal = 0
  let discountAmount = 0
  let shippingCount = 1

  // 합배송 상품 (bundleMaxQty > 1 && shippingFee > 0)
  if (bundleMaxQty > 1 && shippingFee > 0) {
    // 총 합배송 단위 수 계산
    const totalBundleUnits = quantity * bundleUnit

    // 배송 횟수 계산 (올림)
    const fullBundles = Math.floor(totalBundleUnits / bundleMaxQty)
    const remainder = totalBundleUnits % bundleMaxQty
    shippingCount = fullBundles + (remainder > 0 ? 1 : 0)

    if (isBundleDiscount) {
      // 할인형: 첫 번째 수량은 배송비 포함, 2번째 수량부터 할인
      // 할인 개수 = 수량 - 배송 횟수
      const discountCount = Math.max(0, quantity - shippingCount)
      itemTotal = (basePrice * quantity) - (shippingFee * discountCount)
      discountAmount = shippingFee * discountCount
    } else {
      // 배송비형: 배송비는 배송 횟수만큼만 부과
      itemTotal = (basePrice * quantity) + (shippingFee * shippingCount)
      // 절약액 = (매번 배송비 낼 경우) - (실제 배송비)
      const fullShippingCost = shippingFee * quantity
      discountAmount = fullShippingCost - (shippingFee * shippingCount)
    }

    unitPrice = Math.round(itemTotal / quantity)
  } else if (shippingFee > 0 && !isBundleDiscount) {
    // 일반 상품 (배송비 별도)
    unitPrice = basePrice + shippingFee
    itemTotal = unitPrice * quantity
    shippingCount = quantity
  } else {
    // 배송비 없는 상품 또는 배송비 포함 상품 (합배송 없음)
    itemTotal = basePrice * quantity
    shippingCount = isBundleDiscount ? 1 : 0
  }

  return {
    unitPrice,
    originalPrice: basePrice,
    itemTotal,
    discountAmount,
    shippingCount,
    isBundleDiscount,
  }
}

/**
 * 합배송 정보 계산 (UI 표시용)
 */
export function calculateBundleInfo(input: {
  quantity: number
  bundleUnit: number
  bundleMaxQty: number
  shippingFee: number
  bundleShippingType: BundleShippingType | string | null
}) {
  const { quantity, bundleUnit, bundleMaxQty, shippingFee, bundleShippingType } = input

  const totalBundleUnits = quantity * bundleUnit
  const fullBundles = Math.floor(totalBundleUnits / bundleMaxQty)
  const remainder = totalBundleUnits % bundleMaxQty
  const shippingCount = fullBundles + (remainder > 0 ? 1 : 0)
  const isBundleDiscount = bundleShippingType === 'INCLUDED'

  return {
    totalBundleUnits,
    fullBundles,
    remainder,
    shippingCount,
    isBundleDiscount,
    canBundle: bundleMaxQty > 1 && shippingFee > 0,
  }
}
