import { GoogleGenerativeAI } from '@google/generative-ai'
import { loadAISettings } from './config-storage'

// API 키 우선순위: 1. 설정 파일, 2. 환경변수
function getGeminiAPIKey(): string {
  // 1순위: 설정 파일에서 로드
  try {
    const settings = loadAISettings()
    if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
      console.log('✅ Gemini API Key: 설정 파일에서 로드됨')
      return settings.geminiApiKey
    }
  } catch (error) {
    console.warn('⚠️ 설정 파일 로드 실패, 환경변수 사용:', error)
  }

  // 2순위: 환경변수
  const envKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (envKey) {
    console.log('✅ Gemini API Key: 환경변수에서 로드됨')
    return envKey
  }

  throw new Error('❌ Gemini API Key를 찾을 수 없습니다. 설정 페이지에서 API 키를 등록하거나 .env.local에 GEMINI_API_KEY를 설정해주세요.')
}

// 모델 이름 가져오기 (설정 파일 우선)
function getGeminiModel(): string {
  try {
    const settings = loadAISettings()
    if (settings.geminiModel && settings.geminiModel.trim()) {
      console.log(`✅ Gemini Model: ${settings.geminiModel} (설정 파일)`)
      return settings.geminiModel
    }
  } catch (error) {
    console.warn('⚠️ 설정 파일에서 모델 로드 실패, 기본값 사용')
  }

  return 'gemini-2.5-flash' // 기본값
}

// GoogleGenerativeAI 인스턴스 가져오기 (매번 최신 설정 반영)
function getGenAI() {
  const apiKey = getGeminiAPIKey()
  return new GoogleGenerativeAI(apiKey)
}

// 모델 인스턴스 가져오기 (매번 최신 설정 반영)
function getModel() {
  const genAI = getGenAI()
  const modelName = getGeminiModel()
  return genAI.getGenerativeModel({ model: modelName })
}

// 하위 호환성을 위한 레거시 변수 (deprecated)
const GEMINI_API_KEY = getGeminiAPIKey()
const genAI = getGenAI()

