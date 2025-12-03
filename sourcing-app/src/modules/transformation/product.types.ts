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
 * Shipping information for wholesale products
 */
export interface ShippingInfo {
  shippingIncluded: boolean        // 배송비 포함 여부
  bundleDiscount?: string | null   // 묶음 할인 정보 (예: "2세트이상 4000원 차감")
  maxBundle?: number | null        // 합배송 최대 수량
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
  price?: number                           // Optional price (판매가)
  stock?: number                           // Optional stock
  sku?: string                             // Optional SKU
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
  price?: number         // 판매가 (selling price)

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

  // Shipping information (wholesale)
  shipping?: ShippingInfo

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

export class ProductTransformationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ProductTransformationError'
  }
}

export enum TransformationErrorCode {
  AI_API_ERROR = 'AI_API_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  PARSING_ERROR = 'PARSING_ERROR',
  NO_PRODUCT_FOUND = 'NO_PRODUCT_FOUND',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
}
