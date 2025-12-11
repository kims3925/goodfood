/**
 * Product Transformation Module
 *
 * This module provides reusable logic for transforming posts into products using AI.
 *
 * @example Basic Usage
 * ```typescript
 * import { transformPostToProduct } from '@/modules/transformation'
 * import { AiProvider } from '@bandauto/db'
 *
 * const draft = await transformPostToProduct({
 *   post: myPost,
 *   aiProvider: AiProvider.GEMINI,
 *   aiConfig: {
 *     apiKey: process.env.GEMINI_API_KEY,
 *     model: 'gemini-2.5-flash',
 *   },
 * })
 *
 * console.log(draft.name, draft.description, draft.variants)
 * ```
 *
 * @example Variant Generation
 * ```typescript
 * import { generateVariants, calculateVariantCount } from '@/modules/transformation'
 *
 * const options = [
 *   { groupName: "색상", values: ["빨강", "파랑"] },
 *   { groupName: "사이즈", values: ["S", "M", "L"] }
 * ]
 *
 * const count = calculateVariantCount(options) // 6
 * const variants = generateVariants(options)
 * ```
 */

// Main transformation function
export { transformPostToProduct } from './product.transformer'

// Variant generation utilities
export {
  generateVariants,
  formatOptionSummary,
  parseOptionSummary,
  validateOptionGroups,
  calculateVariantCount,
} from './variant.generator'

// AI client
export { createAiClient, type BaseAiClient } from './ai.client'

// Types
export type {
  ProductTransformationInput,
  ProductDraft,
  AiProductAnalysis,
  OptionGroup,
  GeneratedVariant,
} from './product.types'

export {
  ProductTransformationError,
  TransformationErrorCode,
} from './product.types'
