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
  GeneratedVariant,
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
   - 도매가(wholesalePrice): 공급가, 도매가
   - 판매가(price): 소비자 판매 가격 (없으면 도매가와 동일)`

  return `당신은 한국 도매 쇼핑몰 상품 정보 추출 전문가입니다.

# 게시물
제목: ${post.title}
내용: ${post.content || ''}
${policySection}
# 추출 규칙

## 1. 상품명
원산지/지역 + 품질키워드 + 상품명 조합
- 수산물: "싱싱한 통영산 활돌문어", "당일조업 고흥 활 산낙지"
- 농산물: "꿀달수 무안 황토 고구마", "햇 충주 국내산 참깨"
- 가공식품: "30년전통 울산 수제 치즈설기", "50년전통 부산 프리미엄 꼬치어묵"

## 2. 설명 (200-500자)
게시물에서 상품 특징, 효능, 맛 설명 부분을 추출하여 작성

## 3. 카테고리
수산물, 농산물, 가공식품, 장류, 음료/차, 절임류

## 4. 옵션/variants 추출 (핵심!)
가격이 다른 상품 구성을 찾아 추출:

**가격 패턴 인식:**
- "➡️ 공급가 18,500원", "⏩⏩ 39,000원"
- "₩12,900원", "￦19,900원", "1키로: 35,000원"

**옵션 유형:**
- 수량: 5미, 10미, 20마리
- 중량: 500g, 1kg, 2키로, 반말(3키로), 한말(6키로)
- 크기: 소짜/세발/얼치기/소/중/대 (낙지), 소/중/대/특 (농산물)
- 구성: A세트, B세트, 단품, 야채세트
- 팩: 1팩, 2팩, 30팩, 50팩

${pricingRule}

# 예시1 - 수산물(낙지)
입력: "세발낙지 10마리 48,000원 (5미 29,000원)
얼치기 10마리 55,000원 (5미 32,500원)
소낙지 10마리 70,000원"

출력:
{
  "productName": "싱싱한 서해안 국내산 활낙지 (세발/얼치기/소)",
  "description": "무안 신안 등 서해안에서 조업된 100% 국내산 뻘낙지입니다. 보들보들한 식감으로 연포탕, 탕탕이, 볶음에 최고! 산소포장으로 신선하게 배송됩니다.",
  "category": "수산물",
  "options": [{ "groupName": "규격", "values": ["세발낙지 10미", "세발낙지 5미", "얼치기 10미", "얼치기 5미", "소낙지 10미"] }],
  "pricing": { "wholesalePrice": 29000, "price": 29000, "currency": "KRW" },
  "variants": [
    { "optionSummary": "세발낙지 10미", "wholesalePrice": 48000, "price": 48000 },
    { "optionSummary": "세발낙지 5미", "wholesalePrice": 29000, "price": 29000 },
    { "optionSummary": "얼치기 10미", "wholesalePrice": 55000, "price": 55000 },
    { "optionSummary": "얼치기 5미", "wholesalePrice": 32500, "price": 32500 },
    { "optionSummary": "소낙지 10미", "wholesalePrice": 70000, "price": 70000 }
  ]
}

# 예시2 - 가공식품(떡/호빵)
입력: "통팥 호빵 1팩 4,900원
야채 호빵 1팩 5,800원
통팥 2팩+야채 1팩 14,900원"

출력:
{
  "productName": "26년전통 국산재료 통팥/야채 쌀호빵",
  "description": "국내산 야채와 통팥으로 속을 가득 채운 수제 호빵입니다. 전자레인지나 찜기에 쪄먹으면 겨울 대표 간식으로 최고!",
  "category": "가공식품",
  "options": [{ "groupName": "구성", "values": ["통팥 1팩", "야채 1팩", "통팥2+야채1"] }],
  "pricing": { "wholesalePrice": 4900, "price": 4900, "currency": "KRW" },
  "variants": [
    { "optionSummary": "통팥 1팩", "wholesalePrice": 4900, "price": 4900 },
    { "optionSummary": "야채 1팩", "wholesalePrice": 5800, "price": 5800 },
    { "optionSummary": "통팥2+야채1", "wholesalePrice": 14900, "price": 14900 }
  ]
}

