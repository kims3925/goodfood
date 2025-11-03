'use client'

import { useState, useEffect } from 'react'
import { Settings, CreditCard, Save, TestTube, Check, AlertCircle, Globe } from 'lucide-react'

interface StrokePaySettings {
  apiKey: string
  secretKey: string
  merchantId: string
  isTestMode: boolean
  isValid?: boolean
}

export default function StrokePaySettingsPage() {
  const [settings, setSettings] = useState<StrokePaySettings>({
    apiKey: '',
    secretKey: '',
    merchantId: '',
    isTestMode: true
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/strokepay')
      const data = await response.json()

      if (data.success) {
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('설정 로드 실패:', error)
    }
  }

  const saveSettings = async () => {
    try {
      setIsSaving(true)

      const response = await fetch('/api/settings/strokepay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      const data = await response.json()

      if (data.success) {
        alert('설정이 저장되었습니다!')
        setTestResult(null) // 저장 후 테스트 결과 초기화
      } else {
        alert('설정 저장 실패: ' + data.error)
      }
    } catch (error) {
      console.error('설정 저장 실패:', error)
      alert('설정 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async () => {
    try {
      setIsLoading(true)
      setTestResult(null)

      const response = await fetch('/api/settings/strokepay/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      const data = await response.json()
      setTestResult(data)

    } catch (error) {
      setTestResult({
        success: false,
        message: '연결 테스트 중 오류가 발생했습니다.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">스룩페이 설정</h1>
          </div>
          <p className="text-gray-600">스룩페이 계정 설정 및 자동화 옵션을 관리합니다.</p>
        </div>

        {/* StrokePay Settings Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">스룩페이 API 설정</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              스룩페이 API 인증 정보를 입력하여 결제 서비스에 연결합니다.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="text"
                value={settings.apiKey}
                onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="스룩페이에서 발급받은 API Key를 입력하세요"
              />
            </div>

            {/* Secret Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secret Key
              </label>
              <input
                type="password"
                value={settings.secretKey}
                onChange={(e) => setSettings(prev => ({ ...prev, secretKey: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="스룩페이에서 발급받은 Secret Key를 입력하세요"
              />
            </div>

            {/* Merchant ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상점 ID
              </label>
              <input
                type="text"
                value={settings.merchantId}
                onChange={(e) => setSettings(prev => ({ ...prev, merchantId: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="스룩페이 상점 ID를 입력하세요"
              />
            </div>

            {/* Test Mode Toggle */}
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.isTestMode}
                  onChange={(e) => setSettings(prev => ({ ...prev, isTestMode: e.target.checked }))}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">테스트 모드 사용</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-7">
                테스트 모드에서는 실제 결제가 발생하지 않습니다.
              </p>
            </div>

            {/* Help Section */}
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-green-800 mb-2">📋 설정 가이드</h4>
              <ol className="text-xs text-green-700 space-y-1 mb-4">
                <li>1. 아래 버튼을 클릭하여 스룩페이 관리자 페이지에 접속합니다</li>
                <li>2. API Key, Secret Key, 상점 ID를 확인합니다</li>
                <li>3. 발급받은 정보를 위 폼에 입력하고 연결 테스트를 진행합니다</li>
                <li>4. 테스트 완료 후 실제 서비스에서 사용할 때는 테스트 모드를 해제합니다</li>
              </ol>

              {/* StrokePay 관리자 페이지 버튼 */}
              <div className="flex justify-center">
                <a
                  href="https://strokepay.com/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <Globe className="w-4 h-4" />
                  스룩페이 관리자 페이지
                </a>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`border rounded-md p-4 ${
                testResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult.success ? '연결 성공!' : '연결 실패'}
                  </span>
                </div>
                <p className={`text-xs mt-1 ${
                  testResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {testResult.message}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={testConnection}
                disabled={isLoading || !settings.apiKey || !settings.secretKey}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
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

              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  )
}