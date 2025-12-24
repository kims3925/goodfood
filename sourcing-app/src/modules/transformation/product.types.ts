/**
 * Product Transformation Types
 *
 * This file defines all TypeScript interfaces and types for product transformation
 */

import { CollectedPost, CollectedPostImage, AiProvider } from '@bandauto/db'

// =============================================
// INPUT TYPES
// =============================================

/**
 * Input data for product transformation
 */
export interface ProductTransformationInput {
  post: CollectedPost & {
    images: CollectedPostImage[]
  }
  aiProvider: AiProvider
  aiConfig: {
    apiKey: string
    model: string
    temperature?: number
    maxTokens?: number
  }
  policyContent?: string // 가격 정책 내용
  customPrompt?: string  // 사용자 정의 프롬프트 (DB에서 가져온 것)
}

// =============================================
// OUTPUT TYPES
// =============================================

/**
 * Option group configuration
 */
export interface OptionGroup {
  groupName: string  // e.g., "색상", "사이즈", "용량"
  values: string[]   // e.g., ["빨강", "파랑"], ["S", "M", "L"], ["소(250~300g)", "중(350~400g)"]
}

/**
 * Option-specific pricing (for wholesale products with different prices per option)
 */
export interface OptionPrice {
  option: string        // e.g., "소(250~300g)", "중(350~400g)"
  price?: number        // Legacy: 단일 가격 (deprecated, use basePrice/sellingPrice)
  basePrice?: number    // 도매가 (원가)
  sellingPrice?: number // 판매가 (정책 적용된 가격)
}

/**
 * Shipping information for wholesale products (legacy)
 */
export interface ShippingInfo {
  shippingIncluded: boolean        // 배송비 포함 여부
  maxBundle?: number | null        // 합배송 최대 수량
}

/**
 * Shipping information extracted by AI
 */
export interface ShippingExtracted {
  shippingFee: number | null       // 배송비 금액 (null이면 정보 없음)
  shippingInfo: string | null      // 배송 관련 원문 정보
  bundleMaxQty: number | null      // 합배송 최대 수량 (null이면 합배송 불가)
}

/**
 * Wholesale-specific information
 */
export interface WholesaleInfo {
  origin?: string | null           // 원산지 (예: "국내산", "구룡포")
  orderDeadline?: string | null    // 발주마감 정보 (예: "오후 2시")
  deliveryCompany?: string | null  // 택배사 (예: "롯데택배", "대한통운")
}

/**
 * Generated variant from option combinations
 */
export interface GeneratedVariant {
  optionSummary: string                    // "색상:빨강, 사이즈:L"
  options: Record<string, string>          // { "색상": "빨강", "사이즈": "L" }
  wholesalePrice?: number                  // 도매가
  price?: number                           // 판매가
  bundleUnit?: number                      // 합배송 단위 수 (예: 2박스 옵션이면 2)
}

/**
 * Complete product draft generated from post
 */
export interface ProductDraft {
  // Basic Info
  name: string
  description: string
  categoryId?: string

  // Images
  thumbnailUrl?: string  // First image URL from post

  // Pricing
  currency: string
  wholesalePrice?: number // 도매가 (wholesale price)
  price?: number         // 판매가 (selling price)

  // Shipping
  shippingFee?: number       // 배송비 금액
  shippingInfo?: string      // 배송 관련 원문 정보
  bundleMaxQty?: number      // 합배송 최대 수량

  // Options & Variants
  options: OptionGroup[]
  variants: GeneratedVariant[]
}

/**
 * AI Analysis Result
 */
export interface AiProductAnalysis {
  // Extracted product info
  productName: string
  description: string
  category?: string

  // Extracted options
  options: OptionGroup[]

  // AI가 직접 추출한 variants (옵션별 가격이 다른 경우)
  variants?: GeneratedVariant[]

  // Pricing information
  pricing: {
    basePrice?: number       // 도매가 (가장 낮은 옵션 가격)
    sellingPrice?: number    // 판매가 (정책 적용된 가격)
    price?: number           // Legacy: 판매가 (deprecated, use sellingPrice)
    currency?: string
    optionPrices?: OptionPrice[]  // 옵션별 개별 가격
    priceRange?: {
      min: number
      max: number
    }
  }

  // Shipping information (extracted by AI)
  shipping?: ShippingExtracted

  // Wholesale-specific information
  wholesale?: WholesaleInfo

  // Confidence scores (optional)
  confidence?: {
    overall: number
    productName: number
    options: number
    pricing: number
  }

  // Raw AI response for debugging
  rawResponse?: string
}

// =============================================
// ERROR TYPES
// =============================================

/**
 * 에러 타입 분류
 * - TRANSIENT: 일시적 에러 (quota, rate limit, timeout) - 재시도 가능
 * - PERMANENT: 영구적 에러 (invalid API key, content blocked) - 재시도 불가
 */
export enum TransformationErrorType {
  TRANSIENT = 'TRANSIENT',
  PERMANENT = 'PERMANENT',
}

export class ProductTransformationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public errorType: TransformationErrorType = TransformationErrorType.PERMANENT
  ) {
    super(message)
    this.name = 'ProductTransformationError'
  }

  /**
   * 일시적 에러인지 확인 (재시도 가능 여부)
   */
  isTransient(): boolean {
    return this.errorType === TransformationErrorType.TRANSIENT
  }
}

export enum TransformationErrorCode {
  AI_API_ERROR = 'AI_API_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  PARSING_ERROR = 'PARSING_ERROR',
  NO_PRODUCT_FOUND = 'NO_PRODUCT_FOUND',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
}
