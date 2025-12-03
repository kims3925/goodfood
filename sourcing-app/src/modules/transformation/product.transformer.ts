/**
 * Product Transformer
 *
 * Main transformation logic for converting posts to product drafts using AI
 */

import {
  ProductTransformationInput,
  ProductDraft,
  AiProductAnalysis,
  ProductTransformationError,
  TransformationErrorCode,
  OptionGroup,
  OptionPrice,
} from './product.types'
import { createAiClient, AiResponse } from './ai.client'
import { generateVariants } from './variant.generator'

// =============================================
// PROMPT TEMPLATES
// =============================================

/**
 * Generate AI prompt for product extraction (simplified version)
 */
function buildProductExtractionPrompt(input: ProductTransformationInput): string {
  const { post, policyContent } = input
  const imageCount = post.images?.length || 0

  // 정책 섹션 생성
  const policySection = policyContent
    ? `
# 가격 정책
${policyContent}
`
    : ''

  // 가격 추출 규칙
  const pricingRule = policyContent
    ? `5. **가격**: 도매가(wholesalePrice)와 판매가(price)를 추출합니다.
     - 도매가: 게시물에서 추출한 원래 가격
     - 판매가: 위 가격정책을 적용한 최종 가격`
    : `5. **가격**: 상품의 가격을 추출합니다.
     - 도매가(wholesalePrice): 도매 가격
     - 판매가(price): 소비자 판매 가격 (없으면 도매가와 동일)`

  return `당신은 온라인 쇼핑몰 상품 정보 추출 전문가입니다.
다음 게시물에서 상품 정보를 추출하여 JSON 형식으로 반환해주세요.

# 게시물 정보
제목: ${post.title}

내용:
${post.content || ''}

이미지: ${imageCount}개
${policySection}
# 추출 규칙
1. **상품명**: 게시물에서 판매하는 상품의 이름을 추출합니다. 정확하고 간결하게 작성하세요.
2. **상품 설명**: 상품의 특징, 재질, 용도 등을 포함한 설명을 작성합니다 (200-500자).
3. **카테고리**: 상품이 속하는 카테고리를 추론합니다 (예: 의류, 전자제품, 식품, 가구 등).
4. **옵션**: 색상, 사이즈, 용량 등의 옵션이 있다면 추출합니다.
   - 옵션 그룹명과 옵션 값들을 명확히 구분하세요.
   - 예: { "groupName": "색상", "values": ["빨강", "파랑", "초록"] }
${pricingRule}

# 응답 형식
반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "productName": "상품명",
  "description": "상품 설명",
  "category": "카테고리",
  "options": [
    {
      "groupName": "옵션그룹명",
      "values": ["값1", "값2", "값3"]
    }
  ],
  "pricing": {
    "wholesalePrice": 도매가_숫자,
    "price": 판매가_숫자,
    "currency": "KRW"
  }
}
\`\`\`

# 주의사항
- JSON 형식을 엄격히 준수하세요.
- 가격은 숫자만 입력하세요 (쉼표, 원화 기호 제외).
- 정보가 없는 필드는 null로 설정하세요.
- 옵션이 없으면 빈 배열 []로 설정하세요.`
}

// =============================================
// AI RESPONSE PARSING
// =============================================

/**
 * Attempt to repair truncated JSON by closing open brackets/braces
 */
