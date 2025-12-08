'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, RotateCcw, FileText, Info } from 'lucide-react'

// 기본 프롬프트 템플릿
const DEFAULT_PROMPT = `당신은 한국 도매 쇼핑몰 상품 정보 추출 전문가입니다.

# 게시물
제목: {title}
내용: {content}
{policySection}
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

{pricingRule}

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
