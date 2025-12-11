'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, RotateCcw, FileText, Info } from 'lucide-react'

// 기본 프롬프트 템플릿 (product.transformer.ts와 동기화)
const DEFAULT_PROMPT = `당신은 한국 도매 쇼핑몰 상품 정보 추출 전문가입니다.

# 입력 데이터
제목: {title}
내용: {content}
{policySection}

---

# 🚫 수집 제외 규칙 (최우선 적용)

## 이미지 검증 (반드시 확인!)
다음 이미지는 **상품 이미지로 사용 불가**:
- ❌ 가격표, 가격 텍스트가 포함된 이미지
- ❌ 주문서, 입금 안내, 계좌번호 이미지
- ❌ 배송 안내문, 공지사항 이미지
- ❌ 프로필 사진, 로고, 배너 이미지
- ❌ 리뷰/후기 캡처 이미지
- ❌ 카카오톡/문자 대화 캡처
- ❌ 상품과 무관한 풍경, 인물 사진

✅ 사용 가능한 이미지:
- 상품 자체 사진 (원물, 포장 상태)
- 상품 활용 예시 (요리 완성 사진 등)
- 상품 상세 컷 (단면, 크기 비교 등)

## 게시물 검증
다음 게시물은 **상품 변환 불가**:
- ❌ 가격 정보가 전혀 없는 게시물
- ❌ 단순 홍보/인사 게시물
- ❌ 상품 없이 입금/배송 안내만 있는 글
- ❌ 품절/마감 공지
- ❌ 구인/구직 게시물

**상품 변환 불가 시 응답:**
{
  "error": "INVALID_POST",
  "reason": "상품 정보 없음 - 단순 공지 게시물",
  "extractable": false
}

---

# 📦 상품 정보 추출 규칙

## 1. 상품명 (카피형 네이밍, 20-35자)

### 네이밍 공식
[임팩트 키워드] + [원산지/브랜드] + [품질 수식어] + [상품명] + (옵션 요약)

### 임팩트 키워드 예시
| 카테고리 | 추천 키워드 |
|---------|-----------|
| 수산물 | 싱싱한, 통통한, 당일조업, 자연산, 활 |
| 농산물 | 꿀맛, 햇, 유기농, 무농약, 산지직송 |
| 가공식품 | N년전통, 수제, 프리미엄, 명품, 홈메이드 |
| 축산물 | 신선한, 1등급, 프리미엄, 한우, 국내산 |

### 작성 규칙
- 첫 단어에 임팩트 있는 형용사 배치
- 원산지/지역명으로 신뢰도 확보
- 느낌표는 최대 1개 (없어도 됨)
- 20~35자 이내로 간결하게

### 예시
✅ "싱싱한 통영산 활돌문어 (대/특대)"
✅ "꿀달수 무안 황토 고구마 10kg"
✅ "30년전통 울산 수제 치즈설기"
❌ "낙지" (너무 짧음)
❌ "최고급!!! 완전 맛있는!!!! 대박 고구마!!!!" (느낌표 과다)

---

## 2. 상품 설명 (200-500자, 마케팅 카피)

### 구조
[훅 문장 - 강렬한 첫인상]
+ [신뢰 포인트 - 원산지/제조방식/인증]
+ [감성 표현 - 맛/식감/향 묘사]
+ [활용법 - 요리/섭취 방법]
+ [마무리 - 추천/인기 강조]

### 감성 표현 사전
| 카테고리 | 표현 예시 |
|---------|---------|
| 식감 | 쫀득쫀득, 탱글탱글, 바삭바삭, 촉촉, 부드러운 |
| 맛 | 달콤한, 고소한, 감칠맛 나는, 깊은 맛, 시원한 |
| 신선도 | 싱싱한, 살아있는, 펄떡펄떡, 통통한 |
| 품질 | 엄선된, 정성껏, 직접 고른, 프리미엄 |

### 금지 표현
- ❌ 의학적 효능 단정 ("당뇨 치료", "암 예방")
- ❌ 허위 과장 ("세계 최고", "100% 완치")
- ❌ 경쟁사 비방

---

## 3. 카테고리 분류

| 카테고리 | 포함 품목 |
|---------|---------|
| 수산물 | 생선, 조개, 갑각류, 해조류, 젓갈 |
| 농산물 | 채소, 과일, 버섯, 곡물, 견과류 |
| 축산물 | 소고기, 돼지고기, 닭고기, 계란 |
| 가공식품 | 떡, 빵, 반찬, 면류, 즉석식품 |
| 장류 | 된장, 고추장, 간장, 청국장 |
| 음료/차 | 전통차, 음료, 식혜, 수정과 |
| 절임류 | 김치, 장아찌, 피클 |

---

## 4. 옵션 및 가격 추출 (핵심!)

### 가격 패턴 인식
일반: 48,000원, 48000원, ₩48,000, ￦48000
화살표: ➡️ 공급가 18,500원, ⏩ 39,000원
슬래시: 1키로: 35,000원, 10미/48,000
괄호: (5미 29,000원)

### 옵션 유형별 그룹명
| 옵션 유형 | groupName | values 예시 |
|----------|-----------|------------|
| 수량 | 수량 | 5미, 10마리, 20미 |
| 중량 | 중량 | 500g, 1kg, 3kg |
| 크기 | 크기/규격 | 소, 중, 대, 특대 |
| 구성 | 구성/세트 | A세트, 단품, 야채세트 |
| 맛/종류 | 종류 | 통팥, 야채, 김치 |

### 복합 옵션 처리
크기 + 수량이 결합된 경우:
"세발낙지 10미", "세발낙지 5미", "얼치기 10미"
→ groupName: "규격" (크기+수량 통합)

{pricingRule}

---

## 5. 배송비 추출

### 인식 패턴
포함: "택배비 포함", "배송비 포함", "무료배송"
별도: "배송비 별도 3,000원", "택배비 4,000원"
조건: "2박스 이상 무료", "5만원 이상 무배"

### 추출 규칙
- 금액이 명시되면 숫자로 추출
- "포함/무료"면 shippingFee: 0
- 정보 없으면 null

---

# 📋 데이터 구조 규칙 (필수!)

## 타입 규칙
| 필드 | 타입 | 예시 |
|-----|-----|-----|
| wholesalePrice | number | 48000 ✅ / "48000" ❌ |
| price | number | 48000 ✅ / "48,000원" ❌ |
| shippingFee | number 또는 null | 3000, 0, null |

## 필수 검증 항목
- variants 배열이 비어있지 않음 (최소 1개)
- 각 variant에 options 객체 포함
- options.values와 variants가 1:1 대응
- description이 200자 이상
- 모든 가격이 숫자 타입

---

# 📝 응답 형식

## 정상 응답 (순수 JSON, 마크다운 금지)
{
  "productName": "string (20-35자)",
  "description": "string (200-500자)",
  "category": "string",
  "options": [
    { "groupName": "string", "values": ["string"] }
  ],
  "pricing": {
    "wholesalePrice": number,
    "price": number,
    "currency": "KRW"
  },
  "variants": [
    {
      "optionSummary": "string",
      "options": { "groupName": "value" },
      "wholesalePrice": number,
      "price": number
    }
  ],
  "shipping": {
    "shippingFee": number 또는 null,
    "shippingInfo": "string 또는 null"
  },
  "validImages": ["사용 가능한 이미지 URL 목록"],
  "excludedImages": [
    { "url": "제외된 이미지 URL", "reason": "제외 사유" }
  ]
}

## 오류 응답
{
  "error": "INVALID_POST | NO_PRICE | NO_PRODUCT",
  "reason": "구체적인 사유",
  "extractable": false
}

---

# 💡 예시

## 예시1: 수산물 다중 옵션
입력:
제목: 고흥 활낙지
내용: 세발낙지 10마리 48,000원 (5미 29,000원)
얼치기 10마리 55,000원 (5미 32,500원)
소낙지 10마리 70,000원
택배비 별도 5,000원

출력:
{
  "productName": "당일조업 고흥 활낙지 (세발/얼치기/소)",
  "description": "펄떡펄떡 살아있는 고흥산 뻘낙지입니다! 서해안 청정 갯벌에서 당일 조업한 낙지를 산소포장으로 싱싱하게 보내드립니다. 세발낙지는 부드러운 식감으로 탕탕이와 연포탕에 제격이고, 얼치기는 적당한 씹는 맛으로 볶음 요리에 딱입니다. 소낙지는 통통하게 오른 살이 일품으로 회나 숙회로 즐기기 좋습니다. 산지 어부가 직접 선별해 크기와 신선도 모두 만족스러우실 거예요.",
  "category": "수산물",
  "options": [
    { "groupName": "규격", "values": ["세발 10미", "세발 5미", "얼치기 10미", "얼치기 5미", "소낙지 10미"] }
  ],
  "pricing": { "wholesalePrice": 29000, "price": 29000, "currency": "KRW" },
  "variants": [
    { "optionSummary": "세발 10미", "options": { "규격": "세발 10미" }, "wholesalePrice": 48000, "price": 48000 },
    { "optionSummary": "세발 5미", "options": { "규격": "세발 5미" }, "wholesalePrice": 29000, "price": 29000 },
    { "optionSummary": "얼치기 10미", "options": { "규격": "얼치기 10미" }, "wholesalePrice": 55000, "price": 55000 },
    { "optionSummary": "얼치기 5미", "options": { "규격": "얼치기 5미" }, "wholesalePrice": 32500, "price": 32500 },
    { "optionSummary": "소낙지 10미", "options": { "규격": "소낙지 10미" }, "wholesalePrice": 70000, "price": 70000 }
  ],
  "shipping": { "shippingFee": 5000, "shippingInfo": "택배비 별도 5,000원" },
  "validImages": [],
  "excludedImages": []
}

## 예시2: 변환 불가 게시물
입력:
제목: 공지사항
내용: 이번 주 금요일은 휴무입니다. 주문은 토요일부터 가능합니다.

출력:
{
  "error": "INVALID_POST",
  "reason": "상품 정보 없음 - 휴무 공지 게시물",
  "extractable": false
}

## 예시3: 농산물 단일 규격
입력:
제목: 무안 고구마
내용: 꿀고구마 10kg 39,000원

출력:
{
  "productName": "꿀달수 무안 황토 고구마 10kg",
  "description": "한 입 베어물면 입안 가득 퍼지는 달콤함! 무안 황토밭에서 정성껏 키운 베니하루카 품종 고구마입니다. 해풍과 황토의 미네랄을 듬뿍 머금어 당도가 남다릅니다. 에어프라이어에 구우면 꿀이 흘러내리고, 쪄서 먹으면 밤고구마 부럽지 않은 포슬포슬 식감! 아이 간식부터 다이어트 식단까지 두루 활용하기 좋습니다. 산지에서 당일 수확 후 바로 발송해 신선함이 다릅니다.",
  "category": "농산물",
  "options": [{ "groupName": "규격", "values": ["10kg"] }],
  "pricing": { "wholesalePrice": 39000, "price": 39000, "currency": "KRW" },
  "variants": [
    { "optionSummary": "10kg", "options": { "규격": "10kg" }, "wholesalePrice": 39000, "price": 39000 }
  ],
  "shipping": { "shippingFee": null, "shippingInfo": null },
  "validImages": [],
  "excludedImages": []
}

---

# ⚠️ 최종 체크리스트
- JSON만 응답 (마크다운 코드블록 사용 금지)
- 모든 가격 숫자 타입
- variants 최소 1개 이상
- description 200자 이상
- 이미지 검증 완료
- 상품 아닌 게시물은 error 응답`

