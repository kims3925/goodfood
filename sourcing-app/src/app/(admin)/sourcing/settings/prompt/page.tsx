'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Settings, Save, RotateCcw, FileText, Info, Sparkles, DollarSign } from 'lucide-react'
import PolicyManager from '@/components/settings/PolicyManager'

// 기본 프롬프트 템플릿 (product.transformer.ts와 동기화)
const DEFAULT_PROMPT = `당신은 한국 도매 쇼핑몰 상품 정보 추출 전문가입니다.

# 입력 데이터
제목: {title}
내용: {content}
{policySection}

---

# 🚫 수집 제외 규칙

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
❌ "낙지!!!" (너무 짧거나 느낌표 등의 표현이 과다함)

---

## 2. 상품 설명 (300-600자, 번호+글머리 서식 필수!)

### 서식 규칙 (반드시 적용)
- 번호 제목: 1. 제목명, 2. 제목명 형식
- 글머리 기호: • 로 세부 내용 나열
- 괄호 보충: (보충 설명) 형식
- 이모지: 적절히 사용 (😊 👍 등)

### 필수 섹션 (4개)
1. 크기/용량/규격
• 구체적 수치 (길이, 무게, 용량 등)
• 비교 표현 (일반 제품 대비 차별점)

2. 신선도/원산지/제조방식
• 산지직송, 당일작업 등 신선도 강조
• 원산지, 생산방식 설명

3. 맛/식감/품질
• 맛 표현 (고소한, 달콤한, 감칠맛 등)
• 식감 표현 (바삭, 촉촉, 쫄깃 등)

4. 섭취방법/보관방법/손질여부
• 조리법, 활용법
• 보관 안내

### 선택 섹션 (원본에 정보 있을 때만 추가)
5. 주문/배송 안내 (선택)
• 주문 마감: 매일 오후 N시
• 발송일: 주문 후 N일 이내
• 출고 요일: 매주 월/수/금

### 금지
- ❌ 의학적 효능 ("당뇨 치료", "암 예방")
- ❌ 서식 미적용 (번호, 글머리 없이 문장 나열 금지)
- ❌ description에 가격 텍스트 금지 (가격은 pricing/variants 필드에만)

---

## 3. 옵션 및 가격 추출

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

## 4. 배송비 및 합배송 추출

### 배송비 인식 패턴
포함: "택배비 포함", "배송비 포함", "무료배송"
별도: "배송비 별도 3,000원", "택배비 4,000원"
조건: "2박스 이상 무료", "5만원 이상 무배"

### 합배송 인식 패턴
"3세트까지 합배송", "합배송 3개", "묶음배송 2개까지"
"2세트 이상 배송비 할인", "3박스 동봉 가능"
"2세트(4박스)까지 합배송" → bundleMaxQty: 4

### 추출 규칙
- 배송비 금액이 명시되면 숫자로 추출
- "포함/무료"면 shippingFee: 0
- 정보 없으면 null
- 합배송 최대 수량 추출 (숫자로 명시된 경우)
- 합배송 언급 없으면 bundleMaxQty: 1 (합배송 불가)

### 옵션별 합배송 단위 (bundleUnit)
- 합배송 한도의 단위를 파악 (박스, kg, 개, 세트 등)
- 각 옵션명에서 해당 단위의 수량을 추출하여 variants에 bundleUnit 추가
- 예: "4박스까지 합배송", 옵션 "2박스(2.8kg)" → bundleUnit: 2
- 예: "5kg까지 합배송", 옵션 "2kg" → bundleUnit: 2
- 단위가 명확하지 않으면 bundleUnit: 1 (기본값)

---

# 📋 데이터 구조 규칙 (필수!)

## 타입 규칙
| 필드 | 타입 | 예시 |
|-----|-----|-----|
| wholesalePrice | number | 48000 ✅ / "48000" ❌ |
| price | number | 48000 ✅ / "48,000원" ❌ |
| shippingFee | number 또는 null | 3000, 0, null |

---

# 📝 응답 형식

## 정상 응답 (순수 JSON, 마크다운 금지)
{
  "productName": "string (20-35자)",
  "description": "string (300-600자)",
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
      "price": number,
      "bundleUnit": number (기본값 1, 합배송 단위 수)
    }
  ],
  "shipping": {
    "shippingFee": number 또는 null,
    "shippingInfo": "string 또는 null",
    "bundleMaxQty": number (기본값 1, 합배송 가능하면 2 이상)
  }
}

---

# 💡 예시

## 예시: 수산물 다중 옵션
입력:
제목: 고흥 활낙지
내용: 세발낙지 10마리 48,000원 (5미 29,000원)
얼치기 10마리 55,000원 (5미 32,500원)
소낙지 10마리 70,000원
택배비 별도 5,000원

출력:
{
  "productName": "당일조업 고흥 활낙지 (세발/얼치기/소)",
  "description": "1. 크기와 규격\\n• 세발낙지: 다리가 가늘고 부드러운 소형 낙지\\n• 얼치기: 중간 크기로 적당한 식감\\n• 소낙지: 통통하게 살이 오른 대형 낙지\\n• 마리당 100~300g 내외\\n\\n2. 신선도와 원산지\\n• 전남 고흥 청정 갯벌에서 당일 조업!\\n• 펄떡펄떡 살아있는 상태로 산소포장\\n• 받으시면 아직도 움직이는 낙지를 확인하실 수 있어요.\\n\\n3. 맛과 품질\\n• 갯벌에서 자란 뻘낙지 특유의 고소한 맛!\\n• 비린내 없이 감칠맛이 가득합니다.\\n• 산지 어부가 직접 선별하여 품질 보장 😊\\n\\n4. 추천 요리법\\n• 세발낙지: 탕탕이, 연포탕, 낙지전골\\n• 얼치기/소낙지: 낙지볶음, 낙지숙회, 산낙지회",
  "category": "수산물",
  "options": [
    { "groupName": "규격", "values": ["세발 10미", "세발 5미", "얼치기 10미", "얼치기 5미", "소낙지 10미"] }
  ],
  "pricing": { "wholesalePrice": 29000, "price": 29000, "currency": "KRW" },
  "variants": [
    { "optionSummary": "세발 10미", "options": { "규격": "세발 10미" }, "wholesalePrice": 48000, "price": 48000, "bundleUnit": 1 },
    { "optionSummary": "세발 5미", "options": { "규격": "세발 5미" }, "wholesalePrice": 29000, "price": 29000, "bundleUnit": 1 },
    { "optionSummary": "얼치기 10미", "options": { "규격": "얼치기 10미" }, "wholesalePrice": 55000, "price": 55000, "bundleUnit": 1 },
    { "optionSummary": "얼치기 5미", "options": { "규격": "얼치기 5미" }, "wholesalePrice": 32500, "price": 32500, "bundleUnit": 1 },
    { "optionSummary": "소낙지 10미", "options": { "규격": "소낙지 10미" }, "wholesalePrice": 70000, "price": 70000, "bundleUnit": 1 }
  ],
  "shipping": { "shippingFee": 5000, "shippingInfo": "택배비 별도 5,000원", "bundleMaxQty": 1 }
}

---

# ⚠️ 최종 체크리스트
- JSON만 응답 (마크다운 코드블록 사용 금지)
- variants 배열이 비어있지 않음 (최소 1개)
- 각 variant에 options 객체 포함
- options.values와 variants가 1:1 대응
- description 300자 이상
- 모든 가격이 숫자 타입
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

type TabType = 'prompt' | 'policy'

export default function AISettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<TabType>(tabParam === 'policy' ? 'policy' : 'prompt')
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)

  // URL 파라미터 변경 시 탭 동기화
  useEffect(() => {
    if (tabParam === 'policy') {
      setActiveTab('policy')
    } else {
      setActiveTab('prompt')
    }
  }, [tabParam])

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    // URL 업데이트 (히스토리에 추가하지 않음)
    const url = tab === 'policy' ? '/sourcing/settings/prompt?tab=policy' : '/sourcing/settings/prompt'
    router.replace(url)
  }
  const [name, setName] = useState('상품 변환 프롬프트')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showResetModal, setShowResetModal] = useState(false)

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

  const handleResetConfirm = async () => {
    setShowResetModal(false)

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

  const handlePolicyToast = (type: 'success' | 'error', message: string) => {
    setSaveMessage({ type, text: message })
    setTimeout(() => setSaveMessage(null), 3000)
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
            <Sparkles className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">AI 변환 설정</h1>
          </div>
          <p className="text-gray-600">AI가 게시물을 상품으로 변환할 때 사용하는 프롬프트와 가격 정책을 관리합니다.</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-t-lg border border-b-0 border-gray-200">
          <div className="flex">
            <button
              onClick={() => handleTabChange('prompt')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'prompt'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileText size={18} />
              프롬프트
            </button>
            <button
              onClick={() => handleTabChange('policy')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'policy'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <DollarSign size={18} />
              가격 정책
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-lg shadow-sm border border-gray-200">
          {/* Save Message (공통) */}
          {saveMessage && (
            <div className={`mx-6 mt-6 p-4 rounded-md ${
              saveMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {saveMessage.text}
            </div>
          )}

          {activeTab === 'prompt' ? (
            <div className="p-6 space-y-6">
              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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

              {/* Action Buttons */}
              <div className="flex justify-between items-center border-t pt-6">
                <button
                  onClick={() => setShowResetModal(true)}
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
          ) : (
            <div className="p-6">
              <PolicyManager onToast={handlePolicyToast} />
            </div>
          )}
        </div>
      </div>

      {/* 복구 확인 모달 */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">기본 프롬프트로 복구</h3>
              <p className="text-gray-600">
                기본 프롬프트로 복구하시겠습니까? 커스텀 설정이 삭제됩니다.
              </p>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleResetConfirm}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                복구
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
