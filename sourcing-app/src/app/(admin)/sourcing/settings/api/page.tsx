'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, TestTube, Check, AlertCircle, Store, Globe, ShoppingBag, Package, FileText, Chrome, KeyRound, Copy } from 'lucide-react'
import { setExtensionApiKey, checkExtensionInstalled } from '@/lib/band-extension'

interface APISettings {
  // Band API
  band: {
    clientId: string
    clientSecret: string
    accessToken: string
    // 플랫폼 일괄설정 — true 면 어드민이 등록한 공용 토큰 사용 (본인 토큰 입력 불필요)
    useGlobalToken: boolean
    // 어드민 공용 토큰 등록 여부 (서버가 내려주는 읽기 전용 안내값)
    globalTokenConfigured: boolean
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
      useGlobalToken: false,
      globalTokenConfigured: false
    },
    aliexpress: {
      apiKey: '',
      appSecret: '',
      accessToken: '',
      trackingId: ''
    }
  })
  const [isSaving, setIsSaving] = useState(false)
  // 밴드 로그인 계정 설정 (SourcingApiConfig 와 별개 저장 — User.bandLoginEmail)
  const [bandLoginEmail, setBandLoginEmail] = useState('')
  const [isSavingBandAccount, setIsSavingBandAccount] = useState(false)
  const [bandAccountMessage, setBandAccountMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // 확장프로그램 전용 키 (User.extensionApiKey — 세션 자동저장이 로그인 만료와 무관하게 동작)
  const [extKeyInfo, setExtKeyInfo] = useState<{ issued: boolean; keyTail: string | null; createdAt: string | null } | null>(null)
  const [isIssuingKey, setIsIssuingKey] = useState(false)
  const [extKeyMessage, setExtKeyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [fallbackKey, setFallbackKey] = useState<string | null>(null) // 확장 미설치 시 1회 노출
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; solution?: string; detail?: string; errorCode?: number } | null>(null)
  const [testSuccess, setTestSuccess] = useState<Record<APIProvider, boolean>>({
    band: false,
    aliexpress: false,
    taobao: false,
    coupang: false,
    mall1688: false,
  })

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
    loadBandAccount()
    loadExtensionKey()
  }, [])

  const loadExtensionKey = async () => {
    try {
      const response = await fetch('/api/settings/extension-key')
      const data = await response.json()
      if (data.success) setExtKeyInfo(data.data)
    } catch (error) {
      console.error('확장 키 정보 로드 실패:', error)
    }
  }

  const issueExtensionKey = async () => {
    if (extKeyInfo?.issued && !window.confirm('키를 재발급하면 기존 키는 즉시 무효화됩니다. 계속할까요?')) return
    try {
      setIsIssuingKey(true)
      setExtKeyMessage(null)
      setFallbackKey(null)

      const response = await fetch('/api/settings/extension-key', { method: 'POST' })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || '키 발급 실패')
      const key: string = data.data.key

      // 확장에 자동 주입 (설치돼 있으면 복사/붙여넣기 불필요)
      const installed = await checkExtensionInstalled()
      if (installed) {
        const injected = await setExtensionApiKey(key)
        if (injected.success) {
          setExtKeyMessage({
            type: 'success',
            text: '확장에 키가 저장되었습니다. 이후 자동 동기화는 로그인 만료와 무관하게 동작합니다.',
          })
        } else {
          setFallbackKey(key)
          setExtKeyMessage({
            type: 'error',
            text: `자동 주입 실패(${injected.error || '확장 구버전?'}) — 아래 키를 복사해 두세요. 확장 새로고침 후 재발급하면 자동 주입됩니다.`,
          })
        }
      } else {
        setFallbackKey(key)
        setExtKeyMessage({
          type: 'error',
          text: '확장이 감지되지 않아 키를 1회 노출합니다. 확장 설치/새로고침 후 다시 발급하면 자동 주입됩니다.',
        })
      }
      await loadExtensionKey()
    } catch (error: any) {
      setExtKeyMessage({ type: 'error', text: error.message || '키 발급 중 오류' })
    } finally {
      setIsIssuingKey(false)
    }
  }

  const loadBandAccount = async () => {
    try {
      const response = await fetch('/api/settings/band-account')
      const data = await response.json()
      if (data.success) {
        setBandLoginEmail(data.data.bandLoginEmail ?? '')
      }
    } catch (error) {
      console.error('밴드 로그인 계정 로드 실패:', error)
    }
  }

  const saveBandAccount = async () => {
    try {
      setIsSavingBandAccount(true)
      setBandAccountMessage(null)

      const response = await fetch('/api/settings/band-account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bandLoginEmail }),
      })
      const data = await response.json()

      if (data.success) {
        setBandLoginEmail(data.data.bandLoginEmail ?? '')
        setBandAccountMessage({
          type: 'success',
          text: data.data.bandLoginEmail
            ? `밴드 로그인 계정이 [${data.data.bandLoginEmail}] 로 저장되었습니다. 세션 저장 시 이 계정과 일치하는지 확인합니다.`
            : '밴드 로그인 계정 설정이 해제되었습니다. (세션 저장 시 계정 검증 생략)',
        })
      } else {
        setBandAccountMessage({ type: 'error', text: data.error || '저장에 실패했습니다.' })
      }
    } catch (error) {
      console.error('밴드 로그인 계정 저장 실패:', error)
      setBandAccountMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' })
    } finally {
      setIsSavingBandAccount(false)
    }
  }

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

      console.log('[설정 저장] 요청 시작:', { provider: activeTab, settings: settings[activeTab] })

      const response = await fetch('/api/settings/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: activeTab, settings: settings[activeTab] })
      })

      console.log('[설정 저장] 응답 상태:', response.status)

      const data = await response.json()
      console.log('[설정 저장] 응답 데이터:', data)

      if (data.success) {
        setTestResult(null)
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
      setTestResult(null)

      const response = await fetch('/api/settings/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: activeTab, settings: settings[activeTab] })
      })

      const data = await response.json()
      setTestResult(data)

      if (data.success) {
        // 연결 테스트 성공 시 해당 탭의 성공 상태를 true로 설정
        setTestSuccess(prev => ({
          ...prev,
          [activeTab]: true
        }))
      } else {
        // 실패 시 성공 상태를 false로 설정
        setTestSuccess(prev => ({
          ...prev,
          [activeTab]: false
        }))
      }
    } catch (error) {
      console.error('연결 테스트 실패:', error)
      setTestSuccess(prev => ({
        ...prev,
        [activeTab]: false
      }))
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
    // 설정이 변경되면 해당 탭의 연결 테스트 성공 상태를 초기화
    setTestSuccess(prev => ({
      ...prev,
      [provider]: false
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">API 설정</h1>
          </div>
          <p className="text-gray-600">도매 소싱 API 연동 설정을 관리합니다.</p>
        </div>

        {/* Settings Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                API 제공업체 선택
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('band')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    activeTab === 'band'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Store className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Band API</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>• 밴드 게시물 수집</div>
                    <div>• 댓글/주문 수집</div>
                    <div>• OAuth 인증 필요</div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('aliexpress')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    activeTab === 'aliexpress'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Globe className="h-5 w-5 text-orange-600" />
                    <span className="font-semibold text-gray-900">AliExpress</span>
                    <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">NEW</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>• 상품 검색/상세 조회</div>
                    <div>• 일 10,000 요청 무료</div>
                    <div>• 모의 데이터 지원</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Band API Settings */}
            {activeTab === 'band' && (
              <div className="space-y-4 border-t pt-6">
                {/* 밴드 로그인 계정 (User.bandLoginEmail — API 설정과 별개 저장) */}
                <div className="bg-violet-50 border border-violet-200 rounded-md p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Chrome className="h-5 w-5 text-violet-600" />
                    <h3 className="text-lg font-semibold text-gray-900">밴드 로그인 계정</h3>
                  </div>
                  <p className="text-xs text-violet-700">
                    발행·삭제 작업에 사용할 밴드 로그인 네이버 ID입니다. 밴드 마스터 권한(게시글 삭제 등)이
                    있는 계정을 입력하세요. 세션 저장 시 이 계정과 일치하는지 확인합니다.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={bandLoginEmail}
                      onChange={(e) => {
                        setBandLoginEmail(e.target.value)
                        setBandAccountMessage(null)
                      }}
                      placeholder="예: terror8710@naver.com"
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    <button
                      onClick={saveBandAccount}
                      disabled={isSavingBandAccount}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {isSavingBandAccount ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      계정 저장
                    </button>
                  </div>
                  {bandAccountMessage && (
                    <p className={`text-xs ${bandAccountMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                      {bandAccountMessage.text}
                    </p>
                  )}
                </div>

                {/* 확장프로그램 전용 키 — 세션 자동저장이 소싱앱 로그인 만료와 무관하게 동작 */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-lg font-semibold text-gray-900">확장프로그램 키 (세션 자동저장)</h3>
                  </div>
                  <p className="text-xs text-emerald-700">
                    키를 발급하면 Chrome 확장의 밴드 세션 자동저장이 <strong>소싱앱 로그인 만료와 무관하게</strong> 계속
                    동작합니다. 발급 시 확장에 자동 저장되며, 수동으로 세션을 저장할 일이 사실상 없어집니다.
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700">
                      상태:{' '}
                      {extKeyInfo?.issued ? (
                        <span className="text-emerald-700 font-medium">발급됨 (…{extKeyInfo.keyTail})</span>
                      ) : (
                        <span className="text-gray-500">미발급</span>
                      )}
                    </span>
                    <button
                      onClick={issueExtensionKey}
                      disabled={isIssuingKey}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {isIssuingKey ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {extKeyInfo?.issued ? '키 재발급' : '키 발급'}
                    </button>
                  </div>
                  {extKeyMessage && (
                    <p className={`text-xs ${extKeyMessage.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                      {extKeyMessage.text}
                    </p>
                  )}
                  {fallbackKey && (
                    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md px-3 py-2">
                      <code className="text-xs flex-1 break-all">{fallbackKey}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(fallbackKey)}
                        className="p-1.5 text-gray-500 hover:text-gray-800"
                        title="복사"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Store className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Band API 설정</h3>
                </div>

                {/* 토큰 사용 방식 선택 — 플랫폼 일괄설정 vs 내 API 직접 등록 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Access Token 사용 방식
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          band: { ...prev.band, useGlobalToken: true },
                        }))
                      }
                      className={`p-3 border-2 rounded-lg text-left transition-all ${
                        settings.band.useGlobalToken
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900 text-sm mb-1">플랫폼 일괄설정</p>
                      <p className="text-xs text-gray-500">
                        관리자가 등록한 공용 Access Token을 사용합니다. 별도 입력이 필요 없습니다.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          band: { ...prev.band, useGlobalToken: false },
                        }))
                      }
                      className={`p-3 border-2 rounded-lg text-left transition-all ${
                        !settings.band.useGlobalToken
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-900 text-sm mb-1">내 API 직접 등록</p>
                      <p className="text-xs text-gray-500">
                        Band Developers에서 발급받은 본인의 Access Token을 입력합니다.
                      </p>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    방식 변경 후 하단의 [설정 저장]을 눌러야 적용됩니다.
                  </p>
                </div>

                {settings.band.useGlobalToken ? (
                  /* 일괄설정 모드 — 공용 토큰 상태 안내 */
                  <div
                    className={`border rounded-md p-4 ${
                      settings.band.globalTokenConfigured
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    {settings.band.globalTokenConfigured ? (
                      <p className="text-xs text-green-700">
                        <Check className="inline h-3.5 w-3.5 mr-1" />
                        플랫폼 공용 토큰이 등록되어 있습니다. 저장하면 밴드 목록 조회·수집에 공용
                        토큰이 사용됩니다.
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700">
                        <AlertCircle className="inline h-3.5 w-3.5 mr-1" />
                        아직 플랫폼 공용 토큰이 등록되지 않았습니다. 관리자에게 등록을 요청해
                        주세요. (어드민 패널 &gt; SaaS 운영 &gt; 플랫폼 Band API)
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Band API Key */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Access Token *
                      </label>
                      <textarea
                        value={settings.band.accessToken}
                        onChange={(e) => updateSetting('band', 'accessToken', e.target.value)}
                        placeholder="Band Access Token 입력"
                        rows={3}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Band Developers에서 발급받은 Access Token을 입력하세요.
                      </p>
                    </div>

                    {/* Band Developers Button */}
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <p className="text-xs text-blue-700 mb-3">
                        Band Developers에서 앱을 생성하고 Access Token을 발급받으세요
                      </p>
                      <a
                        href="https://developers.band.us"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors"
                      >
                        <Globe className="w-4 h-4" />
                        Band Developers 열기
                      </a>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* AliExpress API Settings */}
            {activeTab === 'aliexpress' && (
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-semibold text-gray-900">AliExpress API 설정</h3>
                </div>

                {/* AliExpress API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key (App Key) *
                  </label>
                  <input
                    type="text"
                    value={settings.aliexpress.apiKey}
                    onChange={(e) => updateSetting('aliexpress', 'apiKey', e.target.value)}
                    placeholder="AliExpress App Key 입력"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* AliExpress App Secret */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    App Secret *
                  </label>
                  <input
                    type="password"
                    value={settings.aliexpress.appSecret}
                    onChange={(e) => updateSetting('aliexpress', 'appSecret', e.target.value)}
                    placeholder="AliExpress App Secret 입력"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Access Token */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Token (선택사항)
                  </label>
                  <input
                    type="text"
                    value={settings.aliexpress.accessToken}
                    onChange={(e) => updateSetting('aliexpress', 'accessToken', e.target.value)}
                    placeholder="Access Token (OAuth 인증 후 자동 입력)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Tracking ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tracking ID (선택사항)
                  </label>
                  <input
                    type="text"
                    value={settings.aliexpress.trackingId}
                    onChange={(e) => updateSetting('aliexpress', 'trackingId', e.target.value)}
                    placeholder="Affiliate Tracking ID (수익 추적용)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Mock Data Info */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <p className="text-xs text-gray-600">
                    <strong>모의 데이터 모드:</strong> API 키 없이도 테스트용 모의 데이터로 기능을 체험할 수 있습니다.
                  </p>
                </div>

                {/* AliExpress Portal Button */}
                <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
                  <p className="text-xs text-orange-700 mb-3">
                    AliExpress Open Platform에서 API 키를 발급받으세요
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="https://portals.aliexpress.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-md transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      개발자 포털 열기
                    </a>
                    <a
                      href="https://developers.aliexpress.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 border border-orange-300 text-sm rounded-md hover:bg-orange-200 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      API 문서 보기
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Future APIs Info */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">향후 지원 예정 API</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <ShoppingBag className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Taobao API</p>
                    <p className="text-xs text-gray-500">중국 최대 C2C 쇼핑몰</p>
                  </div>
                  <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">SOON</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Package className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Coupang API</p>
                    <p className="text-xs text-gray-500">한국 1위 이커머스</p>
                  </div>
                  <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">SOON</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <ShoppingBag className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">1688.com API</p>
                    <p className="text-xs text-gray-500">중국 B2B 도매 플랫폼</p>
                  </div>
                  <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">SOON</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Globe className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Custom API</p>
                    <p className="text-xs text-gray-500">자체 API 엔드포인트</p>
                  </div>
                  <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">OPEN</span>
                </div>
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
                      {testResult.success ? '연결 성공!' : '연결 실패'}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    testResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {testResult.message}
                  </p>
                  {testResult.detail && (
                    <p className={`text-sm mt-1 ${testResult.success ? 'text-green-700' : 'text-red-600'}`}>
                      {testResult.detail}
                    </p>
                  )}
                  {testResult.errorCode && !testResult.success && (
                    <p className="text-xs text-red-500 mt-1 font-mono">
                      에러 코드: {testResult.errorCode}
                    </p>
                  )}
                  {testResult.solution && !testResult.success && (
                    <div className="mt-2 p-3 bg-red-100/50 rounded-md">
                      <p className="text-sm text-red-700">
                        <span className="font-medium">해결 방법:</span> {testResult.solution}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Helper Text */}
              {!testSuccess[activeTab] && (
                <p className="text-xs text-gray-500 text-right mb-2">
                  * 연결 테스트를 먼저 완료해주세요
                </p>
              )}

              <div className="flex justify-end gap-3">
                {/* Connection Test Button */}
                <button
                  onClick={testConnection}
                  className={`flex items-center gap-2 px-6 py-2 text-white rounded-md hover:opacity-90 transition-colors ${
                    activeTab === 'band' ? 'bg-blue-500' : 'bg-orange-500'
                  }`}
                >
                  <TestTube className="h-4 w-4" />
                  연결 테스트
                </button>

                {/* Save Settings Button */}
                <button
                  onClick={saveSettings}
                  disabled={isSaving || !testSuccess[activeTab]}
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
