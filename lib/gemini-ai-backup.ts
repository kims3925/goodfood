import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  throw new Error('GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable is required')
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

// 문자열 기반 가격정책 적용 함수
function applyPricingPolicyText(originalPrice: number, pricingPolicyText: string, shippingFee: number = 0): number {
  if (!pricingPolicyText || !originalPrice) {
    return originalPrice
  }

  let result = originalPrice

  // 1. 가족도매방: 원가 그대로
  if (pricingPolicyText.includes('원가 그대로')) {
    return originalPrice
  }

  // 2. 요한이네/초록이네: 기존가격 10,000원 구간별로 마진 1,000원씩 증가 (29,900원까지 +1,000원)
  if (pricingPolicyText.includes('기존가격 10,000원 구간별로 마진 1,000원씩 증가')) {
    const basePrice = originalPrice
    
    if (basePrice <= 29900) {
      result = basePrice + 1000 // 29,900원까지는 +1,000원
    } else {
      result = basePrice + 1000 // 29,900원 초과도 +1,000원 고정
    }
    
    return result
  }

  // 3. 나은VIP/SD: (공급가+배송비) 10,000원 구간별로 마진 1,000원씩 증가 (19,900원까지 +4,000원)
  if (pricingPolicyText.includes('(공급가+배송비) 10,000원 구간별로 마진 1,000원씩 증가')) {
    const basePrice = originalPrice + shippingFee
    
    if (basePrice <= 19900) {
      result = basePrice + 4000 // 19,900원까지는 +4,000원
    } else {
      // 19,900원 초과 시 구간별 계산: 20,000원부터 시작하여 10,000원마다 +1,000원
      const excess = basePrice - 19900
      const additionalSections = Math.ceil(excess / 10000) // 올림 처리로 구간 계산
      const additionalMargin = additionalSections * 1000
      result = basePrice + 4000 + additionalMargin
    }
    
    return result
  }

  // 기본값: 원가 그대로
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
다음은 도매 상품 게시물입니다. 판매용으로 최적화된 정보를 추출해 주세요.

[게시물 제목]
${title}

[게시물 내용]
${content}

[댓글들]
${comments.map((comment, index) => `댓글 ${index + 1}: ${comment}`).join('\n')}

아래 JSON 형식으로 정확히 응답해 주세요:

{
  "extractedPrice": 가장 낮은 가격 옵션의 가격 (숫자만, 원 단위),
  "salesUnit": "판매 단위 (kg, 개, 박스, 세트 등)",
  "shippingFee": 배송비 (숫자만, 원 단위, 무료배송은 0, 없으면 null),
  "hookingTitle": "업로드용 제목 (20자 - 핵심 상품명만, 가격/옵션/용량/무게 완전 제외)",
  "hookingContent": "소비자 구매 포인트 (가격/배송/정책/옵션/용량/무게/kg/개수 모든 수량정보 완전 제외, 품질/맛/원산지/신선도/영양/효능/특징/제조법/보관법 등 풍부한 내용, 150-200자)",
  "priceOptions": [
    {
      "option": "옵션명",
      "price": 가격(숫자)
    }
  ],
  "shippingPolicy": "배송 정책 (무료배송/배송비/합포 등)",
  "productCategory": "상품 분류 (SEAFOOD/MEAT/AGRICULTURE/PROCESSED/OTHER)",
  "hasDeadline": 마감시간 여부 (true/false),
  "deadlineInfo": "마감시간 정보",
  "specialNotes": "특이사항"
}

**추출 규칙**:

1. **업로드용 제목 (hookingTitle) - 완전한 수량정보 제외**:
   - 정확히 20자로 작성
   - ❌ 절대 금지: 가격, 옵션, 용량, 무게, kg, 개수, 박스수, 세트수 등 모든 수량정보 제외
   - ❌ 절대 금지: "3kg", "1박스", "12개입", "세트", "팩" 등 수량/용량 관련 단어 완전 금지
   - ✅ 포함 가능: 상품명, 등급, 품질, 원산지, 브랜드명만
   - 예: "프리미엄 로얄체리 직송품" (용량 제외), "국산 1등급 한우 직송" (무게 제외)

2. **소비자 구매 포인트 (hookingContent) - 풍부한 내용으로 확장**:
   - ❌ 절대 금지: 가격, 배송, 합배, 무료배송, 옵션, 용량, 무게, kg, 개수, 박스수, 세트수, 팩수 등 모든 수량/가격정보 완전 제외
   - ❌ 절대 금지: "원", "kg", "개", "박스", "세트", "팩", "무료배송", "배송비" 등 단어 완전 금지
   - ✅ 적극 포함: 품질, 맛, 원산지, 신선도, 영양, 효능, 제조방법, 보관방법, 재료 특성, 건강 이점, 조리법, 활용법, 브랜드 스토리, 생산자 정보 등
   - ✅ 감정적 어필: 맛의 특징, 식감, 향, 색감, 계절감, 프리미엄 느낌 등 감각적 표현 활용
   - ✅ 소비자 혜택: 건강 효과, 편의성, 특별함, 희소성, 안전성 등 구매 동기 강화
   - 150-200자로 풍부하게 작성

3. **가격 옵션 추출 (priceOptions) - 절대 금지 사항**:
   
   ❌ **절대 금지**: 가격을 단위당 가격으로 계산하여 표시하지 말 것!
   ❌ **절대 금지**: "22,500원/kg", "15,000원/개" 같은 단위별 가격 표시 금지!
   ❌ **추가옵션 제외**: "추가 구매 옵션", "추가 옵션", "추가옵션", "단독구매 불가" 등의 문구가 포함된 옵션은 완전 제외!
   
   ⚠️ **추가옵션 필터링 규칙**:
   - "추가 구매 옵션", "추가 옵션", "추가옵션" 문구 이후에 나오는 모든 옵션은 제외
   - "단독구매 불가", "별도 구매" 등이 포함된 옵션은 제외
   - 주요 상품 옵션만 추출하고, 부가적인 추가 구매 항목은 완전 제외
   ❌ **절대 금지**: 어떤 수학적 계산도 하지 말고 원문 그대로 추출!
   
   ✅ **반드시 준수**: 원문에 적힌 가격을 그대로 추출
   ✅ **반드시 준수**: 모든 가격 옵션을 빠뜨리지 말고 완전 추출
   ✅ **반드시 준수**: 각 옵션을 개별적으로 분리
   
   **올바른 체리 예시**:
   원문: "🔴(9.5 ROW) 체리 1kg➖공급가 22,500원(무료배송)🔴(9.5 ROW) 체리 2kg➖공급가 40,500원(무료배송)"
   → 올바른 결과:
   [
     {"option": "9.5ROW 체리 1kg", "price": 22500},
     {"option": "9.5ROW 체리 2kg", "price": 40500}
   ]
   
   **올바른 두리안 예시**:
   원문: "🟩 생 두리안 3kg내외 2수 ➡️ 공급가 40,000원(무료배송)🟩 생 두리안 4.5kg내외 3수 ➡️ 공급가 56,500원(무료배송)🟩 생 두리안 9kg내외 5~6수 ➡️ 공급가 108,000원(무료배송)"
   → 올바른 결과:
   [
     {"option": "생 두리안3Kg내외 2수", "price": 40000},
     {"option": "생 두리안4.5Kg내외 3수", "price": 56500},
     {"option": "생 두리안9kg내외 5~6수", "price": 108000}
   ]

4. **배송 정책 (shippingPolicy)**:
   - 무료배송/배송비/몇개당 부과/합포 정책을 한 줄로 정리
   - 예: "무료배송", "배송비 3,000원", "개당 배송비 2,500원, 합포 5개"

**중요**: 모든 가격은 "공급가"를 기준으로 하고, 이모지나 특수문자로 구분된 옵션들을 정확히 파싱하세요.

**📢 절대적 금지사항 (위반시 분석 실패)**:
1. ❌ 가격 뒤에 /kg, /개, /박스 등 단위별 가격 표시 절대 금지
2. ❌ 원문에 없는 계산된 가격 표시 절대 금지  
3. ❌ 22,500원을 22,500원/kg으로 변환하는 행위 절대 금지
4. ❌ 어떤 수학적 나눗셈이나 곱셈 계산도 절대 금지

**✅ 반드시 지켜야 할 사항**:
1. ✅ 원문에 "22,500원"이라고 적혀있으면 price: 22500 그대로 추출
2. ✅ 원문에 "40,500원"이라고 적혀있으면 price: 40500 그대로 추출  
3. ✅ 각 옵션의 정확한 옵션명과 가격을 그대로 추출
4. ✅ JSON 형식 준수, 숫자는 따옴표 없이 입력

**가격 옵션 추출 예시 (필수사항):**
예시 1 - 체리:
텍스트: "🔴(9.5 ROW) 체리 1kg➖공급가 22,500원(무료배송)🔴(9.5 ROW) 체리 2kg➖공급가 40,500원(무료배송)"
결과: [
  {"option": "9.5ROW 체리 1kg", "price": 22500, "unit": "kg", "description": "무료배송"},
  {"option": "9.5ROW 체리 2kg", "price": 40500, "unit": "kg", "description": "무료배송"}
]

예시 2 - 다양한 패턴:
텍스트: "A급 사과 1박스 15,000원\nB급 사과 2박스 25,000원\n특가 사과 5kg 35,000원"
결과: [
  {"option": "A급 사과 1박스", "price": 15000, "unit": "박스", "description": "A급"},
  {"option": "B급 사과 2박스", "price": 25000, "unit": "박스", "description": "B급"},
  {"option": "특가 사과 5kg", "price": 35000, "unit": "kg", "description": "특가"}
]

**중요**: 이모지(🔴), 화살표(➖), 줄바꿈으로 구분된 **모든** 가격 정보를 찾아서 각각 별도의 옵션으로 추출하세요!
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
다음은 도매 상품 게시물과 댓글, 그리고 이 소싱처의 가격정책입니다. 
상품 정보를 정교하게 분석하고 가격정책에 따라 적절한 판매가격을 계산해 주세요.

[게시물 제목]
${title}

[게시물 내용]
${content}

[댓글들]
${comments.map((comment, index) => `댓글 ${index + 1}: ${comment}`).join('\n')}

[가격정책]
${pricingPolicy}

위 정보를 분석하여 다음 JSON 형식으로 응답해 주세요:

{
  "extractedPrice": 가장 낮은 가격 옵션의 가격 (숫자만, 원 단위 - 여러 옵션이 있으면 최저가),
  "adjustedPrice": 정책 적용된 최종 판매가 (숫자만, 원 단위),
  "salesUnit": "판매 단위 (예: kg, 개, 박스, 세트 등)",
  "shippingFee": 배송비 (숫자만, 원 단위, 무료배송은 0, 없으면 null),
  "priceInfo": "가격 및 배송정책 원문 전체 텍스트 - 모든 가격 옵션을 포함한 완전한 가격표 (예: '1.5kg 13,000원 무료배송, 3kg 23,500원 무료배송, 6kg 37,500원 무료배송' 형태로 모든 옵션과 가격을 누락없이 포함)",
  "priceOptions": [
    {
      "option": "상품 옵션명 (예: 1.5kg, 3kg 등)",
      "price": 가격 (숫자),
      "unit": "단위",
      "description": "옵션 설명 (있다면)"
    }
  ],
  "shippingPolicy": "배송 정책 정보 (무료배송/배송비/합포 등)",
  "hookingTitle": "정확히 20자로 제품명과 핵심 특징만 포함한 제목 (가격/용량/수량정보 완전 제외, 예: '국산 1등급 한우 직송품')",
  "hookingContent": "소비자 관점에서 구매 결정을 돕는 풍부한 내용 (가격/배송/용량/수량정보 완전 제외, 품질/맛/원산지/신선도/영양/효능/제조법/보관법/특징/건강혜택/조리활용법 등 상세하게 150-200자로 작성)",
  "detailedContent": "상품 상세 설명 (원본 내용을 기반으로 정리된 완전한 상품 정보)",
  "finalPolicyPrice": 판매정책 반영 최종가 (adjustedPrice와 같은 값),
  "hasDeadline": 마감 기한이 있는지 (true/false),
  "deadlineInfo": "마감 정보 (있다면)",
  "specialNotes": "특이사항 (마감, 한정수량, 특별조건, 주의사항 등)",
  "productCategory": 상품 분류 ("SEAFOOD" | "MEAT" | "AGRICULTURE" | "PROCESSED" | "OTHER"),
  "priceCalculation": {
    "originalPrice": 원가,
    "marginRate": 적용된 마진율(%) 또는 0,
    "calculatedMargin": 계산된 마진금액,
    "minimumMargin": 최소 마진금액,
    "finalMargin": 최종 적용된 마진금액,
    "adjustedPrice": 최종 판매가,
    "appliedPolicy": "적용된 정책 요약 설명"
  }
}

**📢 절대적 금지사항 (위반시 분석 실패)**:
1. ❌ 가격 뒤에 /kg, /개, /박스 등 단위별 가격 표시 절대 금지
2. ❌ 원문에 없는 계산된 가격 표시 절대 금지  
3. ❌ 22,500원을 22,500원/kg으로 변환하는 행위 절대 금지
4. ❌ 어떤 수학적 나눗셈이나 곱셈 계산도 절대 금지

**✅ 반드시 지켜야 할 사항**:
1. ✅ 원문에 "22,500원"이라고 적혀있으면 price: 22500 그대로 추출
2. ✅ 원문에 "40,500원"이라고 적혀있으면 price: 40500 그대로 추출  
3. ✅ 각 옵션의 정확한 옵션명과 가격을 그대로 추출
4. ✅ JSON 형식 준수, 숫자는 따옴표 없이 입력

**중요 지침**:
1. hookingTitle은 **정확히 20자**로 작성 (19자 이하, 21자 이상 금지)
2. hookingTitle에는 가격/용량/수량정보 완전 제외하고 핵심 특징만 포함:
   - ✅ 제품명 + 등급/품질 정보 (예: '1등급', '국산', '프리미엄')
   - ❌ 중량/수량 정보는 절대 포함 금지 (kg, 개, 박스, 세트 등)
   - ❌ 할인/특가/가격 정보도 절대 포함 금지
3. hookingContent는 소비자 관심을 끌고 구매 결정을 돕는 풍부한 내용:
   - ✅ **적극적으로 포함**: 품질, 맛, 식감, 향, 색감, 원산지, 신선도, 영양성분, 건강효능, 제조방법, 보관방법, 조리법, 활용법, 계절감, 프리미엄 요소, 브랜드 스토리, 생산자 정보 등
   - ✅ **감각적 표현**: "달콤한", "부드러운", "신선한", "깊은 맛", "진한 향" 등 맛과 품질을 생생하게 표현
   - ✅ **건강 혜택**: "영양가 풍부한", "건강에 좋은", "면역력 증진", "피로회복" 등 건강 관련 혜택 강조
   - ✅ **특별함**: "한정 공급", "엄선된", "프리미엄", "직송" 등 차별화 요소 부각
   - ❌ **완전 금지**: 가격, 배송, 용량, 수량, kg, 개수, 박스수 등 모든 수량/가격정보 완전 제외
   - 150-200자 분량으로 풍부하게 작성
4. **priceOptions 추출 (절대 금지 사항)**: 
   ❌ **추가옵션 제외**: "추가 구매 옵션", "추가 옵션", "추가옵션", "단독구매 불가" 등의 문구가 포함된 옵션은 완전 제외!
   
   ⚠️ **추가옵션 필터링 규칙**:
   - "추가 구매 옵션", "추가 옵션", "추가옵션" 문구 이후에 나오는 모든 옵션은 제외
   - "단독구매 불가", "별도 구매" 등이 포함된 옵션은 제외
   - 주요 상품 옵션만 추출하고, 부가적인 추가 구매 항목은 완전 제외
   
   ✅ 올바른 예시:
   원문: "🔴(9.5 ROW) 체리 1kg➖공급가 22,500원(무료배송)🔴(9.5 ROW) 체리 2kg➖공급가 40,500원(무료배송)"
   → 올바른 결과: [{"option": "9.5ROW 체리 1kg", "price": 22500}, {"option": "9.5ROW 체리 2kg", "price": 40500}]
   
   ✅ 추가옵션 제외 예시:
   원문: "🔥 하모회 1팩 (300g 내외)+초장 29,000원 🔥 하모샤브 1팩 (300g 내외)+뼈 동봉 30,000원 추가 구매 옵션 🔥 +하모 육수원액 1팩 100g 3,000원 (단독구매 불가)"
   → 올바른 결과: [{"option": "하모회 1팩 (300g 내외)+초장", "price": 29000}, {"option": "하모샤브 1팩 (300g 내외)+뼈 동봉", "price": 30000}]
   → ❌ 제외됨: 하모 육수원액 (추가 구매 옵션이므로 제외)
5. extractedPrice는 **가장 기본 단위**의 최소 가격만 숫자로 추출
6. priceInfo는 **원문 그대로** 모든 가격 관련 정보 포함 (댓글 포함)
7. adjustedPrice는 가격정책을 적용한 최종 판매가 
8. finalPolicyPrice는 adjustedPrice와 동일한 값으로 설정
9. specialNotes에는 마감, 한정, 특별조건 등 모든 특이사항 포함
10. 가격정책을 꼼꼼히 분석하여 마진율, 최소마진, 배송비 등 고려
11. JSON 형식 준수, 숫자는 따옴표 없이 입력
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
  batchSize: number = 6,        // Ultra 최적화: 6개로 증가
  maxConcurrency: number = 5    // Ultra 최적화: 5개로 증가
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
      
      // 그룹 간 간격으로 API 제한 방지
      if (groupIndex < batchGroups.length - 1) {
        console.log('⏳ 다음 그룹 처리 전 대기 중... (500ms)')
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log(`🎉 병렬 배치 분석 완료: ${results.length}개 결과`)
    return results
    
  } catch (error) {
    console.error('🚫 병렬 배치 분석 오류:', error)
    
    // 실패 시 기존 순차 방식으로 폴백
    console.log('📋 순차 방식으로 폴백 처리...')
    return await batchAnalyzeProducts(posts.map(post => ({
      title: post.title,
      content: post.content,
      comments: post.comments
    })))
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    // 배치용 통합 프롬프트 생성
    const batchPrompt = `
다음 ${batch.length}개의 도매 상품 게시물을 한 번에 분석해주세요.

${batch.map((post, index) => `
=== 상품 ${index + 1} ===
제목: ${post.title}
내용: ${post.content}
댓글: ${post.comments.join(', ')}
${post.pricingPolicy ? `가격정책: ${post.pricingPolicy}` : ''}
`).join('\n')}

각 상품에 대해 다음 JSON 배열 형식으로 정확히 응답해주세요:

[
  {
    "extractedPrice": 첫 번째 상품의 가장 낮은 가격 (숫자만),
    "hookingTitle": "정확히 20자로 제품명과 핵심 특징만 포함한 제목",
    "hookingContent": "소비자 관점의 구매 결정 도움 내용 (150-200자)",
    "productCategory": "SEAFOOD|MEAT|AGRICULTURE|PROCESSED|OTHER",
    "priceOptions": [{"option": "옵션명", "price": 가격}],
    "shippingFee": 배송비 (숫자, 무료시 0),
    "hasDeadline": 마감기한 여부 (true/false),
    "deadlineInfo": "마감 정보 (있다면)"
  },
  // ... ${batch.length}개 상품 모두에 대한 분석 결과
]

중요: 반드시 ${batch.length}개의 객체를 포함한 JSON 배열로만 응답하세요.`

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
        
        // 가격정책 적용 처리
        const processedAnalyses = analyses.map((analysis, index) => {
          const post = batch[index]
          
          // 가격정책이 있고 가격이 추출된 경우 정책 적용
          if (post.pricingPolicy && analysis.extractedPrice) {
            const adjustedPrice = applyPricingPolicyText(analysis.extractedPrice, post.pricingPolicy, analysis.shippingFee || 0)
            
            return {
              ...analysis,
              adjustedPrice: adjustedPrice,
              priceCalculation: {
                originalPrice: analysis.extractedPrice,
                marginRate: ((adjustedPrice - analysis.extractedPrice) / analysis.extractedPrice * 100).toFixed(2),
                calculatedMargin: adjustedPrice - analysis.extractedPrice,
                minimumMargin: 1000,
                finalMargin: adjustedPrice - analysis.extractedPrice,
                adjustedPrice: adjustedPrice,
                appliedPolicy: post.pricingPolicy
              }
            }
          }
          
          return analysis
        })
        
        return processedAnalyses
      
      throw new Error('JSON 배열을 찾을 수 없음')
      
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
    
    // 완전 실패시 기본값 반환
    return batch.map(post => ({
      hookingTitle: post.title.slice(0, 20),
      hookingContent: "신선하고 품질 좋은 엄선된 상품입니다.",
      productCategory: 'OTHER' as const
    }))
  }
}