'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Settings, Save, RotateCcw, FileText, Info, Sparkles, DollarSign } from 'lucide-react'
import PolicyManager from '@/components/settings/PolicyManager'
import { DEFAULT_PRODUCT_EXTRACTION_PROMPT } from '@/modules/transformation/prompt-templates'

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
  const [prompt, setPrompt] = useState(DEFAULT_PRODUCT_EXTRACTION_PROMPT)

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
          setPrompt(DEFAULT_PRODUCT_EXTRACTION_PROMPT)
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
        setPrompt(DEFAULT_PRODUCT_EXTRACTION_PROMPT)
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
