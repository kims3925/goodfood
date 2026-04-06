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
import {
  EXTRACTION_RULES,
  SINGLE_RESPONSE_FORMAT,
  SINGLE_EXAMPLE,
  SINGLE_CHECKLIST,
  BATCH_RESPONSE_FORMAT,
  BATCH_CHECKLIST,
} from './prompt-templates'

// =============================================
// PROMPT TEMPLATES
// =============================================

/**
 * 프롬프트 변수 치환
 */
function replacePromptVariables(template: string, input: ProductTransformationInput): string {
  const { post, policyContent } = input

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
   ⚠️ 최우선 원칙: 위 "가격 정책"의 지시를 반드시 따르세요.
   - 가격 정책에서 "공급가"로 표시된 가격에만 마진을 적용하라고 했다면, "판매가"나 단순 "가격"으로 표시된 금액에는 마진을 적용하지 마세요.
   - 가격 정책에서 특정 조건(예: "공급가"라는 단어가 있을 때만 마진 적용)을 명시했다면 그 조건을 정확히 따르세요.
   - 도매가(wholesalePrice): 게시물에서 추출한 원본 가격
   - 판매가(price): 가격 정책의 규칙에 따라 계산된 최종 소매 판매가 (마진 적용 여부는 정책에 따름)`
    : `5. **가격**: 상품의 가격을 추출합니다.
   - 도매가(wholesalePrice): 게시물에서 추출한 가격
   - 판매가(price): 도매가와 동일 (가격정책 없음)`

  // 변수 치환
  return template
    .replace(/\{title\}/g, post.title || '')
    .replace(/\{content\}/g, post.content || '')
    .replace(/\{policySection\}/g, policySection)
    .replace(/\{pricingRule\}/g, pricingRule)
}

/**
 * Generate AI prompt for product extraction (simplified version)
 */
function buildProductExtractionPrompt(input: ProductTransformationInput): string {
  const { post, policyContent, customPrompt } = input
  const imageCount = post.images?.length || 0

  // 커스텀 프롬프트가 있으면 변수 치환 후 반환
  if (customPrompt) {
    console.log('📝 커스텀 프롬프트 사용 중')
    return replacePromptVariables(customPrompt, input)
  }

  // 기본 프롬프트 사용
  console.log('📝 기본 프롬프트 사용 중')

  // 정책 섹션 생성
  const policySection = policyContent
    ? `
# 가격 정책
${policyContent}
`
    : ''

  // 가격 추출 규칙
  const pricingRule = policyContent
    ? `## 가격 추출
도매가(wholesalePrice)와 판매가(price)를 추출합니다.

⚠️ 최우선 원칙: 위 "가격 정책"의 지시를 반드시 따르세요.
- 가격 정책에서 "공급가"로 표시된 가격에만 마진을 적용하라고 했다면, "판매가"나 단순 "가격"으로 표시된 금액에는 마진을 적용하지 마세요.
- 가격 정책에서 특정 조건을 명시했다면 그 조건을 정확히 따르세요.

추출 규칙:
- 도매가(wholesalePrice): 게시물에서 추출한 원본 가격
- 판매가(price): 가격 정책의 규칙에 따라 계산된 최종 소매 판매가 (마진 적용 여부는 정책에 따름)`
    : `## 가격 추출
상품의 가격을 추출합니다.

추출 규칙:
- 도매가(wholesalePrice): 게시물에서 추출한 가격
- 판매가(price): 도매가와 동일 (가격정책 없음)`

  return `당신은 한국 도매 쇼핑몰 상품 정보 추출 전문가입니다.

# 입력 데이터
제목: ${post.title}
내용: ${post.content || ''}
${policySection}

---

${EXTRACTION_RULES.replace('{pricingRule}', pricingRule)}

---

${SINGLE_RESPONSE_FORMAT}

---

${SINGLE_EXAMPLE}

---

${SINGLE_CHECKLIST}`
}

// =============================================
// AI RESPONSE PARSING
// =============================================

/**
 * 가격 값을 숫자로 안전하게 변환
 * 문자열 "48000", "48,000", "48000원" 등을 숫자로 변환
 */
function parsePrice(value: any): number | undefined {
  // 이미 숫자인 경우
  if (typeof value === 'number' && !isNaN(value) && value > 0) {
    return value
  }

  // 문자열인 경우 파싱 시도
  if (typeof value === 'string') {
    // 콤마, 원, ₩, 공백 등 제거 후 숫자 추출
    const cleaned = value.replace(/[,원₩￦\s]/g, '')
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed) && parsed > 0) {
      console.log(`💱 가격 문자열 변환: "${value}" -> ${parsed}`)
      return parsed
    }
  }

  return undefined
}

/**
 * 배송비/합배송 관련 값을 숫자로 안전하게 변환
 * 문자열 "4000", "4,000", "4000원" 등을 숫자로 변환
 * 0도 유효한 값으로 허용 (무료배송)
 */
function parseShippingValue(value: any): number | null {
  // null/undefined인 경우
  if (value === null || value === undefined) {
    return null
  }

  // 이미 숫자인 경우 (0도 허용)
  if (typeof value === 'number' && !isNaN(value)) {
    return value
  }

  // 문자열인 경우 파싱 시도
  if (typeof value === 'string') {
    // 콤마, 원, ₩, 공백 등 제거 후 숫자 추출
    const cleaned = value.replace(/[,원₩￦\s]/g, '')
    const parsed = parseInt(cleaned, 10)
    if (!isNaN(parsed)) {
      console.log(`📦 배송비 문자열 변환: "${value}" -> ${parsed}`)
      return parsed
    }
  }

  return null
}

/**
 * Parse AI-extracted variants from raw response
 * Returns only variants with at least one price (wholesalePrice or price)
 * 개선: 문자열 가격도 숫자로 변환하여 처리
 */
function parseAiVariants(rawVariants: any[]): GeneratedVariant[] {
  if (!rawVariants || !Array.isArray(rawVariants)) {
    console.warn('⚠️ variants가 배열이 아님:', typeof rawVariants)
    return []
  }

  console.log(`📊 variants 파싱 시작: ${rawVariants.length}개 입력`)

  const parsed = rawVariants
    .filter((v, index) => {
      if (!v) {
        console.warn(`⚠️ variants[${index}]가 null/undefined`)
        return false
      }
      // 가격 정보가 최소 하나라도 있어야 함
      const hasWholesalePrice = v.wholesalePrice !== undefined && v.wholesalePrice !== null
      const hasPrice = v.price !== undefined && v.price !== null
      if (!hasWholesalePrice && !hasPrice) {
        console.warn(`⚠️ variants[${index}]에 가격 정보 없음:`, v.optionSummary || '(요약 없음)')
        return false
      }
      return true
    })
    .map((v, index) => {
      const wholesalePrice = parsePrice(v.wholesalePrice)
      const price = parsePrice(v.price)

      // 가격 변환 결과 로깅
      if (wholesalePrice === undefined && v.wholesalePrice !== undefined) {
        console.warn(`⚠️ variants[${index}].wholesalePrice 변환 실패:`, v.wholesalePrice)
      }
      if (price === undefined && v.price !== undefined) {
        console.warn(`⚠️ variants[${index}].price 변환 실패:`, v.price)
      }

      // bundleUnit: AI가 추출했으면 사용, 아니면 정규표현식으로 폴백
      const optionSummary = String(v.optionSummary || '')
      const bundleUnit = typeof v.bundleUnit === 'number'
        ? v.bundleUnit
        : extractBundleUnitFromSummary(optionSummary)

      return {
        optionSummary,
        options: v.options && typeof v.options === 'object' ? v.options : {},
        wholesalePrice,
        price: price || wholesalePrice, // price 없으면 wholesalePrice 사용
        bundleUnit,
      }
    })
    // 최종적으로 가격이 있는 항목만 유지
    .filter(v => v.wholesalePrice !== undefined || v.price !== undefined)

  console.log(`📊 variants 파싱 결과: 입력 ${rawVariants.length}개 -> 유효 ${parsed.length}개`)
  return parsed
}

/**
 * 옵션명에서 합배송 단위 수 추출 (폴백 로직)
 * "2박스", "3kg", "2개" 등에서 숫자 추출
 */
function extractBundleUnitFromSummary(optionSummary: string): number {
  if (!optionSummary) return 1

  // 박스, kg, 개, 세트, 팩 순서로 매칭 (더 구체적인 패턴 우선)
  const patterns = [
    /(\d+)\s*(박스|box)/i,      // "2박스", "2 box"
    /(\d+)\s*(kg|킬로)/i,       // "2kg", "2킬로"
    /(\d+)\s*(세트|set)/i,      // "2세트", "2 set"
    /(\d+)\s*(팩|pack)/i,       // "2팩", "2 pack"
    /(\d+)\s*개입/i,            // "40개입" -> 단위가 아니므로 제외
  ]

  for (const pattern of patterns) {
    const match = optionSummary.match(pattern)
    if (match) {
      const unit = parseInt(match[1])
      // "40개입" 같은 경우는 합배송 단위가 아니므로 1 반환
      if (match[2] && match[2].includes('개입')) continue
      if (unit > 0 && unit <= 100) { // 합리적인 범위
        return unit
      }
    }
  }

  return 1 // 기본값
}

/**
 * shippingInfo에서 합배송 할인 금액 추출
 * 예: "합배송시 3000원 차감", "합배송 시 배송비 3,000원 할인"
 */
function extractBundleDiscountFromShippingInfo(shippingInfo: string | null | undefined): number {
  if (!shippingInfo) return 0

  // 합배송 할인 패턴들
  const patterns = [
    // "합배송시 3000원 차감", "합배송 시 3,000원 할인"
    /합배송\s*(?:시|시에?)?\s*(?:배송비\s*)?(\d{1,3}(?:,?\d{3})*)\s*원?\s*(?:차감|할인|감소|절약)/i,
    // "3000원 할인 (합배송)", "3,000원 차감(합배송시)"
    /(\d{1,3}(?:,?\d{3})*)\s*원?\s*(?:차감|할인|감소|절약)\s*\(?합배송/i,
    // "합배송 할인 3000원", "합배송할인: 3,000원"
    /합배송\s*할인\s*:?\s*(\d{1,3}(?:,?\d{3})*)\s*원?/i,
    // "묶음배송 시 3000원 할인"
    /묶음\s*배송\s*(?:시|시에?)?\s*(\d{1,3}(?:,?\d{3})*)\s*원?\s*(?:차감|할인|감소|절약)/i,
  ]

  for (const pattern of patterns) {
    const match = shippingInfo.match(pattern)
    if (match) {
      // 콤마 제거 후 숫자로 변환
      const discount = parseInt(match[1].replace(/,/g, ''))
      if (discount > 0 && discount <= 50000) { // 합리적인 범위 (최대 5만원)
        return discount
      }
    }
  }

  return 0 // 기본값
}

/**
 * optionSummary에서 options 객체 추론
 * AI가 options 필드를 생성하지 않은 경우 사용
 */
function inferOptionsFromSummary(
  summary: string,
  optionGroups: OptionGroup[]
): Record<string, string> {
  if (!summary || !optionGroups || optionGroups.length === 0) return {}

  const options: Record<string, string> = {}

  for (const group of optionGroups) {
    if (!group.values || !Array.isArray(group.values)) continue

    // optionSummary에서 해당 그룹의 값 찾기
    for (const value of group.values) {
      if (summary.includes(value)) {
        options[group.groupName] = value
        break
      }
    }
  }

  // 그룹이 하나이고 매칭된 값이 없으면 summary 전체를 값으로 사용
  if (optionGroups.length === 1 && Object.keys(options).length === 0) {
    options[optionGroups[0].groupName] = summary
  }

  if (Object.keys(options).length > 0) {
    console.log(`🔍 options 추론 완료: "${summary}" -> ${JSON.stringify(options)}`)
  }

  return options
}

/**
 * AI 응답 필수 필드 검증
 */
interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateAiResponse(parsed: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 필수 필드 검증
  if (!parsed.productName || typeof parsed.productName !== 'string' || parsed.productName.trim() === '') {
    errors.push('productName이 없거나 유효하지 않음')
  }

  // 설명 검증 (경고만)
  if (!parsed.description || typeof parsed.description !== 'string' || parsed.description.trim() === '') {
    warnings.push('description이 없거나 빈 문자열')
  }

  // options 검증
  if (!parsed.options || !Array.isArray(parsed.options)) {
    warnings.push('options가 없거나 배열이 아님')
  } else if (parsed.options.length === 0) {
    warnings.push('options 배열이 비어있음')
  } else {
    for (let i = 0; i < parsed.options.length; i++) {
      const opt = parsed.options[i]
      if (!opt || !opt.groupName) {
        warnings.push(`options[${i}].groupName이 없음`)
      }
      if (!opt || !opt.values || !Array.isArray(opt.values) || opt.values.length === 0) {
        warnings.push(`options[${i}].values가 비어있거나 유효하지 않음`)
      }
    }
  }

  // variants 검증
  if (!parsed.variants || !Array.isArray(parsed.variants)) {
    warnings.push('variants가 없거나 배열이 아님')
  } else if (parsed.variants.length === 0) {
    warnings.push('variants 배열이 비어있음 (폴백 처리 필요)')
  } else {
    for (let i = 0; i < parsed.variants.length; i++) {
      const v = parsed.variants[i]
      if (!v) continue

      if (!v.optionSummary) {
        warnings.push(`variants[${i}].optionSummary가 없음`)
      }
      if (v.wholesalePrice === undefined && v.price === undefined) {
        warnings.push(`variants[${i}]에 가격 정보가 없음`)
      }
      // 가격 타입 검증
      if (v.wholesalePrice !== undefined && typeof v.wholesalePrice !== 'number') {
        warnings.push(`variants[${i}].wholesalePrice가 숫자가 아님: ${typeof v.wholesalePrice} ("${v.wholesalePrice}")`)
      }
      if (v.price !== undefined && typeof v.price !== 'number') {
        warnings.push(`variants[${i}].price가 숫자가 아님: ${typeof v.price} ("${v.price}")`)
      }
      // options 필드 검증
      if (!v.options || Object.keys(v.options).length === 0) {
        warnings.push(`variants[${i}].options가 없거나 비어있음 (추론 필요)`)
      }
    }
  }

  // pricing 검증
  if (!parsed.pricing) {
    warnings.push('pricing 객체가 없음')
  } else {
    if (parsed.pricing.wholesalePrice === undefined && parsed.pricing.price === undefined) {
      warnings.push('pricing에 가격 정보가 없음')
    }
  }

  return { valid: errors.length === 0, errors, warnings }
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

  // 1. Check if we're in an unclosed string
  let inString = false
  let escapeNext = false
  let lastStringStart = -1
  let lastCompleteElement = -1 // 마지막으로 완전한 요소의 위치

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
    // 문자열 밖에서 }, ] 를 만나면 완전한 요소로 기록
    if (!inString && (char === '}' || char === ']')) {
      lastCompleteElement = i
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
  // 불완전한 배열 요소 제거 (예: [1, 2, )
  jsonText = jsonText.replace(/,?\s*\{[^}]*$/m, '')

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
    return jsonText
  } catch (e: any) {
    console.log('🔧 1차 복구 실패, 2차 시도 중...', e.message)
  }

  // 7. 2차 복구 시도: 마지막 완전한 배열 요소까지만 사용
  // 에러 메시지에서 위치 추출 시도
  try {
    JSON.parse(jsonText)
  } catch (e: any) {
    const positionMatch = e.message.match(/position (\d+)/)
    if (positionMatch) {
      const errorPosition = parseInt(positionMatch[1], 10)
      console.log(`🔧 에러 위치: ${errorPosition}`)

      // 에러 위치 이전의 마지막 완전한 객체 찾기
      let lastGoodPosition = errorPosition - 1
      let braceCount = 0
      let bracketCount = 0
      inString = false
      escapeNext = false

      // 에러 위치에서 역방향으로 탐색하여 완전한 구조 찾기
      for (let i = errorPosition - 1; i >= 0; i--) {
        const char = jsonText[i]
        if (char === '}' && !inString) {
          // } 발견 시 이전의 쉼표까지 찾아서 자르기
          let cutPoint = i + 1
          // 다음 쉼표 확인
          for (let j = i + 1; j < Math.min(i + 10, jsonText.length); j++) {
            if (jsonText[j] === ',') {
              cutPoint = j
              break
            }
            if (jsonText[j] !== ' ' && jsonText[j] !== '\n' && jsonText[j] !== '\r' && jsonText[j] !== '\t') {
              break
            }
          }

          const truncated = jsonText.substring(0, cutPoint).trim().replace(/,\s*$/, '')

          // 괄호 균형 확인
          let testBraces = 0
          let testBrackets = 0
          let testInString = false
          let testEscapeNext = false

          for (const c of truncated) {
            if (testEscapeNext) {
              testEscapeNext = false
              continue
            }
            if (c === '\\') {
              testEscapeNext = true
              continue
            }
            if (c === '"') {
              testInString = !testInString
              continue
            }
            if (testInString) continue

            if (c === '{') testBraces++
            else if (c === '}') testBraces--
            else if (c === '[') testBrackets++
            else if (c === ']') testBrackets--
          }

          let repaired = truncated
          for (let k = 0; k < testBrackets; k++) repaired += ']'
          for (let k = 0; k < testBraces; k++) repaired += '}'

          try {
            JSON.parse(repaired)
            console.log(`🔧 2차 복구 성공 (위치 ${i}에서 절단)`)
            return repaired
          } catch {
            // 이 위치에서 실패하면 계속 역방향 탐색
          }
        }
      }
    }
  }

  console.log('🔧 JSON 복구 시도 완료 (일부 데이터 손실 가능)')
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

    // 검증 로직 실행
    const validation = validateAiResponse(parsed)
    if (!validation.valid) {
      console.error('❌ AI 응답 검증 실패:', validation.errors)
      throw new Error(`AI 응답 검증 실패: ${validation.errors.join(', ')}`)
    }
    if (validation.warnings.length > 0) {
      console.warn('⚠️ AI 응답 검증 경고:', validation.warnings)
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

    // 배송비 정보 파싱 (문자열도 숫자로 변환)
    const shippingFee = parseShippingValue(parsed.shipping?.shippingFee)
    const shippingInfo = typeof parsed.shipping?.shippingInfo === 'string'
      ? parsed.shipping.shippingInfo
      : null
    const bundleMaxQty = parseShippingValue(parsed.shipping?.bundleMaxQty) ?? 1

    console.log('📦 배송비 파싱 결과:', {
      rawShippingFee: parsed.shipping?.shippingFee,
      parsedShippingFee: shippingFee,
      rawShippingInfo: parsed.shipping?.shippingInfo,
      rawBundleMaxQty: parsed.shipping?.bundleMaxQty,
      parsedBundleMaxQty: bundleMaxQty,
    })

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
        bundleMaxQty,
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

    // variants에 options가 비어있으면 optionSummary에서 추론 시도
    variants = variants.map(v => {
      if (Object.keys(v.options).length === 0 && v.optionSummary && analysis.options.length > 0) {
        const inferredOptions = inferOptionsFromSummary(v.optionSummary, analysis.options)
        return {
          ...v,
          options: inferredOptions,
        }
      }
      return v
    })

    console.log('📦 AI Variants:', variants.map(v => ({
      summary: v.optionSummary,
      options: v.options,
      wholesalePrice: v.wholesalePrice,
      price: v.price,
    })))

  } else if (analysis.options.length > 0) {
    // Case 2: variants가 없지만 options가 있는 경우 - 자동 생성
    console.warn('⚠️ AI가 variants를 생성하지 않음, options에서 자동 생성')

    variants = generateVariants(analysis.options)
    const optionPrices = analysis.pricing.optionPrices || []

    variants = variants.map((variant) => {
      const optionPrice = findOptionPriceForVariant(variant, optionPrices)
      return {
        ...variant,
        wholesalePrice: analysis.pricing.basePrice, // 도매가 추가
        price: optionPrice || sellingPrice,
      }
    })

    console.log('📦 Generated Variants:', variants.map(v => ({
      summary: v.optionSummary,
      options: v.options,
      wholesalePrice: v.wholesalePrice,
      price: v.price,
    })))

  } else {
    // Case 3: options/variants 모두 없음 - 단일 상품으로 처리
    console.warn('⚠️ options, variants 모두 없음, 단일 상품으로 처리')
    variants = [{
      optionSummary: '기본',
      options: {},
      wholesalePrice: analysis.pricing.basePrice,
      price: sellingPrice,
    }]
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
    bundleMaxQty: analysis.shipping?.bundleMaxQty ?? 1,
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
// BATCH PROCESSING
// =============================================

/**
 * 배치 변환 결과 타입
 */
export interface BatchTransformResult {
  postId: number
  success: boolean
  draft?: ProductDraft
  error?: string
  tokensUsed?: number  // 전체 배치의 토큰 사용량 (첫 번째 결과에만 포함)
}

/**
 * 배치 처리용 프롬프트 생성
 * 여러 게시물을 하나의 프롬프트로 결합하여 1회 API 호출로 처리
 */
function buildBatchProductExtractionPrompt(
  inputs: ProductTransformationInput[],
  policyContent?: string | null
): string {
  // 게시물 목록 섹션 생성
  const postsSection = inputs.map((input, i) => `
## 게시물 ${i + 1} (ID: ${input.post.id})
제목: ${input.post.title}
내용: ${input.post.content || '(내용 없음)'}
`).join('\n')

  // 정책 섹션 생성
  const policySection = policyContent
    ? `
# 가격 정책
${policyContent}
`
    : ''

  // 가격 추출 규칙
  const pricingRule = policyContent
    ? `## 가격 추출
도매가(wholesalePrice)와 판매가(price)를 추출합니다.

⚠️ 최우선 원칙: 위 "가격 정책"의 지시를 반드시 따르세요.
- 가격 정책에서 "공급가"로 표시된 가격에만 마진을 적용하라고 했다면, "판매가"나 단순 "가격"으로 표시된 금액에는 마진을 적용하지 마세요.
- 가격 정책에서 특정 조건을 명시했다면 그 조건을 정확히 따르세요.

추출 규칙:
- 도매가(wholesalePrice): 게시물에서 추출한 원본 가격
- 판매가(price): 가격 정책의 규칙에 따라 계산된 최종 소매 판매가 (마진 적용 여부는 정책에 따름)`
    : `## 가격 추출
상품의 가격을 추출합니다.

추출 규칙:
- 도매가(wholesalePrice): 게시물에서 추출한 가격
- 판매가(price): 도매가와 동일 (가격정책 없음)`

  return `당신은 한국 도매 쇼핑몰 상품 정보 추출 전문가입니다.

아래 ${inputs.length}개의 게시물을 분석하여 각각의 상품 정보를 추출해주세요.

# 게시물 목록
${postsSection}
${policySection}

---

${EXTRACTION_RULES.replace('{pricingRule}', pricingRule)}

---

${BATCH_RESPONSE_FORMAT}

---

${BATCH_CHECKLIST}`
}

/**
 * 배치 응답에서 개별 결과 파싱
 */
interface BatchParseResult {
  postId: number
  success: boolean
  analysis?: AiProductAnalysis
  error?: string
}

/**
 * JSON 배열 추출
 */
function extractJsonArray(content: string): any[] {
  let jsonText = content.trim()

  // 마크다운 코드블록 제거
  const jsonMatch = jsonText.match(/```(?:json|JSON)?\s*([\s\S]*)\s*```/)
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim()
  }

  // 시작 부분에 ``` 있으면 제거
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json|JSON)?\s*\n?/, '').trim()
    jsonText = jsonText.replace(/\n?\s*```\s*$/, '').trim()
  }

  // [ 로 시작하지 않으면 배열 찾기
  if (!jsonText.startsWith('[')) {
    const firstBracket = jsonText.indexOf('[')
    const lastBracket = jsonText.lastIndexOf(']')
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      jsonText = jsonText.substring(firstBracket, lastBracket + 1)
    }
  }

  // JSON 복구 시도 (잘린 응답 처리)
  jsonText = repairTruncatedJson(jsonText)

  const parsed = JSON.parse(jsonText)
  if (!Array.isArray(parsed)) {
    throw new Error('응답이 JSON 배열이 아닙니다')
  }

  return parsed
}

/**
 * 개별 분석 결과를 AiProductAnalysis로 변환
 */
function parseIndividualResult(item: any): AiProductAnalysis {
  // AI가 직접 추출한 variants 파싱
  const aiVariants = parseAiVariants(item.variants || [])

  // 가격 정보 추출
  const basePrice = item.pricing?.wholesalePrice ||
                    item.pricing?.basePrice ||
                    item.pricing?.price

  const sellingPrice = item.pricing?.price ||
                       item.pricing?.sellingPrice ||
                       basePrice

  // 배송비 정보 파싱 (문자열도 숫자로 변환)
  const shippingFee = parseShippingValue(item.shipping?.shippingFee)
  const shippingInfo = typeof item.shipping?.shippingInfo === 'string'
    ? item.shipping.shippingInfo
    : null
  const bundleMaxQty = parseShippingValue(item.shipping?.bundleMaxQty) ?? 1

  console.log('📦 배송비 파싱 결과:', {
    rawShippingFee: item.shipping?.shippingFee,
    parsedShippingFee: shippingFee,
    rawShippingInfo: item.shipping?.shippingInfo,
    rawBundleMaxQty: item.shipping?.bundleMaxQty,
    parsedBundleMaxQty: bundleMaxQty,
  })

  return {
    productName: item.productName,
    description: item.description || '',
    category: item.category || undefined,
    options: item.options || [],
    variants: aiVariants,
    pricing: {
      basePrice: basePrice,
      sellingPrice: sellingPrice,
      price: sellingPrice,
      currency: item.pricing?.currency || 'KRW',
      optionPrices: [],
      priceRange: undefined,
    },
    shipping: {
      shippingFee,
      shippingInfo,
      bundleMaxQty,
    },
    rawResponse: JSON.stringify(item),
  }
}

/**
 * 배치 AI 응답 파싱
 * JSON 배열 → 개별 분석 결과 매핑
 */
function parseBatchAiResponse(
  aiResponse: AiResponse,
  postIds: number[]
): BatchParseResult[] {
  try {
    console.log('🔍 배치 AI 응답 파싱 시작')
    console.log('🔍 원본 응답 (처음 500자):', aiResponse.content.substring(0, 500))

    // JSON 배열 추출 및 파싱
    const jsonArray = extractJsonArray(aiResponse.content)
    console.log(`✅ JSON 배열 파싱 성공: ${jsonArray.length}개 항목`)

    return postIds.map(postId => {
      const item = jsonArray.find((r: any) => r.postId === postId)
      if (!item) {
        console.warn(`⚠️ postId ${postId}에 대한 결과 없음`)
        return { postId, success: false, error: '응답에서 해당 게시물 결과 없음' }
      }

      try {
        // 개별 분석 결과 변환
        const analysis = parseIndividualResult(item)
        console.log(`✅ postId ${postId} 파싱 성공: ${analysis.productName}`)
        return { postId, success: true, analysis }
      } catch (parseError: any) {
        console.error(`❌ postId ${postId} 개별 파싱 실패:`, parseError.message)
        return { postId, success: false, error: `개별 파싱 실패: ${parseError.message}` }
      }
    })
  } catch (error: any) {
    console.error('❌ 배치 파싱 전체 실패:', error.message)
    // 전체 파싱 실패 시 모든 게시물 실패 처리
    return postIds.map(postId => ({
      postId,
      success: false,
      error: `배치 파싱 실패: ${error.message}`
    }))
  }
}

/**
 * 여러 게시물을 한 번의 API 호출로 변환
 * @param inputs 변환할 게시물 배열 (권장: 5개)
 * @param aiConfig AI 설정
 * @param policyContent 가격 정책 (선택)
 */
export async function transformPostsToProductsBatch(
  inputs: ProductTransformationInput[],
  aiConfig: { apiKey: string; model: string; provider: import('@bandauto/db').AiProvider },
  policyContent?: string | null
): Promise<BatchTransformResult[]> {
  if (inputs.length === 0) return []

  console.log(`🔄 배치 변환 시작: ${inputs.length}개 게시물`)

  // 입력 유효성 검사
  const validInputs = inputs.filter(input => {
    if (!input.post) return false
    if (!input.post.title && !input.post.content) return false
    return true
  })

  if (validInputs.length === 0) {
    return inputs.map(input => ({
      postId: input.post?.id || 0,
      success: false,
      error: '유효하지 않은 게시물'
    }))
  }

  // AI 클라이언트 생성 (배치 처리 - 토큰 제한 없음)
  const aiClient = createAiClient({
    provider: aiConfig.provider,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
  })

  // 배치 프롬프트 생성
  const prompt = buildBatchProductExtractionPrompt(validInputs, policyContent)
  console.log(`📝 배치 프롬프트 생성 완료 (길이: ${prompt.length})`)

  // AI 호출 (1회)
  const aiResponse = await aiClient.generateContent(prompt)
  console.log(`✅ AI 응답 수신 (토큰: ${aiResponse.tokensUsed || 'N/A'})`)

  // 배치 응답 파싱
  const postIds = validInputs.map(i => i.post.id)
  const parseResults = parseBatchAiResponse(aiResponse, postIds)

  // ProductDraft 생성
  const results: BatchTransformResult[] = parseResults.map((result, index) => {
    if (!result.success || !result.analysis) {
      return { postId: result.postId, success: false, error: result.error }
    }

    try {
      const draft = buildProductDraft(result.analysis, validInputs[index])
      return { postId: result.postId, success: true, draft }
    } catch (draftError: any) {
      return {
        postId: result.postId,
        success: false,
        error: `ProductDraft 생성 실패: ${draftError.message}`
      }
    }
  })

  // 첫 번째 결과에 전체 배치의 토큰 사용량 추가
  if (results.length > 0 && aiResponse.tokensUsed) {
    results[0].tokensUsed = aiResponse.tokensUsed
  }

  return results
}

// =============================================
// EXPORT
// =============================================

export { buildProductExtractionPrompt, parseAiResponse, buildProductDraft, buildBatchProductExtractionPrompt }