# 예시3 - 농산물(단일규격)
입력: "무안달수 상중 10키로 39,000원"

출력:
{
  "productName": "꿀달수 무안 황토 고구마 (베니하루카)",
  "description": "유기농이라 껍질째 먹는 꿀고구마입니다. 무안현경면에서 재배한 달달한 고구마로 재주문 200%! 믿고 찾는 황토 달수고구마입니다.",
  "category": "농산물",
  "options": [{ "groupName": "규격", "values": ["상중 10키로"] }],
  "pricing": { "wholesalePrice": 39000, "price": 39000, "currency": "KRW" },
  "variants": [
    { "optionSummary": "상중 10키로", "wholesalePrice": 39000, "price": 39000 }
  ]
}

# 6. 배송비 정보 추출
게시물에서 배송비 관련 정보를 찾아 추출합니다:
- "택배비 포함", "배송비 별도", "무료배송" 등의 패턴
- "배송비 3,000원", "택배비 4,000원" 등 구체적인 금액
- "2박스 이상 무료배송", "합배송 가능" 등 조건부 배송 정보

# 응답 형식
\`\`\`json
{
  "productName": "상품명",
  "description": "설명 (200-500자, 필수)",
  "category": "카테고리",
  "options": [{ "groupName": "규격", "values": ["값1", "값2"] }],
  "pricing": { "wholesalePrice": 숫자, "price": 숫자, "currency": "KRW" },
  "variants": [{ "optionSummary": "값1", "wholesalePrice": 숫자, "price": 숫자 }],
  "shipping": { "shippingFee": 숫자또는null, "shippingInfo": "배송관련원문정보" }
}
\`\`\`

# 주의사항
- JSON만 응답
- 가격은 숫자만 (18500)
- 배송비는 shipping 객체에 별도로 추출 (shippingFee: 배송비 금액, shippingInfo: 배송 관련 원문 정보)
- 단일 규격이어도 반드시 options, variants 배열에 포함 (빈 배열 금지)
- 설명은 반드시 작성 (빈 문자열 금지)`
}

// =============================================
// AI RESPONSE PARSING
// =============================================

/**
 * Parse AI-extracted variants from raw response
 * Returns only variants with at least one price (wholesalePrice or price)
 */
