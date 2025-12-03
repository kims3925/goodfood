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
 * Generate AI prompt for product extraction (optimized for Korean wholesale band posts)
 */
function buildProductExtractionPrompt(input: ProductTransformationInput): string {
  const { post, policyContent } = input
  const imageCount = post.images?.length || 0

  // 정책 섹션 생성
  const policySection = policyContent
    ? `
# 가격 정책 (중요! 판매가 계산에 반드시 적용)
아래 정책을 참고하여 도매가(basePrice)에서 판매가(sellingPrice)를 계산해주세요.

${policyContent}

**판매가 계산 규칙:**
- basePrice: 게시물에서 추출한 원래 가격 (도매가)
- sellingPrice: 위 가격정책을 적용하여 계산한 최종 판매가
- 정책에 마진율, 마크업 등이 있으면 그에 따라 판매가 계산
- 옵션별 가격도 각각 정책 적용하여 sellingPrice 계산
`
    : ''

  return `당신은 한국 도매 커뮤니티(네이버 밴드) 게시물에서 상품 정보를 추출하는 전문가입니다.
밴드 도매 게시물은 특수한 형식을 가지고 있으며, 다음 규칙을 따라 정보를 추출해주세요.

# 밴드 도매 게시물 특성
1. **이모지 패턴**: 가격/상품/배송 정보 앞에 이모지 사용 (이모지는 무시하고 텍스트만 추출)
2. **가격 형식**: "30,000원", "₩30,000원", "➡️ 17,000원", "33,000원" 등 다양한 형식
3. **용량/크기 옵션**: "250~300g 소", "500g(250g×2팩포장)", "1.2kg(8미)" 등 무게/용량 기반
4. **배송 정보**: "배송비포함", "2세트이상 주문시 4천원씩 차감", "합배송 10팩"
5. **복수 옵션**: 한 게시물에 크기별/용량별 여러 상품-가격 조합 존재

# 게시물 정보
제목: ${post.title}

내용:
${post.content}

이미지: ${imageCount}개
${policySection}
# 추출 규칙

## 1. 상품명 (productName)
- 제목과 본문에서 핵심 상품명 추출
- 브랜드/등급/원산지 정보 포함 (예: "국내산 생물 참홍어 날개살 필렛", "암소한우1등급 꽃등심")
- 프로모션 문구 제외 ("초특가", "행사", "한정수량", "긴급", "공구" 등)
- 이모지 제거
- 품질 표현은 포함 (예: "파지", "파품", "특대")

## 2. 상품 설명 (description)
- 상품의 특징, 원산지, 품질 정보
- 구매 혜택, 배송 특이사항
- 150-300자 내외로 간결하게

## 3. 카테고리 (category)
- 수산물, 축산물, 농산물, 가공식품, 생활용품, 의류, 잡화 중 선택

## 4. 옵션 추출 (options)
도매 게시물의 옵션은 주로 **용량/크기** 기반입니다.

**단일 상품 (옵션 없음):**
"파지 반건조 오징어 1.2kg(8미) 30,000원" → options: []

**복수 옵션 (크기/용량별 가격 다름):**
\`\`\`
참홍어 필렛 250~300g 소 → 17,000원
참홍어 필렛 350~400g 중 → 21,500원
참홍어 필렛 450~500g 대 → 25,500원
\`\`\`
→ options: [{ "groupName": "용량", "values": ["소(250~300g)", "중(350~400g)", "대(450~500g)"] }]

**옵션명 형식**: "크기명(용량)" 또는 "용량(패키지구성)"
예: "소(250~300g)", "500g(250g×2팩)", "1.2kg(8미)"

## 5. 가격 추출 (pricing)
- **basePrice**: 게시물에서 추출한 원래 가격 (도매가). 단일 상품이면 그 가격, 복수 옵션이면 가장 낮은 가격
- **sellingPrice**: 가격정책이 있으면 정책 적용한 판매가, 없으면 basePrice와 동일
- **optionPrices**: 옵션별 가격이 다른 경우 각각 명시 (basePrice, sellingPrice 모두 포함)
- 가격에서 쉼표(,), 원(원), ₩, 화살표 등 모두 제거하고 숫자만 추출
- "30,000원" → 30000, "➡️ 17,000원" → 17000

## 6. 배송 정보 (shipping)
- **shippingIncluded**: "배송비포함", "배송비 포함" 문구가 있으면 true
- **bundleDiscount**: "2세트이상 4000원 차감", "3팩이상 3000원 할인" 등
- **maxBundle**: "합배송 10팩", "묶음 5개까지" 등에서 숫자 추출, "묶음무제한"이면 null

## 7. 도매 정보 (wholesale)
- **origin**: "국내산", "구룡포", "서해안", "원양" 등
- **orderDeadline**: "발주마감: 오후 2시", "마감 2시30분" 등
- **deliveryCompany**: "롯데택배", "대한통운", "우체국택배" 등

# 응답 형식
반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트나 설명은 포함하지 마세요.

\`\`\`json
{
  "productName": "상품명",
  "description": "상품 설명",
  "category": "카테고리",
  "options": [
    {
      "groupName": "옵션그룹명",
      "values": ["옵션값1", "옵션값2"]
    }
  ],
  "pricing": {
    "basePrice": 도매가_숫자,
    "sellingPrice": 판매가_숫자,
    "currency": "KRW",
    "optionPrices": [
      { "option": "옵션값1", "basePrice": 도매가1, "sellingPrice": 판매가1 },
      { "option": "옵션값2", "basePrice": 도매가2, "sellingPrice": 판매가2 }
    ]
  },
  "shipping": {
    "shippingIncluded": true,
    "bundleDiscount": "할인정보_또는_null",
    "maxBundle": 숫자_또는_null
  },
  "wholesale": {
    "origin": "원산지_또는_null",
    "orderDeadline": "발주마감_또는_null",
    "deliveryCompany": "택배사_또는_null"
  }
}
\`\`\`

# 예제

## 예제 1: 단일 상품
입력:
제목: 특대 파지 반건조오징어
내용: 파품(파지) 특대 반건조 오징어 1.2kg(8미) 내외 ㄴ₩30,000원
배송비포함 2세트이상 주문시 4천원씩 차감 묶음무제한
발주마감: 오후 2시30분 / 택배사: 롯데택배

출력:
{
  "productName": "구룡포 특대 파지 반건조오징어 1.2kg",
  "description": "구룡포 덕장에서 대량작업 후 준비된 파품(파지) 특대 반건조 오징어입니다. 1.2kg(8미) 내외 구성입니다.",
  "category": "수산물",
  "options": [],
  "pricing": {
    "basePrice": 30000,
    "sellingPrice": 30000,
    "currency": "KRW",
    "optionPrices": []
  },
  "shipping": {
    "shippingIncluded": true,
    "bundleDiscount": "2세트이상 4000원 차감",
    "maxBundle": null
  },
  "wholesale": {
    "origin": "구룡포",
    "orderDeadline": "오후 2시30분",
    "deliveryCompany": "롯데택배"
  }
}

## 예제 2: 복수 옵션 (크기별 가격 다름)
입력:
제목: 국내산 생물 참홍어 날개살 필렛
내용:
참홍어 날개살 필렛 한팩 250~300g 소 ➡️ 17,000원
참홍어 날개살 필렛 한팩 350~400g 중 ➡️ 21,500원
참홍어 날개살 필렛 한팩 450~500g 대 ➡️ 25,500원
배송비포함 2세트이상 주문시 4000원씩 차감 / 합배송 10팩

출력:
{
  "productName": "국내산 생물 참홍어 날개살 필렛",
  "description": "국내산 생물 참홍어 날개살을 필렛으로 손질한 상품입니다. 소/중/대 3가지 사이즈로 선택 가능합니다.",
  "category": "수산물",
  "options": [
    {
      "groupName": "용량",
      "values": ["소(250~300g)", "중(350~400g)", "대(450~500g)"]
    }
  ],
  "pricing": {
    "basePrice": 17000,
    "sellingPrice": 17000,
    "currency": "KRW",
    "optionPrices": [
      { "option": "소(250~300g)", "basePrice": 17000, "sellingPrice": 17000 },
      { "option": "중(350~400g)", "basePrice": 21500, "sellingPrice": 21500 },
      { "option": "대(450~500g)", "basePrice": 25500, "sellingPrice": 25500 }
    ]
  },
  "shipping": {
    "shippingIncluded": true,
    "bundleDiscount": "2세트이상 4000원 차감",
    "maxBundle": 10
  },
  "wholesale": {
    "origin": "국내산",
    "orderDeadline": null,
    "deliveryCompany": null
  }
}

# 중요 주의사항
- JSON 형식을 엄격히 준수하세요
- 가격은 반드시 숫자만 (쉼표, ₩, 원, 화살표 제외)
- 정보가 없는 필드는 null로 설정
- 옵션이 없으면 options: [], optionPrices: []
- 이모지는 모두 무시하고 텍스트만 추출
- 옵션별 가격이 다르면 반드시 optionPrices에 각각 명시
- **가격정책이 제공된 경우 반드시 sellingPrice에 정책 적용된 판매가 계산**
- 가격정책이 없으면 sellingPrice = basePrice (동일하게)`
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

    // Calculate priceRange if optionPrices exist
    let priceRange = undefined
    const optionPrices: OptionPrice[] = parsed.pricing?.optionPrices || []
    if (optionPrices.length > 0) {
      const prices = optionPrices.map((op: OptionPrice) => op.price).filter((p): p is number => typeof p === 'number')
      if (prices.length > 0) {
        priceRange = {
          min: Math.min(...prices),
          max: Math.max(...prices)
        }
      }
    }

    // Determine base price (도매가)
    const basePrice = parsed.pricing?.basePrice ||
                      (priceRange?.min) ||
                      parsed.pricing?.price

    // Determine selling price (판매가 - 정책 적용된 가격)
    const sellingPrice = parsed.pricing?.sellingPrice ||
                         parsed.pricing?.price ||
                         basePrice

    // Build analysis result with new fields
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
        optionPrices: optionPrices,
        priceRange: priceRange,
      },
      // New wholesale fields
      shipping: parsed.shipping ? {
        shippingIncluded: parsed.shipping.shippingIncluded ?? false,
        bundleDiscount: parsed.shipping.bundleDiscount || null,
        maxBundle: parsed.shipping.maxBundle || null,
      } : undefined,
      wholesale: parsed.wholesale ? {
        origin: parsed.wholesale.origin || null,
        orderDeadline: parsed.wholesale.orderDeadline || null,
        deliveryCompany: parsed.wholesale.deliveryCompany || null,
      } : undefined,
      rawResponse: aiResponse.content,
    }

    console.log('✅ 파싱 완료:', {
      productName: analysis.productName,
      optionsCount: analysis.options.length,
      basePrice: analysis.pricing.basePrice,
      optionPricesCount: analysis.pricing.optionPrices?.length || 0,
      hasShipping: !!analysis.shipping,
      hasWholesale: !!analysis.wholesale,
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