// 문자열 기반 가격정책 적용 함수 - CLAUDE.md 기준 6개 밴드별 정확한 정책
function applyPricingPolicyText(originalPrice: number, pricingPolicyText: string, shippingFee: number = 0): number {
  if (!pricingPolicyText || !originalPrice) {
    return originalPrice
  }

  const policy = pricingPolicyText.toLowerCase()
  let result = originalPrice

  console.log(`🔧 가격정책 적용 시도: 원가 ${originalPrice}원, 배송비 ${shippingFee}원, 정책: ${pricingPolicyText.substring(0, 100)}...`)

  // 1️⃣ 가족도매방: 원가 그대로 판매 (단, 39,900원 이상은 구간별 마진 적용)
  if (policy.includes('원가 그대로') || policy.includes('원가그대로') || policy.includes('마진 없음') || policy.includes('마진없음')) {
    console.log('📋 [가족도매방] 정책 적용')

    if (originalPrice <= 39900) {
      result = originalPrice
      console.log(`  ✅ 39,900원 이하 → 원가 그대로: ${result}원`)
    } else if (originalPrice >= 40000 && originalPrice <= 49900) {
      result = originalPrice + 2000
      console.log(`  ✅ 40,000~49,900원 → +2,000원: ${result}원`)
    } else if (originalPrice >= 50000 && originalPrice <= 59900) {
      result = originalPrice + 4000
      console.log(`  ✅ 50,000~59,900원 → +4,000원: ${result}원`)
    } else if (originalPrice >= 60001 && originalPrice <= 70000) {
      result = originalPrice + 6000
      console.log(`  ✅ 60,001~70,000원 → +6,000원: ${result}원`)
    } else if (originalPrice >= 70001 && originalPrice <= 80000) {
      result = originalPrice + 7000
      console.log(`  ✅ 70,001~80,000원 → +7,000원: ${result}원`)
    } else if (originalPrice >= 80001 && originalPrice <= 90000) {
      result = originalPrice + 8000
      console.log(`  ✅ 80,001~90,000원 → +8,000원: ${result}원`)
    } else if (originalPrice >= 90001 && originalPrice <= 100000) {
      result = originalPrice + 9000
      console.log(`  ✅ 90,001~100,000원 → +9,000원: ${result}원`)
    } else if (originalPrice >= 100001 && originalPrice <= 150000) {
      result = originalPrice + 12000
      console.log(`  ✅ 100,001~150,000원 → +12,000원: ${result}원`)
    } else if (originalPrice >= 150001 && originalPrice <= 200000) {
      result = originalPrice + 20000
      console.log(`  ✅ 150,001~200,000원 → +20,000원: ${result}원`)
    } else {
      result = originalPrice
      console.log(`  ✅ 범위 밖 → 원가 그대로: ${result}원`)
    }

    return result
  }

  // 2️⃣ 요한이네♧소매방 & 초록이네: 수집가격 기준 구간별 마진 적용
  if (policy.includes('수집가격 기준 구간별 마진') || policy.includes('수집된 게시물 가격 기준으로')) {
    console.log('📋 [요한이네/초록이네] 정책 적용')

    if (originalPrice <= 19900) {
      result = originalPrice + 1000
      console.log(`  ✅ 19,900원 이하 → +1,000원: ${result}원`)
    } else if (originalPrice >= 20000 && originalPrice <= 29900) {
      result = originalPrice + 2000
      console.log(`  ✅ 20,000~29,900원 → +2,000원: ${result}원`)
    } else if (originalPrice >= 30000 && originalPrice <= 39900) {
      result = originalPrice + 3000
      console.log(`  ✅ 30,000~39,900원 → +3,000원: ${result}원`)
    } else if (originalPrice >= 40000 && originalPrice <= 49900) {
      result = originalPrice + 4000
      console.log(`  ✅ 40,000~49,900원 → +4,000원: ${result}원`)
    } else if (originalPrice >= 50000 && originalPrice <= 59900) {
      result = originalPrice + 5000
      console.log(`  ✅ 50,000~59,900원 → +5,000원: ${result}원`)
    } else if (originalPrice >= 60001 && originalPrice <= 70000) {
      result = originalPrice + 6000
      console.log(`  ✅ 60,001~70,000원 → +6,000원: ${result}원`)
    } else if (originalPrice >= 70001 && originalPrice <= 80000) {
      result = originalPrice + 7000
      console.log(`  ✅ 70,001~80,000원 → +7,000원: ${result}원`)
    } else if (originalPrice >= 80001 && originalPrice <= 90000) {
      result = originalPrice + 8000
      console.log(`  ✅ 80,001~90,000원 → +8,000원: ${result}원`)
    } else if (originalPrice >= 90001 && originalPrice <= 100000) {
      result = originalPrice + 9000
      console.log(`  ✅ 90,001~100,000원 → +9,000원: ${result}원`)
    } else if (originalPrice >= 100001 && originalPrice <= 150000) {
      result = originalPrice + 12000
      console.log(`  ✅ 100,001~150,000원 → +12,000원: ${result}원`)
    } else if (originalPrice >= 150001 && originalPrice <= 200000) {
      result = originalPrice + 20000
      console.log(`  ✅ 150,001~200,000원 → +20,000원: ${result}원`)
    } else {
      result = originalPrice + 20000
      console.log(`  ✅ 200,001원 이상 → +20,000원: ${result}원`)
    }

    return result
  }

  // 3️⃣ 나은 상품 공급방, S D 푸드, 폐쇄몰VIP도매: 공급가 기준 마진 적용, 배송비 별도
  if (policy.includes('공급가와 배송비를 분리') || policy.includes('공급가에만 마진 적용')) {
    console.log('📋 [나은/SD푸드/폐쇄몰] 정책 적용')

    if (originalPrice <= 19900) {
      result = originalPrice + 4000
      console.log(`  ✅ 19,900원 이하 → +4,000원: ${result}원`)
    } else {
      const excess = originalPrice - 19900
      const additionalSections = Math.ceil(excess / 10000)
      const additionalMargin = additionalSections * 1000
      result = originalPrice + 4000 + additionalMargin
      console.log(`  ✅ 19,900원 초과 → 기본 4,000원 + 초과구간(${additionalSections}구간) ${additionalMargin}원 = 총 마진 ${4000 + additionalMargin}원: ${result}원`)
    }

    return result
  }

  // 4. 퍼센트 마진 패턴 (예: 30% 마진, 20% 추가) - 기타 정책
  const percentMatch = policy.match(/(\d+)%\s*마진|(\d+)%\s*추가|(\d+)%\s*올려서|마진\s*(\d+)%/);
  if (percentMatch) {
    const percent = parseInt(percentMatch[1] || percentMatch[2] || percentMatch[3] || percentMatch[4])
    result = Math.round(originalPrice * (1 + percent / 100))
    console.log(`📋 정책 적용: ${percent}% 마진 → ${result}원`)
    return result
  }

  // 5. 고정 마진 패턴 (예: 1000원 마진, +2000원) - 기타 정책
  const fixedMarginMatch = policy.match(/(\d+)원\s*마진|마진\s*(\d+)원|\+(\d+)원|(\d+)원\s*추가/);
  if (fixedMarginMatch) {
    const margin = parseInt(fixedMarginMatch[1] || fixedMarginMatch[2] || fixedMarginMatch[3] || fixedMarginMatch[4])
    result = originalPrice + margin
    console.log(`📋 정책 적용: +${margin}원 마진 → ${result}원`)
    return result
  }

  // 6. 배수 패턴 (예: 1.3배, 원가의 120%) - 기타 정책
  const multipleMatch = policy.match(/(\d+\.?\d*)배|원가의?\s*(\d+)%/);
  if (multipleMatch) {
    const multiple = parseFloat(multipleMatch[1]) || (parseInt(multipleMatch[2]) / 100)
    result = Math.round(originalPrice * multiple)
    console.log(`📋 정책 적용: ${multiple}배 → ${result}원`)
    return result
  }

  // 7. 최소 마진 패턴 - 기타 정책
  const minMarginMatch = policy.match(/최소\s*마진\s*(\d+)원|최소\s*(\d+)원/);
  if (minMarginMatch) {
    const minMargin = parseInt(minMarginMatch[1] || minMarginMatch[2])
    result = originalPrice + minMargin
    console.log(`📋 정책 적용: 최소 ${minMargin}원 마진 → ${result}원`)
    return result
  }

  // 8. 기본값: 정책이 있지만 패턴이 일치하지 않는 경우 - 원가 그대로 반환
  console.log(`⚠️ 정책 패턴 불일치 → 원가 그대로: ${originalPrice}원`)
  return originalPrice
}