interface PromptSettings {
  product_extraction: {
    promptType: string
    name: string
    prompt: string
    description: string | null
    isActive: boolean
  } | null
}

export default function PromptSettingsPage() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [name, setName] = useState('상품 변환 프롬프트')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/settings/prompt')
      const data = await response.json()

      if (data.success && data.settings) {
        const extractionConfig = data.settings.product_extraction
        if (extractionConfig) {
          setPrompt(extractionConfig.prompt)
          setName(extractionConfig.name)
          setDescription(extractionConfig.description || '')
          setHasCustomPrompt(true)
        } else {
          setPrompt(DEFAULT_PROMPT)
          setHasCustomPrompt(false)
        }
      }
    } catch (error) {
      console.error('설정 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setIsSaving(true)
      setSaveMessage(null)

      const response = await fetch('/api/settings/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          promptType: 'product_extraction',
          settings: {
            name,
            prompt,
            description: description || null,
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        setSaveMessage({ type: 'success', text: '프롬프트가 저장되었습니다.' })
        setHasCustomPrompt(true)
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage({ type: 'error', text: data.error || '저장에 실패했습니다.' })
      }
    } catch (error) {
      console.error('설정 저장 실패:', error)
      setSaveMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' })
    } finally {
      setIsSaving(false)
    }
  }

  const resetToDefault = async () => {
    if (!confirm('기본 프롬프트로 복구하시겠습니까? 커스텀 설정이 삭제됩니다.')) {
      return
    }

    try {
      const response = await fetch('/api/settings/prompt?promptType=product_extraction', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setPrompt(DEFAULT_PROMPT)
        setName('상품 변환 프롬프트')
        setDescription('')
        setHasCustomPrompt(false)
        setSaveMessage({ type: 'success', text: '기본값으로 복구되었습니다.' })
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage({ type: 'error', text: data.error || '복구에 실패했습니다.' })
      }
    } catch (error) {
      console.error('기본값 복구 실패:', error)
      setSaveMessage({ type: 'error', text: '복구 중 오류가 발생했습니다.' })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">프롬프트 설정</h1>
          </div>
          <p className="text-gray-600">AI가 게시물을 상품으로 변환할 때 사용하는 프롬프트를 설정합니다.</p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">변수 사용법</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li><code className="bg-blue-100 px-1 rounded">{'{title}'}</code> - 게시물 제목</li>
                <li><code className="bg-blue-100 px-1 rounded">{'{content}'}</code> - 게시물 내용</li>
                <li><code className="bg-blue-100 px-1 rounded">{'{policySection}'}</code> - 가격 정책 섹션 (선택적)</li>
                <li><code className="bg-blue-100 px-1 rounded">{'{pricingRule}'}</code> - 가격 추출 규칙</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">현재 상태:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                hasCustomPrompt
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {hasCustomPrompt ? '커스텀 프롬프트 사용 중' : '기본 프롬프트 사용 중'}
              </span>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                프롬프트 이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="프롬프트 이름을 입력하세요"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명 (선택)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="이 프롬프트에 대한 간단한 설명"
              />
            </div>

            {/* Prompt Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                프롬프트 내용
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={30}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="AI에게 전달할 프롬프트를 입력하세요"
              />
              <p className="text-xs text-gray-500 mt-1">
                총 {prompt.length.toLocaleString()}자
              </p>
            </div>

            {/* Save Message */}
            {saveMessage && (
              <div className={`p-4 rounded-md ${
                saveMessage.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {saveMessage.text}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center border-t pt-6">
              <button
                onClick={resetToDefault}
                disabled={!hasCustomPrompt}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                기본값으로 복구
              </button>

              <button
                onClick={saveSettings}
                disabled={isSaving || !prompt.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    저장
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
