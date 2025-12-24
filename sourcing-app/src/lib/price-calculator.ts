/**
 * 가격 계산 공통 모듈
 * shop-app과 동일한 로직 유지
 */

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