// JSON 정화 함수: Gemini AI 응답에서 주석과 오류를 제거
function cleanupJSONString(jsonText: string): string {
  console.log('🧹 JSON 정화 시작:', jsonText.substring(0, 200) + '...')
  
  try {
    let cleaned = jsonText
    
    // 1. 행 끝의 주석 제거 (// ... 형태)
    cleaned = cleaned.replace(/\/\/.*$/gm, '')
    
    // 2. 여러 줄 주석 제거 (/* ... */ 형태)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
    
    // 3. 특별한 케이스: "}, // ..." 패턴을 "}"로 변경
    cleaned = cleaned.replace(/\},\s*\/\/[^\n\r]*/g, '}')
    
    // 4. 배열이나 객체 내부의 주석 처리
    cleaned = cleaned.replace(/(["\]\}]),\s*\/\/[^\n\r]*(\n|\r)/g, '$1$2')
    
    // 5. trailing comma 제거
    cleaned = cleaned.replace(/,\s*\}/g, '}')
    cleaned = cleaned.replace(/,\s*\]/g, ']')
    
    // 6. 불완전한 배열이나 객체 처리
    cleaned = cleaned.replace(/,\s*$/, '')
    
    // 7. 잘못된 이스케이프 시퀀스 수정
    // hex escape 오류를 일으킬 수 있는 특수문자 정리
    cleaned = cleaned.replace(/\\x[0-9a-fA-F]?[^0-9a-fA-F]/g, '') // 불완전한 hex escape 제거
    cleaned = cleaned.replace(/\\x$/, '') // 끝에 있는 불완전한 hex
    
    // 8. 백슬래시 관련 정리
    cleaned = cleaned.replace(/\\(?!["\\/bfnrtu\\x])/g, '\\\\')
    
    // 9. 중복된 콤마 제거
    cleaned = cleaned.replace(/,,+/g, ',')
    
    // 10. 줄바꿈 및 공백 정리
    cleaned = cleaned.replace(/\n\s*\n/g, '\n')
    cleaned = cleaned.replace(/^\s+|\s+$/gm, '') // 각 줄의 앞뒤 공백 제거하되 내용은 보존
    
    console.log('🧹 JSON 정화 완료:', cleaned.substring(0, 200) + '...')
    
    return cleaned.trim()
    
  } catch (error) {
    console.error('JSON 정화 중 오류 발생:', error)
    console.log('원본 텍스트:', jsonText.substring(0, 500))
    
    // 오류 발생 시 기본적인 정리만 수행
    return jsonText
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,\s*\}/g, '}')
      .replace(/,\s*\]/g, ']')
      .trim()
  }
}

export interface ProductAnalysis {
  extractedPrice?: number
  salesUnit?: string
  shippingFee?: number
  hookingTitle?: string
  hookingContent: string
  priceOptions?: Array<{  // 단순화된 가격 옵션 배열
    option: string
    price: number
  }>
  shippingPolicy?: string  // 새로운 배송 정책 필드
  hasDeadline?: boolean
  deadlineInfo?: string
  specialNotes?: string
  productCategory: 'SEAFOOD' | 'MEAT' | 'AGRICULTURE' | 'PROCESSED' | 'OTHER'
  // Missing properties that were being used in the code
  detailedContent?: string
  priceInfo?: string
  finalPolicyPrice?: number
  // JSON 정규화 데이터 추가
  structuredData?: {
    product_title: string
    options: Array<{
      label: string
      weight_grams?: number | null
      volume_ml?: number | null
      count?: number | null
      count_unit?: string | null
      pieces?: number | null
      count_range?: string | null
      price_supply_krw: number
    }>
    shipping: {
      fee_krw: number
      fee_applied_per: "per-order" | "repeat-per-item"
      combined_shipping: {
        allowed: boolean | null
        limit_value?: number | null
        limit_unit?: string | null
        note?: string | null
      }
    }
    order: {
      cutoff_times: string[]
      dispatch?: string | null
    }
    courier?: string | null
    details: {
      origin?: string | null
      storage?: string | null
      packaging?: string | null
      shelf_life?: string | null
      ingredients?: string | null
    }
    notes: string[]
  }
  // 가격정책 적용 결과
  adjustedPrice?: number
  priceCalculation?: {
    originalPrice: number
    marginRate: number
    calculatedMargin: number
    minimumMargin: number
    finalMargin: number
    adjustedPrice: number
    appliedPolicy: string
  }
}

