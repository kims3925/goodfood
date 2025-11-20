'use client'

import { useState, useEffect } from 'react'
import { Settings, Key, Save, TestTube, Check, AlertCircle, Store, Globe, ShoppingBag, Package, FileText } from 'lucide-react'

interface APISettings {
  // Band API
  band: {
    clientId: string
    clientSecret: string
    accessToken: string
    refreshToken: string
  }
  // AliExpress API
  aliexpress: {
    apiKey: string
    appSecret: string
    accessToken: string
    trackingId: string
  }
  // 향후 확장: Taobao, 1688, Coupang, etc.
  taobao?: {
    apiKey: string
    appSecret: string
  }
  coupang?: {
    accessKey: string
    secretKey: string
  }
  mall1688?: {
    apiKey: string
    appSecret: string
  }
}

type APIProvider = 'band' | 'aliexpress' | 'taobao' | 'coupang' | 'mall1688'

interface TabConfig {
  id: APIProvider
  label: string
  icon: React.ReactNode
  badge?: string
  enabled: boolean
}

export default function APISettingsPage() {
  const [activeTab, setActiveTab] = useState<APIProvider>('band')
  const [settings, setSettings] = useState<APISettings>({
    band: {
      clientId: '',
      clientSecret: '',
      accessToken: '',
      refreshToken: ''
    },
    aliexpress: {
      apiKey: '',
      appSecret: '',
      accessToken: '',
      trackingId: ''
    }
  })
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const tabs: TabConfig[] = [
    {
      id: 'band',
      label: 'Band API',
      icon: <Store className="w-5 h-5" />,
      enabled: true
    },
    {
      id: 'aliexpress',
      label: 'AliExpress API',
      icon: <Globe className="w-5 h-5" />,
      badge: 'NEW',
      enabled: true
    },
    {
      id: 'taobao',
      label: 'Taobao API',
      icon: <ShoppingBag className="w-5 h-5" />,
      badge: 'SOON',
      enabled: false
    },
    {
      id: 'coupang',
      label: 'Coupang API',
      icon: <Package className="w-5 h-5" />,
      badge: 'SOON',
      enabled: false
    },
    {
      id: 'mall1688',
      label: '1688.com API',
      icon: <ShoppingBag className="w-5 h-5" />,
      badge: 'SOON',
      enabled: false
    }
  ]

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/api')
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

      const response = await fetch('/api/settings/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: activeTab, settings: settings[activeTab] })
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ 설정이 저장되었습니다!')
        setTestResult(null)
      } else {
        alert('❌ 설정 저장 실패: ' + data.error)
      }
    } catch (error) {
      console.error('설정 저장 실패:', error)
      alert('❌ 설정 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async () => {
    try {
      setTestResult(null)

      const response = await fetch('/api/settings/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: activeTab, settings: settings[activeTab] })
      })

      const data = await response.json()
      setTestResult(data)

      if (data.success) {
        alert('✅ 연결 테스트 성공!')
      } else {
        alert('❌ 연결 테스트 실패: ' + data.message)
      }
    } catch (error) {
      console.error('연결 테스트 실패:', error)
      setTestResult({
        success: false,
        message: '연결 테스트 중 오류가 발생했습니다.'
      })
    }
  }

  const updateSetting = (provider: APIProvider, field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value
      }
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-500" />
          API 설정
        </h1>
        <p className="text-gray-600 mt-2">도매 소싱 API 연동 설정을 관리합니다.</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.enabled && setActiveTab(tab.id)}
                disabled={!tab.enabled}
                className={`
                  flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap
                  border-b-2 transition-colors relative
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : tab.enabled
                    ? 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                    : 'border-transparent text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded-full ${
                    tab.badge === 'NEW' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="p-6">
          {/* Band API 설정 */}
          {activeTab === 'band' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Band API 설정 방법
                </h3>
                <ol className="text-sm text-blue-700 space-y-1 ml-6 list-decimal mb-4">
                  <li>Band Developers에서 앱 생성</li>
                  <li>Client ID 및 Client Secret 발급</li>
                  <li>OAuth 인증 후 Access Token 획득</li>
                </ol>
                <a
                  href="https://developers.band.us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Globe className="w-4 h-4" />
                  Band Developers로 이동
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client ID *
                </label>
                <input
                  type="text"
                  value={settings.band.clientId}
                  onChange={(e) => updateSetting('band', 'clientId', e.target.value)}
                  placeholder="Band Client ID 입력"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Secret *
                </label>
                <input
                  type="password"
                  value={settings.band.clientSecret}
                  onChange={(e) => updateSetting('band', 'clientSecret', e.target.value)}
                  placeholder="Band Client Secret 입력"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Token *
                </label>
                <textarea
                  value={settings.band.accessToken}
                  onChange={(e) => updateSetting('band', 'accessToken', e.target.value)}
                  placeholder="Band Access Token 입력"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refresh Token (선택사항)
                </label>
                <input
                  type="text"
                  value={settings.band.refreshToken}
                  onChange={(e) => updateSetting('band', 'refreshToken', e.target.value)}
                  placeholder="Band Refresh Token 입력"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* AliExpress API 설정 */}
          {activeTab === 'aliexpress' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  AliExpress API 설정 방법
                </h3>
                <ol className="text-sm text-orange-700 space-y-1 ml-6 list-decimal mb-4">
                  <li>AliExpress Open Platform에서 개발자 등록</li>
                  <li>App Key 및 App Secret 발급</li>
                  <li>Affiliate Tracking ID 생성 (선택사항)</li>
                  <li>API는 무료이며, 일 10,000 요청 제한</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="https://portals.aliexpress.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                  >
                    <Globe className="w-4 h-4" />
                    AliExpress 개발자 포털
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <a
                    href="https://developers.aliexpress.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    API 문서 보기
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key (App Key) *
                </label>
                <input
                  type="text"
                  value={settings.aliexpress.apiKey}
                  onChange={(e) => updateSetting('aliexpress', 'apiKey', e.target.value)}
                  placeholder="AliExpress App Key 입력"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  App Secret *
                </label>
                <input
                  type="password"
                  value={settings.aliexpress.appSecret}
                  onChange={(e) => updateSetting('aliexpress', 'appSecret', e.target.value)}
                  placeholder="AliExpress App Secret 입력"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Token (선택사항)
                </label>
                <input
                  type="text"
                  value={settings.aliexpress.accessToken}
                  onChange={(e) => updateSetting('aliexpress', 'accessToken', e.target.value)}
                  placeholder="Access Token (OAuth 인증 후 자동 입력)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking ID (선택사항)
                </label>
                <input
                  type="text"
                  value={settings.aliexpress.trackingId}
                  onChange={(e) => updateSetting('aliexpress', 'trackingId', e.target.value)}
                  placeholder="Affiliate Tracking ID (수익 추적용)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  💡 <strong>모의 데이터 모드:</strong> API 키 없이도 테스트용 모의 데이터로 기능을 체험할 수 있습니다.
                  실제 상품 데이터가 필요한 경우에만 API 키를 등록하세요.
                </p>
              </div>
            </div>
          )}

          {/* 향후 확장 API (미구현) */}
          {!tabs.find(t => t.id === activeTab)?.enabled && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {tabs.find(t => t.id === activeTab)?.label}
              </h3>
              <p className="text-gray-600">
                이 API는 곧 지원될 예정입니다.
              </p>
            </div>
          )}

          {/* 테스트 결과 */}
          {testResult && (
            <div className={`mt-6 p-4 rounded-lg border ${
              testResult.success
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span className="font-medium">{testResult.message}</span>
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          {tabs.find(t => t.id === activeTab)?.enabled && (
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={testConnection}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <TestTube className="w-5 h-5" />
                연결 테스트
              </button>
              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {isSaving ? '저장 중...' : '설정 저장'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 추가 정보 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">💡 향후 지원 예정 API</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-800">🛒 Taobao API</h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">SOON</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">중국 최대 C2C 쇼핑몰 타오바오 상품 소싱</p>
            <a
              href="https://open.taobao.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              개발자 포털 →
            </a>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-800">📦 Coupang API</h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">SOON</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">한국 1위 이커머스 쿠팡 파트너스 연동</p>
            <a
              href="https://partners.coupang.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              파트너스 가입 →
            </a>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-800">🏭 1688.com API</h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">SOON</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">중국 B2B 도매 플랫폼 직접 소싱</p>
            <a
              href="https://open.1688.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              개발자 센터 →
            </a>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-800">🌐 Custom API</h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">OPEN</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">자체 API 엔드포인트 연동 지원</p>
            <span className="text-sm text-gray-400">문의: admin@example.com</span>
          </div>
        </div>
      </div>
    </div>
  )
}
