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
} from './product.types'
import { createAiClient, AiResponse } from './ai.client'
import { generateVariants } from './variant.generator'

// =============================================
// PROMPT TEMPLATES
// =============================================

/**
 * Generate AI prompt for product extraction
 */
function buildProductExtractionPrompt(input: ProductTransformationInput): string {
  const { post } = input
  const imageCount = post.images?.length || 0

  return `당신은 온라인 쇼핑몰 상품 정보 추출 전문가입니다.
다음 게시물에서 상품 정보를 추출하여 JSON 형식으로 반환해주세요.

# 게시물 정보
제목: ${post.title}

내용:
${post.content}

이미지: ${imageCount}개

# 추출 규칙
1. **상품명**: 게시물에서 판매하는 상품의 이름을 추출합니다. 정확하고 간결하게 작성하세요.
2. **상품 설명**: 상품의 특징, 재질, 용도 등을 포함한 설명을 작성합니다 (200-500자).
3. **카테고리**: 상품이 속하는 카테고리를 추론합니다 (예: 의류, 전자제품, 식품, 가구 등).
4. **옵션**: 색상, 사이즈, 용량 등의 옵션이 있다면 추출합니다.
   - 옵션 그룹명과 옵션 값들을 명확히 구분하세요.
   - 예: { "groupName": "색상", "values": ["빨강", "파랑", "초록"] }
5. **가격**: 가격 정보가 있다면 추출합니다 (숫자만, 원화 기준).
   - 추출된 가격은 도매가(원가)로 간주합니다
   - wholesalePrice: 도매가 (원가)

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
    "wholesalePrice": 숫자,
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

    // Parse JSON
    const parsed = JSON.parse(jsonText)

    // Validate required fields
    if (!parsed.productName) {
      throw new Error('Product name is required')
    }

    // Build analysis result
    const analysis: AiProductAnalysis = {
      productName: parsed.productName,
      description: parsed.description || '',
      category: parsed.category || undefined,
      options: parsed.options || [],
      pricing: {
        price: undefined, // AI-extracted price is now wholesalePrice
        wholesalePrice: parsed.pricing?.wholesalePrice,
        currency: parsed.pricing?.currency || 'KRW',
      },
      rawResponse: aiResponse.content,
    }

    return analysis
  } catch (error: any) {
    throw new ProductTransformationError(
      `Failed to parse AI response: ${error.message}`,
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
 * Generate product draft from AI analysis
 */
function buildProductDraft(
  analysis: AiProductAnalysis,
  input: ProductTransformationInput
): ProductDraft {
  const { post } = input

  // Get thumbnail from first image
  const thumbnailUrl = post.images?.[0]?.imageUrl || null

  // Generate variants from options
  const variants = analysis.options.length > 0
    ? generateVariants(analysis.options)
    : []

  // If variants exist, set their wholesale prices
  if (variants.length > 0 && analysis.pricing.wholesalePrice) {
    variants.forEach((variant) => {
      variant.price = undefined // User will set selling price later
      variant.wholesalePrice = analysis.pricing.wholesalePrice
      variant.stock = 0 // Default stock
    })
  }

  // Build product draft
  const draft: ProductDraft = {
    name: analysis.productName,
    description: analysis.description,
    categoryId: analysis.category,
    thumbnailUrl: thumbnailUrl || undefined,
    currency: analysis.pricing.currency || 'KRW',
    price: undefined, // User will set selling price later
    wholesalePrice: analysis.pricing.wholesalePrice,
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
 *   post: await prisma.post.findUnique({
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