export async function analyzeProductContent(
  title: string,
  content: string,
  comments: string[]
): Promise<ProductAnalysis> {
  try {
    const model = getModel() // 설정 파일에서 동적으로 모델 로드

    const prompt = `
도매 상품 게시물을 분석하여 판매용 정보를 추출해 주세요.

[게시물 제목] ${title}
[게시물 내용] ${content}
[댓글들] ${comments.map((comment, index) => `댓글 ${index + 1}: ${comment}`).join('\n')}

다음 JSON 형식으로 응답:

{
  "extractedPrice": 최저가격 (숫자만),
  "salesUnit": "판매단위",
  "shippingFee": 배송비 (숫자, 무료시 0, 없으면 null),
  "hookingTitle": "정확히 20자 제목",
  "hookingContent": "구매 포인트 150-200자",
  "priceOptions": [{"option": "옵션명", "price": 가격숫자}],
  "shippingPolicy": "배송정책",
  "productCategory": "SEAFOOD|MEAT|AGRICULTURE|PROCESSED|OTHER",
  "hasDeadline": 마감여부 true/false,
  "deadlineInfo": "마감정보",
  "specialNotes": "특이사항"
}

**핵심 규칙**:

1. **hookingTitle (20자 정확)**
   ❌ 금지: 가격, 용량, 수량, kg, 개, 박스, 세트
   ✅ 포함: 상품명, 등급, 품질, 원산지만
   예시: "프리미엄 로얄체리 직송품"

2. **hookingContent (150-200자)**
   ❌ 완전금지: 가격/배송/용량/수량 관련 모든 언급
   ✅ 풍부하게: 품질/맛/영양/효능/조리법/건강혜택/특징
   예시: "달콤한 풍미와 아삭한 식감이 뛰어난 프리미엄 체리입니다. 엄선된 최고 등급만을 직송..."

3. **priceOptions 추출**
   ❌ 절대금지: 단위당 가격 계산 (22,500원/kg 등)
   ❌ 제외대상: "추가 구매 옵션", "단독구매 불가" 포함 항목
   ✅ 원문그대로: 모든 기본 옵션의 가격을 숫자로만 추출

4. **productCategory 분류**
   수산물→SEAFOOD, 축산물→MEAT, 농산물→AGRICULTURE, 가공품→PROCESSED, 기타→OTHER

**중요**: 공급가 기준으로 추출, 이모지/특수문자로 구분된 모든 옵션 파싱
전체 본문에서 가격과 관련된 내용을 분석하여 공급가와 판매가가 같이 기재된 경우 공급가만 가져와서 가격정책에 따라 판매가 선정
`;

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // 🔍 AI 응답 디버깅 로깅 추가
    console.log('🤖 Gemini AI 원본 응답:', text)

    // JSON 파싱 시도 - 강화된 정화 로직
    try {
      // 1. 먼저 JSON 블록 추출
      let jsonText = text
      
      // ```json ... ``` 형태 처리
      const codeBlockMatch = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/)
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1]
      } else {
        // 일반적인 JSON 객체 찾기
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonText = jsonMatch[0]
        }
      }
      
      // 2. JSON 정화: 주석 제거 및 오류 수정
      jsonText = cleanupJSONString(jsonText)
      
      const analysis = JSON.parse(jsonText)
      console.log('📊 파싱된 분석 결과:', JSON.stringify(analysis, null, 2))
      console.log('💰 추출된 priceOptions:', analysis.priceOptions)
      return analysis
      
      // JSON이 없으면 기본 분석 제공
      return {
        hookingTitle: title.length > 20 ? title.substring(0, 17) + "..." : title,
        hookingContent: "엄선된 프리미엄 품질과 신선함을 자랑하는 특별한 상품입니다. 건강하고 맛있는 식탁을 위한 최고의 선택으로, 깊은 맛과 풍부한 영양을 만끽하실 수 있습니다. 정성스럽게 준비된 고품질 상품으로 특별한 식사 시간을 경험해보세요.",
        detailedContent: content.length > 200 ? content.substring(0, 200) + '...' : content,
        priceInfo: content,
        productCategory: 'OTHER' as const
      }
      
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError)
      console.log('Gemini 원본 응답:', text)
      
      return {
        hookingTitle: title.length > 20 ? title.substring(0, 17) + "..." : title,
        hookingContent: "신선하고 품질 좋은 원재료로 만든 프리미엄 상품입니다. 건강한 맛과 풍부한 영양소가 가득해 온 가족이 안심하고 드실 수 있습니다. 정성스런 제조 과정을 거쳐 최고의 품질을 자랑하며, 특별한 식사를 위한 완벽한 선택입니다.",
        detailedContent: content.length > 200 ? content.substring(0, 200) + '...' : content,
        priceInfo: content,
        productCategory: 'OTHER' as const
      }
    }

  } catch (error) {
    console.error('Gemini AI 분석 오류:', error)
    
    // 오류 시 기본 분석 제공
    return {
      hookingTitle: title.length > 20 ? title.substring(0, 17) + "..." : title,
      hookingContent: "최고 품질의 엄선된 재료로 정성스럽게 준비한 프리미엄 상품입니다. 신선함과 맛, 영양이 완벽하게 조화된 건강한 선택으로, 소중한 가족을 위한 특별한 식탁을 완성해드립니다. 자연의 깊은 맛과 풍부한 영양소를 온전히 담은 고품질 상품입니다.",
      detailedContent: content.length > 200 ? content.substring(0, 200) + '...' : content,
      priceInfo: content,
      productCategory: 'OTHER' as const
    }
  }
}