function parseAiVariants(rawVariants: any[]): GeneratedVariant[] {
  if (!rawVariants || !Array.isArray(rawVariants)) return []

  return rawVariants
    .filter(v => v && (v.wholesalePrice !== undefined || v.price !== undefined))
    .map(v => ({
      optionSummary: v.optionSummary || '',
      options: v.options || {},
      wholesalePrice: typeof v.wholesalePrice === 'number' ? v.wholesalePrice : undefined,
      price: typeof v.price === 'number' ? v.price : undefined,
    }))
}

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

  // 1. Remove incomplete string at the end (truncated mid-string)
  // Find the last complete JSON structure
  let lastValidIndex = jsonText.length - 1

  // Check if we're in an unclosed string
  let inString = false
  let escapeNext = false
  let lastStringStart = -1

  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i]
    if (escapeNext) {
      escapeNext = false
      continue
    }
    if (char === '\\') {
      escapeNext = true
      continue
    }
    if (char === '"') {
      if (!inString) {
        lastStringStart = i
      }
      inString = !inString
    }
  }

  // If still in string, truncate to before the string started
  if (inString && lastStringStart > 0) {
    // Find the comma or bracket before the incomplete string
    let cutPoint = lastStringStart
    while (cutPoint > 0 && jsonText[cutPoint - 1] !== ',' && jsonText[cutPoint - 1] !== '[' && jsonText[cutPoint - 1] !== '{') {
      cutPoint--
    }
    if (cutPoint > 0) {
      jsonText = jsonText.substring(0, cutPoint).trim()
    }
  }

  // 2. Remove trailing incomplete objects/arrays
  // Pattern: incomplete object like { "key": "value", "key2":
  jsonText = jsonText.replace(/,?\s*"[^"]*":\s*("[^"]*)?$/m, '')
  jsonText = jsonText.replace(/,?\s*"[^"]*":\s*\d*$/m, '')
  jsonText = jsonText.replace(/,?\s*"[^"]*":\s*$/m, '')

  // 3. Remove trailing comma
  jsonText = jsonText.replace(/,\s*$/, '')

  // 4. Count and close open brackets/braces
  let openBraces = 0
  let openBrackets = 0
  inString = false
  escapeNext = false

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

  // 5. Close open structures
  for (let i = 0; i < openBrackets; i++) {
    jsonText += ']'
  }
  for (let i = 0; i < openBraces; i++) {
    jsonText += '}'
  }

  // 6. Final attempt to parse and validate
  try {
    JSON.parse(jsonText)
    console.log('🔧 JSON 복구 완료')
  } catch (e) {
    console.log('🔧 JSON 복구 시도 (일부 데이터 손실 가능)')
  }

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

    // AI가 직접 추출한 variants 파싱
    const aiVariants = parseAiVariants(parsed.variants)

    // 배송비 정보 파싱
    const shippingFee = typeof parsed.shipping?.shippingFee === 'number'
      ? parsed.shipping.shippingFee
      : null
    const shippingInfo = typeof parsed.shipping?.shippingInfo === 'string'
      ? parsed.shipping.shippingInfo
      : null

    // Build analysis result
    const analysis: AiProductAnalysis = {
      productName: parsed.productName,
      description: parsed.description || '',
      category: parsed.category || undefined,
      options: parsed.options || [],
      variants: aiVariants,
      pricing: {
        basePrice: basePrice,
        sellingPrice: sellingPrice,
        price: sellingPrice, // Legacy compatibility
        currency: parsed.pricing?.currency || 'KRW',
        optionPrices: [],
        priceRange: undefined,
      },
      shipping: {
        shippingFee,
        shippingInfo,
      },
      rawResponse: aiResponse.content,
    }

    console.log('✅ 파싱 완료:', {
      productName: analysis.productName,
      optionsCount: analysis.options.length,
      aiVariantsCount: aiVariants.length,
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

  // Determine selling price (정책 적용된 판매가 우선, 없으면 basePrice)
  const sellingPrice = analysis.pricing.sellingPrice ||
                       analysis.pricing.basePrice ||
                       analysis.pricing.price

  console.log('💰 가격 정책 적용:', {
    basePrice: analysis.pricing.basePrice,
    sellingPrice: analysis.pricing.sellingPrice,
    finalPrice: sellingPrice,
  })

  // Determine variants: AI-extracted vs Cartesian product generation
  let variants: GeneratedVariant[]

  if (analysis.variants && analysis.variants.length > 0) {
    // Case 1: AI가 직접 추출한 variants 사용 (도매가 + 판매가)
    console.log('🤖 AI가 추출한 variants 사용:', analysis.variants.length, '개')

    variants = analysis.variants.map(v => ({
      optionSummary: v.optionSummary,
      options: v.options,
      wholesalePrice: v.wholesalePrice,
      price: v.price || v.wholesalePrice || sellingPrice,
    }))

    console.log('📦 AI Variants:', variants.map(v => ({
      summary: v.optionSummary,
      wholesalePrice: v.wholesalePrice,
      price: v.price,
    })))

  } else if (analysis.options.length > 0) {
    // Case 2: 옵션 조합으로 variants 자동 생성 (기존 로직)
    console.log('📦 옵션 조합으로 variants 자동 생성')

    variants = generateVariants(analysis.options)
    const optionPrices = analysis.pricing.optionPrices || []

    variants = variants.map((variant) => {
      const optionPrice = findOptionPriceForVariant(variant, optionPrices)
      return {
        ...variant,
        price: optionPrice || sellingPrice,
      }
    })

    console.log('📦 Generated Variants:', variants.map(v => ({
      summary: v.optionSummary,
      price: v.price,
    })))

  } else {
    // Case 3: 옵션 없음
    variants = []
  }

  // Build product draft
  const draft: ProductDraft = {
    name: analysis.productName,
    description: analysis.description,
    categoryId: analysis.category,
    thumbnailUrl: thumbnailUrl || undefined,
    currency: analysis.pricing.currency || 'KRW',
    wholesalePrice: analysis.pricing.basePrice, // 도매가 (원가)
    price: sellingPrice, // 판매가 (정책 적용된 가격)
    shippingFee: analysis.shipping?.shippingFee ?? undefined,
    shippingInfo: analysis.shipping?.shippingInfo ?? undefined,
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
