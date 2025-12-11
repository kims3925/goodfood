'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, Check, AlertCircle, Sparkles, Zap, DollarSign, TestTube } from 'lucide-react'

interface AISettings {
  provider: 'gemini' | 'openai'
  geminiApiKey: string
  openaiApiKey: string
  geminiModel: string
  openaiModel: string
  temperature: number
  isValid?: boolean
}

export default function AISettingsPage() {
  const [settings, setSettings] = useState<AISettings>({
    provider: 'gemini',
    geminiApiKey: '',
    openaiApiKey: '',
    geminiModel: 'gemini-2.5-flash-lite',
    openaiModel: 'o3-mini',
    temperature: 0.7,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; response?: string } | null>(null)
  const [isTestSuccess, setIsTestSuccess] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/ai')
      const data = await response.json()

      if (data.success && data.settings) {
        setSettings({
          ...settings,
          geminiApiKey: data.settings.gemini?.apiKey || '',
          openaiApiKey: data.settings.openai?.apiKey || '',
          geminiModel: data.settings.gemini?.model || 'gemini-2.5-flash',
          openaiModel: data.settings.openai?.model || 'gpt-4o-mini',
          temperature: data.settings.gemini?.temperature || 0.7,
        })
      }
    } catch (error) {
      console.error('설정 로드 실패:', error)
    }
  }

  const saveSettings = async () => {
    try {
      setIsSaving(true)

      const response = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: settings.provider,
          settings: {
            apiKey: settings.provider === 'gemini' ? settings.geminiApiKey : settings.openaiApiKey,
            model: settings.provider === 'gemini' ? settings.geminiModel : settings.openaiModel,
            temperature: settings.temperature,
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        setTestResult(null)
        setIsTestSuccess(false)
        await loadSettings()
      } else {
      }
    } catch (error) {
      console.error('설정 저장 실패:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async () => {
    try {
      setIsTesting(true)
      setTestResult(null)
      setIsTestSuccess(false)

      const response = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: settings.provider,
          geminiApiKey: settings.geminiApiKey,
          openaiApiKey: settings.openaiApiKey,
          geminiModel: settings.geminiModel,
          openaiModel: settings.openaiModel,
        })
      })

      const data = await response.json()
      setTestResult(data)

      if (data.success) {
        setIsTestSuccess(true)
      }

    } catch (error) {
      setTestResult({
        success: false,
        message: '연결 테스트 중 오류가 발생했습니다.'
      })
      setIsTestSuccess(false)
    } finally {
      setIsTesting(false)
    }
  }

  const currentApiKey = settings.provider === 'gemini' ? settings.geminiApiKey : settings.openaiApiKey

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">AI 설정</h1>
          </div>
          <p className="text-gray-600">AI 제공업체 및 모델 설정을 관리합니다.</p>
        </div>

        {/* Settings Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                AI 제공업체 선택
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSettings(prev => ({ ...prev, provider: 'gemini' }))}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    settings.provider === 'gemini'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold text-gray-900">Google Gemini</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>• 무료: 1,000 요청/일 (Flash-Lite)</div>
                    <div>• 멀티모달 지원</div>
                    <div>• 빠른 응답 속도</div>
                  </div>
                </button>

                <button
                  onClick={() => setSettings(prev => ({ ...prev, provider: 'openai' }))}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    settings.provider === 'openai'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Zap className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-gray-900">OpenAI</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>• $5 무료 크레딧 (3개월)</div>
                    <div>• GPT-4o-mini 초저가</div>
                    <div>• 안정적인 성능</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Gemini Settings */}
            {settings.provider === 'gemini' && (
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Gemini 설정</h3>
                </div>

                {/* Gemini API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={settings.geminiApiKey}
                    onChange={(e) => {
                      setSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))
                      setIsTestSuccess(false)
                      setTestResult(null)
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder=""
                  />
                </div>

                {/* Gemini Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gemini 모델
                  </label>
                  <select
                    value={settings.geminiModel}
                    onChange={(e) => {
                      setSettings(prev => ({ ...prev, geminiModel: e.target.value }))
                      setIsTestSuccess(false)
                      setTestResult(null)
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (1,000 요청/일, 무료)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (250 요청/일)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (25 요청/일)</option>
                    <option value="gemma-3-12b-it">Gemma 3 12B (오픈소스, 경량)</option>
                    <option value="gemma-3-27b-it">Gemma 3 27B (오픈소스, 고성능)</option>
                  </select>
                </div>

                {/* Google AI Studio Button */}
                <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
                  <p className="text-xs text-purple-700 mb-3">
                    Google AI Studio에서 무료로 API 키를 발급받으세요
                  </p>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-md transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Google AI Studio 열기
                  </a>
                </div>
              </div>
            )}

            {/* OpenAI Settings */}
            {settings.provider === 'openai' && (
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">OpenAI 설정</h3>
                </div>

                {/* OpenAI API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={settings.openaiApiKey}
                    onChange={(e) => {
                      setSettings(prev => ({ ...prev, openaiApiKey: e.target.value }))
                      setIsTestSuccess(false)
                      setTestResult(null)
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="sk-proj로 시작하는 API 키"
                  />
                </div>

                {/* OpenAI Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OpenAI 모델
                  </label>
                  <select
                    value={settings.openaiModel}
                    onChange={(e) => {
                      setSettings(prev => ({ ...prev, openaiModel: e.target.value }))
                      setIsTestSuccess(false)
                      setTestResult(null)
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="o3-mini">o3-mini ($1.1/1M 입력, 추론 최적화)</option>
                    <option value="gpt-4o-mini">GPT-4o-mini ($0.15/1M 입력, 가성비)</option>
                    <option value="gpt-5-mini">GPT-5-mini (최신, 고성능)</option>
                    <option value="gpt-4o">GPT-4o ($2.5/1M 입력, 고성능)</option>
                  </select>
                </div>

                {/* Model Pricing Info */}
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">가격 정보</span>
                  </div>
                  <div className="text-xs text-green-700 space-y-1">
                    <div>• o3-mini: 입력 $1.1/1M, 출력 $4.4/1M (추론 최적화, 추천!)</div>
                    <div>• GPT-4o-mini: 입력 $0.15/1M, 출력 $0.6/1M (가성비)</div>
                    <div>• GPT-4o: 입력 $2.5/1M, 출력 $10/1M (고성능)</div>
                    <div>• 신규 사용자: $5 무료 크레딧 (3개월 유효)</div>
                  </div>
                </div>

                {/* OpenAI Platform Button */}
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <p className="text-xs text-green-700 mb-3">
                    OpenAI Platform에서 API 키를 발급받으세요
                  </p>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    OpenAI Platform 열기
                  </a>
                </div>
              </div>
            )}

            {/* Common Settings */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">공통 설정</h3>

              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  창의성 수준 (Temperature)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => setSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-gray-600 w-12">
                    {settings.temperature}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  0에 가까울수록 일관성 있는 결과, 2에 가까울수록 창의적인 결과
                </p>
              </div>

            </div>

            {/* Action Buttons */}
            <div className="border-t pt-6">
              {/* Test Result */}
              {testResult && (
                <div className={`mb-4 border rounded-md p-4 ${
                  testResult.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`text-sm font-semibold ${
                      testResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {testResult.success ? '✅ 연결 성공!' : '❌ 연결 실패'}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    testResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {testResult.message}
                  </p>
                </div>
              )}

              {/* Helper Text */}
              {!isTestSuccess && (
                <p className="text-xs text-gray-500 text-right mb-2">
                  * 연결 테스트를 먼저 완료해주세요
                </p>
              )}

              <div className="flex justify-end gap-3">
                {/* Connection Test Button */}
                <button
                  onClick={testConnection}
                  disabled={isTesting || !currentApiKey}
                  className={`flex items-center gap-2 px-6 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    settings.provider === 'gemini' ? 'bg-purple-500' : 'bg-green-500'
                  }`}
                >
                  {isTesting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      테스트 중...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4" />
                      연결 테스트
                    </>
                  )}
                </button>

                {/* Save Settings Button */}
                <button
                  onClick={saveSettings}
                  disabled={isSaving || !isTestSuccess}
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
                      설정 저장
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