export async function batchAnalyzeProducts(posts: Array<{
  title: string
  content: string
  comments: string[]
}>): Promise<ProductAnalysis[]> {
  const results: ProductAnalysis[] = []
  
  // API 과부하 방지를 위해 순차 처리
  for (const post of posts) {
    try {
      const analysis = await analyzeProductContent(post.title, post.content, post.comments)
      results.push(analysis)
      
      // 각 요청 간 1초 대기 (API 제한 방지)
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error('배치 분석 오류:', error)
      // 오류 시 기본 분석 추가
      results.push({
        hookingTitle: post.title.length > 20 ? post.title.substring(0, 17) + "..." : post.title,
        hookingContent: "신선하고 우수한 품질을 자랑하는 엄선된 상품입니다. 건강한 식단과 맛있는 식사를 위한 최적의 선택으로, 자연의 풍부한 영양과 깊은 맛을 동시에 만족시켜드립니다. 정성스럽게 준비된 프리미엄 품질로 특별한 경험을 선사합니다.",
        detailedContent: post.content.length > 200 ? post.content.substring(0, 200) + '...' : post.content,
        priceInfo: post.content,
        productCategory: 'OTHER' as const
      })
    }
  }
  
  return results
}

// 가격정책을 적용하여 수정가격을 계산하는 함수
export function applyPricingPolicy(
  originalPrice: number,
  pricingPolicy: {
    pricingPolicyText?: string | null
    shippingPolicyText?: string | null
    marginRate?: number | null
    minimumMargin?: number | null
    shippingCost?: number | null
    freeShippingMin?: number | null
  }
): {
  adjustedPrice: number
  priceCalculation: {
    originalPrice: number
    marginRate: number
    calculatedMargin: number
    minimumMargin: number
    finalMargin: number
    adjustedPrice: number
    appliedPolicy: string
  }
} {
  const marginRate = pricingPolicy.marginRate || 20 // 기본 20% 마진
  const minimumMargin = pricingPolicy.minimumMargin || 1000 // 기본 최소 마진 1000원
  
  // 마진율 기반 계산 (원가 * (1 + 마진율/100))
  const calculatedMargin = Math.round(originalPrice * (marginRate / 100))
  
  // 최소 마진과 비교하여 더 큰 값 사용
  const finalMargin = Math.max(calculatedMargin, minimumMargin)
  
  // 최종 조정가격
  const adjustedPrice = originalPrice + finalMargin
  
  // 적용된 정책 설명
  let appliedPolicy = `마진율 ${marginRate}% 적용 (${calculatedMargin.toLocaleString()}원)`
  
  if (finalMargin > calculatedMargin) {
    appliedPolicy += `, 최소 마진 ${minimumMargin.toLocaleString()}원 보장`
  }
  
  if (pricingPolicy.pricingPolicyText) {
    appliedPolicy += ` | 정책: ${pricingPolicy.pricingPolicyText.slice(0, 50)}...`
  }

  return {
    adjustedPrice,
    priceCalculation: {
      originalPrice,
      marginRate,
      calculatedMargin,
      minimumMargin,
      finalMargin,
      adjustedPrice,
      appliedPolicy
    }
  }
}

