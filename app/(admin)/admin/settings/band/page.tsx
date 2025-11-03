'use client'

import { useState, useEffect } from 'react'
import { Settings, Key, Save, TestTube, Check, AlertCircle } from 'lucide-react'

interface BandSettings {
  clientId: string
  clientSecret: string
  accessToken: string
  isValid?: boolean
}

export default function BandSettingsPage() {
  const [settings, setSettings] = useState<BandSettings>({
    clientId: '',
    clientSecret: '',
    accessToken: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/band')

      if (response.status === 401) {
        console.log('인증 필요 - 로그인 페이지로 리다이렉트')
        window.location.href = '/login'
        return
      }

      const data = await response.json()

      if (data.success) {
        setSettings(data.settings)
      } else {
        console.error('설정 로드 실패:', data.error)
      }
    } catch (error) {
      console.error('설정 로드 실패:', error)
    }
  }

  const saveSettings = async () => {
    try {
      setIsSaving(true)

      const response = await fetch('/api/settings/band', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      if (response.status === 401) {
        alert('인증이 필요합니다. 다시 로그인해주세요.')
        window.location.href = '/login'
        return
      }

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

      const response = await fetch('/api/settings/band/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      if (response.status === 401) {
        setTestResult({
          success: false,
          message: '인증이 필요합니다. 다시 로그인해주세요.'
        })
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
        return
      }

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
            <Settings className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">밴드 API 설정</h1>
          </div>
          <p className="text-gray-600">본인의 밴드 API 인증 정보를 설정하여 개인 밴드에 접근할 수 있습니다.</p>
        </div>

        {/* Band API Settings Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">밴드 API 설정</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              본인의 밴드 API 인증 정보를 입력하여 개인 밴드에 접근할 수 있습니다.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Client ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                클라이언트 ID
              </label>
              <input
                type="text"
                value={settings.clientId}
                onChange={(e) => setSettings(prev => ({ ...prev, clientId: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="밴드 개발자 센터에서 발급받은 Client ID를 입력하세요"
              />
            </div>

            {/* Client Secret */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                클라이언트 시크릿
              </label>
              <input
                type="password"
                value={settings.clientSecret}
                onChange={(e) => setSettings(prev => ({ ...prev, clientSecret: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="밴드 개발자 센터에서 발급받은 Client Secret을 입력하세요"
              />
            </div>

            {/* Access Token */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                액세스 토큰
              </label>
              <textarea
                value={settings.accessToken}
                onChange={(e) => setSettings(prev => ({ ...prev, accessToken: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="OAuth 인증을 통해 발급받은 Access Token을 입력하세요"
              />
            </div>

            {/* Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">📋 설정 가이드</h4>
              <ol className="text-xs text-blue-700 space-y-1 mb-4">
                <li>1. 아래 버튼을 클릭하여 밴드 개발자 센터에서 앱을 등록합니다</li>
                <li>2. Client ID와 Client Secret을 발급받습니다</li>
                <li>3. OAuth 인증을 통해 Access Token을 발급받습니다</li>
                <li>4. 발급받은 정보를 위 폼에 입력하고 연결 테스트를 진행합니다</li>
              </ol>
              
              {/* Band API 발급 받기 버튼 */}
              <div className="flex justify-center">
                <a
                  href="https://developers.band.us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  밴드 API 발급받으러 가기
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
                disabled={isLoading || !settings.accessToken}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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