function repairTruncatedJson(jsonText: string): string {
  // First, try parsing as-is
  try {
    JSON.parse(jsonText)
    return jsonText // Already valid
  } catch {
    // Continue with repair
  }

  console.log('🔧 JSON 복구 시도 중...')

  // Remove trailing comma if present
  jsonText = jsonText.replace(/,\s*$/, '')

  // Count open brackets and braces
  let openBraces = 0
  let openBrackets = 0
  let inString = false
  let escapeNext = false

  for (const char of jsonText) {
    if (escapeNext) {
      escapeNext = false
      continue
    }
    if (char === '\\') {
      escapeNext = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === '{') openBraces++
    else if (char === '}') openBraces--
    else if (char === '[') openBrackets++
    else if (char === ']') openBrackets--
  }

  // Close any unclosed string (if we're still in a string)
  if (inString) {
    jsonText += '"'
  }

  // Remove incomplete key-value pair at the end
  // Pattern: "key": or "key": "incomplete or "key": 123
  jsonText = jsonText.replace(/,?\s*"[^"]*":\s*("[^"]*)?$/m, '')
  jsonText = jsonText.replace(/,?\s*"[^"]*":\s*\d*$/m, '')

  // Close open brackets and braces
  for (let i = 0; i < openBrackets; i++) {
    jsonText += ']'
  }
  for (let i = 0; i < openBraces; i++) {
    jsonText += '}'
  }

  console.log('🔧 JSON 복구 완료')

  return jsonText
}

/**
 * Parse AI response to structured product analysis
 */
function parseAiResponse(aiResponse: AiResponse): AiProductAnalysis {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = aiResponse.content.trim()

    console.log('🔍 AI 원본 응답 (처음 500자):', jsonText.substring(0, 500))

    // Remove markdown code blocks if present (handle various formats)
    // 1. Try ```json ... ``` format with greedy matching
    let jsonMatch = jsonText.match(/```(?:json|JSON)?\s*([\s\S]*)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim()
      console.log('✅ 코드블록 추출 성공 (방법 1)')
    }

    // 2. If still starts with ```, try to extract content after it (no closing ```)
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json|JSON)?\s*\n?/, '').trim()
      // Remove trailing ``` if exists
      jsonText = jsonText.replace(/\n?\s*```\s*$/, '').trim()
      console.log('✅ 코드블록 제거 (방법 2)')
    }

    // 3. If doesn't start with {, try to find JSON object in the text
    if (!jsonText.startsWith('{')) {
      // Find the first { and last } to extract JSON
      const firstBrace = jsonText.indexOf('{')
      const lastBrace = jsonText.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonText = jsonText.substring(firstBrace, lastBrace + 1)
        console.log('✅ JSON 객체 직접 추출 (방법 3)')
      }
    }

    console.log('🔍 파싱할 JSON (처음 500자):', jsonText.substring(0, 500))

    // Try to repair truncated JSON
    jsonText = repairTruncatedJson(jsonText)

    // Parse JSON
    const parsed = JSON.parse(jsonText)

    // Validate required fields
    if (!parsed.productName) {
      throw new Error('Product name is required')
    }

    // 간단한 형식: wholesalePrice, price 사용
    // 도매가 (wholesalePrice 또는 basePrice)
    const basePrice = parsed.pricing?.wholesalePrice ||
                      parsed.pricing?.basePrice ||
                      parsed.pricing?.price

    // 판매가 (price 또는 sellingPrice)
    const sellingPrice = parsed.pricing?.price ||
                         parsed.pricing?.sellingPrice ||
                         basePrice

    // Build analysis result
    const analysis: AiProductAnalysis = {
      productName: parsed.productName,
      description: parsed.description || '',
      category: parsed.category || undefined,
      options: parsed.options || [],
      pricing: {
        basePrice: basePrice,
        sellingPrice: sellingPrice,
        price: sellingPrice, // Legacy compatibility
        currency: parsed.pricing?.currency || 'KRW',
        optionPrices: [],
        priceRange: undefined,
      },
      rawResponse: aiResponse.content,
    }

    console.log('✅ 파싱 완료:', {
      productName: analysis.productName,
      optionsCount: analysis.options.length,
      basePrice: analysis.pricing.basePrice,
      sellingPrice: analysis.pricing.sellingPrice,
    })

    return analysis
  } catch (error: any) {
    throw new ProductTransformationError(
      'AI 응답을 분석할 수 없습니다. 게시물 내용이 상품 정보로 변환하기 어려운 형식일 수 있습니다.',
      TransformationErrorCode.PARSING_ERROR,
      {
        originalError: error,
        rawResponse: aiResponse.content,
      }
    )
  }
}

// =============================================
// PRODUCT DRAFT GENERATION
// =============================================

/**
 * Find matching option price for a variant
 * Returns sellingPrice (정책 적용된 판매가) if available, otherwise basePrice or price
 */
function findOptionPriceForVariant(
  variant: { optionSummary: string; options: Record<string, string> },
  optionPrices: OptionPrice[]
): number | undefined {
  if (!optionPrices || optionPrices.length === 0) {
    return undefined
  }

  // Get the first option value (usually 용량 for wholesale products)
  const optionValues = Object.values(variant.options)

  for (const optionValue of optionValues) {
    // Try exact match first
    const exactMatch = optionPrices.find(op => op.option === optionValue)
    if (exactMatch) {
      // sellingPrice 우선, 없으면 basePrice, 그것도 없으면 price (legacy)
      return exactMatch.sellingPrice ?? exactMatch.basePrice ?? exactMatch.price
    }

    // Try partial match (option value contains or is contained in optionPrice.option)
    const partialMatch = optionPrices.find(op =>
      op.option.includes(optionValue) || optionValue.includes(op.option)
    )
    if (partialMatch) {
      return partialMatch.sellingPrice ?? partialMatch.basePrice ?? partialMatch.price
    }

    // Try matching by extracting key parts (e.g., "소", "중", "대" from "소(250~300g)")
    const sizeKeywords = ['소', '중', '대', 'S', 'M', 'L', 'XL']
    for (const keyword of sizeKeywords) {
      if (optionValue.includes(keyword)) {
        const keywordMatch = optionPrices.find(op => op.option.includes(keyword))
        if (keywordMatch) {
          return keywordMatch.sellingPrice ?? keywordMatch.basePrice ?? keywordMatch.price
        }
      }
    }
  }

  return undefined
}

/**
 * Generate product draft from AI analysis
 */
function buildProductDraft(
  analysis: AiProductAnalysis,
  input: ProductTransformationInput
): ProductDraft {
  const { post } = input

  // Get thumbnail from first image
  const thumbnailUrl = post.images?.[0]?.url || null

  // Generate variants from options
  let variants = analysis.options.length > 0
    ? generateVariants(analysis.options)
    : []

  // Determine selling price (정책 적용된 판매가 우선, 없으면 basePrice)
  const sellingPrice = analysis.pricing.sellingPrice ||
                       analysis.pricing.basePrice ||
                       analysis.pricing.price

  console.log('💰 가격 정책 적용:', {
    basePrice: analysis.pricing.basePrice,
    sellingPrice: analysis.pricing.sellingPrice,
    finalPrice: sellingPrice,
  })

  // If variants exist, set their prices (with option-specific pricing support)
  if (variants.length > 0) {
    const optionPrices = analysis.pricing.optionPrices || []

    variants = variants.map((variant) => {
      // Try to find option-specific selling price (정책 적용된 가격)
      const optionPrice = findOptionPriceForVariant(variant, optionPrices)

      return {
        ...variant,
        price: optionPrice || sellingPrice, // Use option selling price if available, else base selling price
        stock: 0, // Default stock
      }
    })

    console.log('📦 Variants 생성 (판매가 적용):', variants.map(v => ({
      summary: v.optionSummary,
      price: v.price
    })))
  }

  // Build product draft
  const draft: ProductDraft = {
    name: analysis.productName,
    description: analysis.description,
    categoryId: analysis.category,
    thumbnailUrl: thumbnailUrl || undefined,
    currency: analysis.pricing.currency || 'KRW',
    price: sellingPrice, // 판매가 (정책 적용된 가격)
    options: analysis.options,
    variants,
  }

  return draft
}

// =============================================
// MAIN TRANSFORMATION FUNCTION
// =============================================

/**
 * Transform post to product draft using AI
 *
 * @param input - Transformation input with post and AI config
 * @returns Product draft ready for user review
 *
 * @example
 * ```typescript
 * const input = {
 *   post: await prisma.collectedPost.findUnique({
 *     where: { id: postId },
 *     include: { images: true },
 *   }),
 *   aiProvider: AiProvider.GEMINI,
 *   aiConfig: {
 *     apiKey: 'your-api-key',
 *     model: 'gemini-2.5-flash',
 *   },
 * }
 *
 * const draft = await transformPostToProduct(input)
 * // draft: { name, description, options, variants, ... }
 * ```
 */
export async function transformPostToProduct(
  input: ProductTransformationInput
): Promise<ProductDraft> {
  // Validate input
  if (!input.post) {
    throw new ProductTransformationError(
      'Post is required',
      TransformationErrorCode.INVALID_INPUT
    )
  }

  if (!input.post.title && !input.post.content) {
    throw new ProductTransformationError(
      'Post must have either title or content',
      TransformationErrorCode.INVALID_INPUT
    )
  }

  // Create AI client
  const aiClient = createAiClient({
    provider: input.aiProvider,
    apiKey: input.aiConfig.apiKey,
    model: input.aiConfig.model,
    temperature: input.aiConfig.temperature,
    maxTokens: input.aiConfig.maxTokens,
  })

  // Generate prompt
  const prompt = buildProductExtractionPrompt(input)

  // Call AI
  const aiResponse = await aiClient.generateContent(prompt)

  // Parse response
  const analysis = parseAiResponse(aiResponse)

  // Build product draft
  const draft = buildProductDraft(analysis, input)

  return draft
}

// =============================================
// EXPORT
// =============================================

export { buildProductExtractionPrompt, parseAiResponse, buildProductDraft }