// AI 분석에 텍스트 가격정책을 반영하는 함수
export async function analyzeProductContentWithPolicy(
  title: string,
  content: string,
  comments: string[],
  pricingPolicy: string
): Promise<ProductAnalysis> {
  try {
    const model = getModel() // 설정 파일에서 동적으로 모델 로드

    const prompt = `
도매 상품 게시물을 가격정책에 따라 분석해 주세요.

[게시물 제목] ${title}
[게시물 내용] ${content}
[댓글들] ${comments.map((comment, index) => `댓글 ${index + 1}: ${comment}`).join('\n')}
[가격정책] ${pricingPolicy}

다음 JSON 형식으로 응답:

{
  "extractedPrice": 최저가격 (숫자만),
  "adjustedPrice": 정책적용 최종가격 (숫자만),
  "salesUnit": "판매단위",
  "shippingFee": 배송비 (숫자, 무료시 0, 없으면 null),
  "priceInfo": "모든 가격옵션 원문",
  "priceOptions": [{"option": "옵션명", "price": 가격숫자}],
  "shippingPolicy": "배송정책",
  "hookingTitle": "정확히 20자 제목",
  "hookingContent": "구매 포인트 150-200자",
  "detailedContent": "상품 상세 설명",
  "finalPolicyPrice": 정책반영 최종가 (adjustedPrice와 동일),
  "hasDeadline": 마감여부 true/false,
  "deadlineInfo": "마감정보",
  "specialNotes": "특이사항",
  "productCategory": "SEAFOOD|MEAT|AGRICULTURE|PROCESSED|OTHER",
  "priceCalculation": {
    "originalPrice": 원가,
    "marginRate": 마진율,
    "calculatedMargin": 계산된마진,
    "minimumMargin": 최소마진,
    "finalMargin": 최종마진,
    "adjustedPrice": 최종판매가,
    "appliedPolicy": "적용정책설명"
  }
}

**핵심 규칙**:

1. **hookingTitle (20자 정확)**
   ❌ 금지: 가격/용량/수량 정보
   ✅ 포함: 상품명/등급/품질/원산지만

2. **hookingContent (150-200자)**
   ❌ 완전금지: 가격/배송비/용량/수량 관련 언급. 숫자로 된 가격과 숫자에 붙은 원까지 같이 제외해줘.
   ✅ 풍부하게: 품질/맛/영양/효능/조리법/건강혜택

3. **priceOptions**
   ❌ 절대금지: 단위당 가격 계산
   ❌ 제외대상: "추가 구매 옵션", "단독구매 불가"
   ✅ 원문그대로: 기본 옵션의 가격만 숫자로 추출

4. **adjustedPrice**
   가격정책을 분석하여 원가에 적용된 최종 판매가격 계산

**중요**: 공급가 기준, 정책에 따른 마진 적용, 원문 그대로 추출
`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // 🔍 정책 적용 AI 응답 디버깅 로깅 추가
    console.log('🏷️ 정책 적용 Gemini AI 원본 응답:', text)
    
    try {
      // JSON 블록에서 실제 JSON 추출 (```json ... ``` 형태 처리)
      let jsonText = text
      const jsonMatch = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/)
      if (jsonMatch) {
        jsonText = jsonMatch[1]
      } else {
        // 일반적인 JSON 패턴 찾기
        const simpleMatch = text.match(/\{[\s\S]*\}/)
        if (simpleMatch) {
          jsonText = simpleMatch[0]
        }
      }
      
      // JSON 정화 적용
      jsonText = cleanupJSONString(jsonText)
      
      const analysis = JSON.parse(jsonText)
      
      // 🔍 정책 적용 분석 결과 디버깅 로깅 추가
      console.log('🏷️ 정책 적용 파싱된 분석 결과:', JSON.stringify(analysis, null, 2))
      console.log('💰 정책 적용 추출된 priceOptions:', analysis.priceOptions)
      
      // 응답 검증 및 기본값 설정
      return {
        extractedPrice: analysis.extractedPrice || null,
        adjustedPrice: analysis.adjustedPrice || null,
        salesUnit: analysis.salesUnit || null,
        shippingFee: analysis.shippingFee || null,
        priceInfo: analysis.priceInfo || content,
        priceOptions: analysis.priceOptions || [],  // ✅ 추가!
        shippingPolicy: analysis.shippingPolicy || null,  // ✅ 추가!
        hookingTitle: analysis.hookingTitle || title.slice(0, 20),
        hookingContent: analysis.hookingContent || "품질 좋은 엄선된 재료로 만든 건강하고 맛있는 상품입니다. 신선함과 깊은 풍미가 어우러진 프리미엄 품질로, 영양가 높은 식사를 위한 완벽한 선택입니다. 자연 그대로의 맛과 건강함을 동시에 만족시켜드리는 특별한 상품으로 소중한 식탁을 풍성하게 만들어보세요.",
        detailedContent: analysis.detailedContent || content.slice(0, 200),
        finalPolicyPrice: analysis.finalPolicyPrice || analysis.adjustedPrice || null,
        hasDeadline: analysis.hasDeadline || false,
        deadlineInfo: analysis.deadlineInfo || null,
        specialNotes: analysis.specialNotes || null,
        productCategory: analysis.productCategory || 'OTHER',
        priceCalculation: analysis.priceCalculation || null
      }
    } catch (parseError) {
      console.error('JSON 파싱 오류, 기본 분석으로 대체:', parseError)
      console.error('Gemini 원본 응답:', text.slice(0, 200) + '...')
      return await analyzeProductContent(title, content, comments)
    }
  } catch (error) {
    console.error('정책 기반 AI 분석 실패:', error)
    return await analyzeProductContent(title, content, comments)
  }
}

