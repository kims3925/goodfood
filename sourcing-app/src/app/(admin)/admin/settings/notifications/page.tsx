'use client'

import { useState, useEffect } from 'react'
import { Settings, Bell, Save, TestTube, Check, AlertCircle, Mail, MessageSquare, Phone } from 'lucide-react'

interface NotificationSettings {
  emailEnabled: boolean
  emailAddress: string
  kakaoEnabled: boolean
  kakaoToken: string
  smsEnabled: boolean
  phoneNumber: string
  orderNotifications: boolean
  errorNotifications: boolean
  completionNotifications: boolean
  isValid?: boolean
}

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    emailAddress: '',
    kakaoEnabled: false,
    kakaoToken: '',
    smsEnabled: false,
    phoneNumber: '',
    orderNotifications: true,
    errorNotifications: true,
    completionNotifications: true
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/notifications')
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

      const response = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      const data = await response.json()

      if (data.success) {
        setTestResult(null) // 저장 후 테스트 결과 초기화
      } else {
      }
    } catch (error) {
      console.error('설정 저장 실패:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const testNotification = async () => {
    try {
      setIsLoading(true)
      setTestResult(null)

      const response = await fetch('/api/settings/notifications/test', {
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
        message: '알림 테스트 중 오류가 발생했습니다.'
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
            <Settings className="h-8 w-8 text-orange-600" />
            <h1 className="text-3xl font-bold text-gray-900">알림 설정</h1>
          </div>
          <p className="text-gray-600">주문, 에러, 작업 완료 등 각종 알림 설정을 관리합니다.</p>
        </div>

        {/* Notification Methods Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">알림 방식 설정</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              사용할 알림 방식을 설정하고 연결 정보를 입력합니다.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Email Notifications */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="h-5 w-5 text-blue-600" />
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.emailEnabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, emailEnabled: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">이메일 알림</span>
                </label>
              </div>

              {settings.emailEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이메일 주소
                  </label>
                  <input
                    type="email"
                    value={settings.emailAddress}
                    onChange={(e) => setSettings(prev => ({ ...prev, emailAddress: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="알림을 받을 이메일 주소를 입력하세요"
                  />
                </div>
              )}
            </div>

            {/* KakaoTalk Notifications */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="h-5 w-5 text-yellow-600" />
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.kakaoEnabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, kakaoEnabled: e.target.checked }))}
                    className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                  />
                  <span className="text-sm font-medium text-gray-700">카카오톡 알림</span>
                </label>
              </div>

              {settings.kakaoEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    카카오톡 API 토큰
                  </label>
                  <input
                    type="password"
                    value={settings.kakaoToken}
                    onChange={(e) => setSettings(prev => ({ ...prev, kakaoToken: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="카카오톡 알림톡 API 토큰을 입력하세요"
                  />
                </div>
              )}
            </div>

            {/* SMS Notifications */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <Phone className="h-5 w-5 text-green-600" />
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.smsEnabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, smsEnabled: e.target.checked }))}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">SMS 알림</span>
                </label>
              </div>

              {settings.smsEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    휴대폰 번호
                  </label>
                  <input
                    type="tel"
                    value={settings.phoneNumber}
                    onChange={(e) => setSettings(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="010-1234-5678"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notification Types Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">알림 유형 설정</h3>
            <p className="text-sm text-gray-500 mt-1">
              받고 싶은 알림 유형을 선택하세요.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.orderNotifications}
                onChange={(e) => setSettings(prev => ({ ...prev, orderNotifications: e.target.checked }))}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">주문 알림</span>
              <span className="text-xs text-gray-500">(새로운 주문이 들어왔을 때)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.errorNotifications}
                onChange={(e) => setSettings(prev => ({ ...prev, errorNotifications: e.target.checked }))}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">에러 알림</span>
              <span className="text-xs text-gray-500">(시스템 오류 발생시)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.completionNotifications}
                onChange={(e) => setSettings(prev => ({ ...prev, completionNotifications: e.target.checked }))}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">작업 완료 알림</span>
              <span className="text-xs text-gray-500">(자동화 작업 완료시)</span>
            </label>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`border rounded-md p-4 mb-6 ${
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
                {testResult.success ? '알림 테스트 성공!' : '알림 테스트 실패'}
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
        <div className="flex gap-3">
          <button
            onClick={testNotification}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                테스트 중...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4" />
                알림 테스트
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
  )
}