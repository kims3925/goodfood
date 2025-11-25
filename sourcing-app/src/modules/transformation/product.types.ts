/**
 * Product Transformation Types
 *
 * This file defines all TypeScript interfaces and types for product transformation
 */

import { Post, PostImage, AiProvider } from '@prisma/client'

// =============================================
// INPUT TYPES
// =============================================

/**
 * Input data for product transformation
 */
export interface ProductTransformationInput {
  post: Post & {
    images: PostImage[]
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
  groupName: string  // e.g., "색상", "사이즈"
  values: string[]   // e.g., ["빨강", "파랑"], ["S", "M", "L"]
}

/**
 * Generated variant from option combinations
 */
export interface GeneratedVariant {
  optionSummary: string                    // "색상:빨강, 사이즈:L"
  options: Record<string, string>          // { "색상": "빨강", "사이즈": "L" }
  price?: number                           // Optional price (판매가)
  wholesalePrice?: number                  // Optional wholesale price (도매가)
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
  wholesalePrice?: number // 도매가 (wholesale price)

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
    price?: number         // 판매가 (selling price)
    wholesalePrice?: number // 도매가 (wholesale price)
    currency?: string
    priceRange?: {
      min: number
      max: number
    }
  }

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