// 🚀 병렬 + 배치 처리 AI 분석 함수 (최고 성능)
export async function parallelBatchAnalyzeProducts(
  posts: Array<{
    title: string
    content: string
    comments: string[]
    pricingPolicy?: string
  }>,
  batchSize: number = 3,        // Rate limit 고려: 3개로 감소
  maxConcurrency: number = 1    // Rate limit 고려: 1개로 감소 (15 RPM 제한, 순차 처리)
): Promise<ProductAnalysis[]> {
  console.log(`🚀 병렬 배치 AI 분석 시작: ${posts.length}개 게시물, 배치크기=${batchSize}, 동시처리=${maxConcurrency}`)
  
  const results: ProductAnalysis[] = []
  
  try {
    // 1단계: 게시물을 배치로 분할
    const batches: Array<{
      title: string
      content: string
      comments: string[]
      pricingPolicy?: string
    }[]> = []
    
    for (let i = 0; i < posts.length; i += batchSize) {
      batches.push(posts.slice(i, i + batchSize))
    }
    
    console.log(`📦 ${posts.length}개 게시물을 ${batches.length}개 배치로 분할`)
    
    // 2단계: 배치들을 maxConcurrency 만큼 병렬 처리
    const batchGroups: Array<typeof batches> = []
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      batchGroups.push(batches.slice(i, i + maxConcurrency))
    }
    
    console.log(`🔄 ${batchGroups.length}개 그룹으로 병렬 처리`)
    
    // 3단계: 각 그룹을 병렬로 처리
    for (let groupIndex = 0; groupIndex < batchGroups.length; groupIndex++) {
      const batchGroup = batchGroups[groupIndex]
      console.log(`🚀 그룹 ${groupIndex + 1}/${batchGroups.length} 처리 시작: ${batchGroup.length}개 배치 병렬 실행`)
      
      const groupStartTime = Date.now()
      
      // 현재 그룹의 모든 배치를 병렬로 처리
      const batchPromises = batchGroup.map(async (batch, batchIndex) => {
        const actualBatchIndex = groupIndex * maxConcurrency + batchIndex
        return await processSingleBatch(batch, actualBatchIndex)
      })
      
      const groupResults = await Promise.all(batchPromises)
      
      // 결과를 순서대로 추가
      groupResults.forEach(batchResults => {
        results.push(...batchResults)
      })
      
      const groupTime = Date.now() - groupStartTime
      console.log(`✅ 그룹 ${groupIndex + 1} 완료: ${groupTime}ms (평균: ${groupTime / batchGroup.length}ms/배치)`)
      
      // 그룹 간 간격으로 API 제한 방지 (Gemini Free Tier: 15 RPM)
      if (groupIndex < batchGroups.length - 1) {
        console.log('⏳ 다음 배치 처리 전 대기 중... (6000ms, Rate Limit 방지)')
        await new Promise(resolve => setTimeout(resolve, 6000))  // 6초로 증가 (안전 마진)
      }
    }
    
    console.log(`🎉 병렬 배치 분석 완료: ${results.length}개 결과`)
    return results
    
  } catch (error) {
    console.error('🚫 병렬 배치 분석 오류:', error)

    // AI 분석 실패 시 명확한 에러를 던짐
    throw new Error(`AI 분석 실패: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// 단일 배치 처리 함수
async function processSingleBatch(
  batch: Array<{
    title: string
    content: string
    comments: string[]
    pricingPolicy?: string
  }>,
  batchIndex: number
): Promise<ProductAnalysis[]> {
  const batchStartTime = Date.now()
  console.log(`🤖 배치 ${batchIndex} 처리 시작: ${batch.length}개 상품`)

  try {
    const model = getModel() // 설정 파일에서 동적으로 모델 로드
    
    // 배치용 통합 프롬프트 생성
    const batchPrompt = `
${batch.length}개 상품을 한 번에 분석해주세요.

${batch.map((post, index) => `
=== 상품 ${index + 1} ===
제목: ${post.title}
내용: ${post.content}
댓글: ${post.comments.join(', ')}
${post.pricingPolicy ? `정책: ${post.pricingPolicy}` : ''}
`).join('\n')}

JSON 배열 형식으로 응답:

[
  {
    "extractedPrice": 최저가격숫자,
    "hookingTitle": "20자 제목",
    "hookingContent": "구매포인트 150-200자",
    "productCategory": "SEAFOOD|MEAT|AGRICULTURE|PROCESSED|OTHER",
    "priceOptions": [{"option": "옵션명", "price": 가격}],
    "shippingFee": 배송비숫자,
    "hasDeadline": true/false,
    "deadlineInfo": "마감정보"
  }
  // ${batch.length}개 모든 상품
]

규칙: 20자 제목(가격/용량 제외), 가격은 원문 그대로, ${batch.length}개 정확히`

    const result = await model.generateContent(batchPrompt)
    const text = result.response.text()
    
    console.log(`🤖 배치 ${batchIndex} Gemini 응답 수신: ${text.length}자`)
    
    // JSON 배열 파싱
    try {
      let jsonText = text
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }
      
      // JSON 정화 적용
      jsonText = cleanupJSONString(jsonText)
      
      const analyses: ProductAnalysis[] = JSON.parse(jsonText)
        
        // 결과 개수 검증
        if (analyses.length !== batch.length) {
          console.warn(`⚠️ 배치 ${batchIndex}: 예상 ${batch.length}개, 실제 ${analyses.length}개 결과`)
          
          // 부족한 경우 기본값으로 채움
          while (analyses.length < batch.length) {
            const missingIndex = analyses.length
            analyses.push({
              hookingTitle: batch[missingIndex].title.slice(0, 20),
              hookingContent: "신선하고 품질 좋은 엄선된 상품입니다.",
              productCategory: 'OTHER' as const
            })
          }
        }
        
        const batchTime = Date.now() - batchStartTime
        console.log(`✅ 배치 ${batchIndex} 완료: ${batchTime}ms (평균: ${batchTime / batch.length}ms/개)`)

        // 가격정책 적용 처리 (디버깅 로그 강화)
        const processedAnalyses = analyses.map((analysis, index) => {
          const post = batch[index]

          // 디버깅: 가격정책 및 가격 추출 확인
          console.log(`\n🔍 배치 ${batchIndex} 상품 ${index + 1} 가격정책 적용 점검:`)
          console.log(`   정책 존재: ${!!post.pricingPolicy}`)
          console.log(`   정책 내용: ${post.pricingPolicy?.substring(0, 50)}...`)
          console.log(`   추출된 가격 (extractedPrice): ${analysis.extractedPrice}`)
          console.log(`   priceOptions: ${JSON.stringify(analysis.priceOptions)}`)

          // 🔧 extractedPrice가 없으면 priceOptions[0].price를 사용
          let finalExtractedPrice = analysis.extractedPrice
          if (!finalExtractedPrice && analysis.priceOptions && analysis.priceOptions.length > 0) {
            finalExtractedPrice = analysis.priceOptions[0].price
            console.log(`   🔧 fallback: priceOptions[0].price 사용 → ${finalExtractedPrice}원`)
          }

          // 가격정책이 있고 가격이 추출된 경우 정책 적용
          if (post.pricingPolicy && finalExtractedPrice) {
            console.log(`   ✅ 정책 적용 조건 충족 - applyPricingPolicyText() 호출`)
            const adjustedPrice = applyPricingPolicyText(finalExtractedPrice, post.pricingPolicy, analysis.shippingFee || 0)

            console.log(`   💰 정책 적용 완료: ${finalExtractedPrice}원 → ${adjustedPrice}원`)

            return {
              ...analysis,
              extractedPrice: finalExtractedPrice,  // ✅ fallback으로 채워진 가격 저장
              adjustedPrice: adjustedPrice,
              priceCalculation: {
                originalPrice: finalExtractedPrice,
                marginRate: parseFloat(((adjustedPrice - finalExtractedPrice) / finalExtractedPrice * 100).toFixed(2)),
                calculatedMargin: adjustedPrice - finalExtractedPrice,
                minimumMargin: 1000,
                finalMargin: adjustedPrice - finalExtractedPrice,
                adjustedPrice: adjustedPrice,
                appliedPolicy: post.pricingPolicy
              }
            }
          } else {
            console.log(`   ⚠️ 정책 미적용: ${!post.pricingPolicy ? '정책 없음' : '가격 추출 실패 (extractedPrice와 priceOptions 모두 없음)'}`)
          }

          // extractedPrice가 없었지만 fallback으로 채워진 경우 반영
          return {
            ...analysis,
            extractedPrice: finalExtractedPrice || analysis.extractedPrice
          }
        })

        console.log(`\n✅ 배치 ${batchIndex} 가격정책 적용 완료: ${processedAnalyses.filter(p => p.adjustedPrice).length}/${processedAnalyses.length}개 적용됨\n`)

        return processedAnalyses
      
    } catch (parseError) {
      console.error(`🚫 배치 ${batchIndex} JSON 파싱 실패:`, parseError)
      
      // 파싱 실패시 개별 분석으로 폴백
      const fallbackResults: ProductAnalysis[] = []
      for (const post of batch) {
        try {
          const analysis = post.pricingPolicy 
            ? await analyzeProductContentWithPolicy(post.title, post.content, post.comments, post.pricingPolicy)
            : await analyzeProductContent(post.title, post.content, post.comments)
          fallbackResults.push(analysis)
        } catch (error) {
          fallbackResults.push({
            hookingTitle: post.title.slice(0, 20),
            hookingContent: "신선하고 품질 좋은 엄선된 상품입니다.",
            productCategory: 'OTHER' as const
          })
        }
      }
      
      const batchTime = Date.now() - batchStartTime
      console.log(`⚡ 배치 ${batchIndex} 폴백 처리 완료: ${batchTime}ms`)
      
      return fallbackResults
    }
    
  } catch (error) {
    console.error(`🚫 배치 ${batchIndex} 처리 실패:`, error)

    // AI 분석 실패 시 에러를 던져서 상위에서 처리하도록 함
    throw new Error(`배치 ${batchIndex} AI 분석 완전 실패: ${error instanceof Error ? error.message : String(error)}`)
  }
}