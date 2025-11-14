/**
 * Pricing Service Types
 * 가격정책 서비스 관련 DTO 타입 정의
 */

/**
 * 가격 파싱 결과
 */
export interface ParsedPrice {
  value: number
  isValid: boolean
  rawInput: any
}

/**
 * 가격정책 적용 요청 DTO
 */
export interface ApplyPricingPolicyDTO {
  originalPrice: number
  pricingPolicyText: string
  shippingFee?: number
  userId?: string
}

/**
 * 가격정책 적용 결과
 */
export interface PricingResult {
  originalPrice: number
  appliedPrice: number
  margin: number
  marginPercentage: number
  policyType: string
  policyDescription: string
  shippingFee: number
}

/**
 * 가격정책 타입
 */
export enum PricingPolicyType {
  FAMILY_WHOLESALE = 'FAMILY_WHOLESALE', // 가족도매방: 원가 그대로 + 구간별 마진
  YOHAN_CHOROKI = 'YOHAN_CHOROKI', // 요한이네/초록이네: 수집가격 기준 구간별 마진
  NAEUN_SD_CLOSED = 'NAEUN_SD_CLOSED', // 나은/SD푸드/폐쇄몰: 공급가 기준 마진
  PERCENT_MARGIN = 'PERCENT_MARGIN', // 퍼센트 마진
  FIXED_MARGIN = 'FIXED_MARGIN', // 고정 마진
  MULTIPLE = 'MULTIPLE', // 배수
  MIN_MARGIN = 'MIN_MARGIN', // 최소 마진
  NO_POLICY = 'NO_POLICY' // 정책 없음 (원가 그대로)
}

/**
 * 배송비 계산 DTO
 */
export interface CalculateShippingFeeDTO {
  totalAmount: number
  freeShippingAmount?: number
  defaultShippingFee?: number
}

/**
 * 공급가 계산 결과 (가족도매방 전용)
 */
export interface SupplyPriceResult {
  supplyPrice: number // 공급가 (원가의 90%)
  originalPrice: number // 원가
  salePrice: number // 판매가
  margin: number // 마진 (판매가 - 공급가)
}
