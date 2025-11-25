'use client'

import { useState, useEffect } from 'react'
import { Save, RefreshCw, Store, Send, Sparkles, Bot, Check, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

interface WholesaleBand {
  id: number
  name: string
  coverUrl: string | null
}

interface RetailBand {
  id: number
  name: string
  coverUrl: string | null
}

interface PricingPolicy {
  id: number
  name: string
  content: string | null
}

interface AiProviderInfo {
  provider: 'GEMINI' | 'OPENAI'
  name: string
  isConfigured: boolean
}

interface AutomationConfig {
  isEnabled: boolean
  cronInterval: string
  collectFromAllBands: boolean
  wholesaleBandIds: number[]
  aiProvider: string
  pricingPolicyId: number | null
  autoPublish: boolean
  retailBandIds: number[]
}

const INTERVAL_OPTIONS = [
  { value: '1h', label: '1시간마다' },
  { value: '3h', label: '3시간마다' },
  { value: '6h', label: '6시간마다' },
  { value: '12h', label: '12시간마다' },
  { value: '24h', label: '24시간마다 (자정)' },
]

const defaultConfig: AutomationConfig = {
  isEnabled: false,
  cronInterval: '1h',
  collectFromAllBands: true,
  wholesaleBandIds: [],
  aiProvider: 'GEMINI',
  pricingPolicyId: null,
  autoPublish: false,
  retailBandIds: [],
}

export default function AutomationSettingsPage() {
  const [config, setConfig] = useState<AutomationConfig>(defaultConfig)
  const [initialConfig, setInitialConfig] = useState<AutomationConfig>(defaultConfig)
  const [wholesaleBands, setWholesaleBands] = useState<WholesaleBand[]>([])
  const [retailBands, setRetailBands] = useState<RetailBand[]>([])
  const [pricingPolicies, setPricingPolicies] = useState<PricingPolicy[]>([])
  const [configuredAiProviders, setConfiguredAiProviders] = useState<AiProviderInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [wholesaleStartIndex, setWholesaleStartIndex] = useState(0)
  const [retailStartIndex, setRetailStartIndex] = useState(0)
  const [showAllWholesale, setShowAllWholesale] = useState(false)
  const [showAllRetail, setShowAllRetail] = useState(false)

  const BANDS_PER_PAGE = 6

  // 섹션별 변경 여부 확인
  const hasScheduleChanges = config.isEnabled !== initialConfig.isEnabled ||
    config.cronInterval !== initialConfig.cronInterval

  const hasCollectionChanges = JSON.stringify(config.wholesaleBandIds.slice().sort()) !==
    JSON.stringify(initialConfig.wholesaleBandIds.slice().sort())

  const hasAiChanges = config.aiProvider !== initialConfig.aiProvider ||
    config.pricingPolicyId !== initialConfig.pricingPolicyId

  const hasPublishChanges = JSON.stringify(config.retailBandIds.slice().sort()) !==
    JSON.stringify(initialConfig.retailBandIds.slice().sort())

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [configRes, wholesaleRes, retailRes, policyRes, aiSettingsRes] = await Promise.all([
        fetch('/api/automation/config'),
        fetch('/api/band/wholesale'),
        fetch('/api/band/retail'),
        fetch('/api/policy'),
        fetch('/api/settings/ai'),
      ])

      const configData = await configRes.json()
      const wholesaleData = await wholesaleRes.json()
      const retailData = await retailRes.json()
      const policyData = await policyRes.json()
      const aiSettingsData = await aiSettingsRes.json()

      if (configData.success) {
        setConfig(configData.data)
        setInitialConfig(configData.data)
      }
      if (wholesaleData.success) {
        setWholesaleBands(wholesaleData.data || [])
      }
      if (retailData.success) {
        setRetailBands(retailData.data || [])
      }
      if (policyData.success) {
        setPricingPolicies(policyData.data || [])
      }

      // AI 설정 여부 확인
      if (aiSettingsData.success) {
        const providers: AiProviderInfo[] = []
        if (aiSettingsData.settings?.gemini?.apiKey) {
          providers.push({ provider: 'GEMINI', name: 'Google Gemini', isConfigured: true })
        }
        if (aiSettingsData.settings?.openai?.apiKey) {
          providers.push({ provider: 'OPENAI', name: 'OpenAI GPT', isConfigured: true })
        }
        setConfiguredAiProviders(providers)
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSection = async (section: string) => {
    console.log('[Automation Save] Section:', section)
    console.log('[Automation Save] Config:', config)
    setSavingSection(section)
    try {
      const response = await fetch('/api/automation/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      console.log('[Automation Save] Response status:', response.status)
      const data = await response.json()
      console.log('[Automation Save] Response data:', data)

      if (data.success) {
        setInitialConfig(config)
      } else {
        console.error('[Automation Save] Failed:', data.error)
      }
    } catch (error) {
      console.error('[Automation Save] Error:', error)
    } finally {
      setSavingSection(null)
    }
  }

  const handleWholesaleBandToggle = (bandId: number) => {
    setConfig(prev => ({
      ...prev,
      wholesaleBandIds: prev.wholesaleBandIds.includes(bandId)
        ? prev.wholesaleBandIds.filter(id => id !== bandId)
        : [...prev.wholesaleBandIds, bandId],
    }))
  }

  const handleRetailBandToggle = (bandId: number) => {
    setConfig(prev => ({
      ...prev,
      retailBandIds: prev.retailBandIds.includes(bandId)
        ? prev.retailBandIds.filter(id => id !== bandId)
        : [...prev.retailBandIds, bandId],
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-color" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">자동화 설정</h1>
        <p className="text-gray-600 mt-1">자동화 워크플로우 스케줄 및 설정</p>
      </div>

      {/* Enable/Disable & Schedule */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">자동화 활성화</h2>
            <p className="text-sm text-gray-600 mt-1">
              활성화하면 설정된 주기에 따라 자동으로 워크플로우가 실행됩니다.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.isEnabled}
              onChange={(e) => setConfig(prev => ({ ...prev, isEnabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-md font-medium text-gray-900 mb-4">실행 주기</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setConfig(prev => ({ ...prev, cronInterval: option.value }))}
                className={`
                  px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors
                  ${config.cronInterval === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
          <Button
            variant="primary"
            onClick={() => handleSaveSection('schedule')}
            disabled={savingSection === 'schedule' || !hasScheduleChanges}
            className="flex items-center gap-2"
          >
            {savingSection === 'schedule' ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            저장
          </Button>
        </div>
      </Card>

      {/* Collection Settings - Wholesale Band Cards */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">수집 설정</h2>
          {wholesaleBands.length > BANDS_PER_PAGE && (
            <button
              onClick={() => setShowAllWholesale(!showAllWholesale)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showAllWholesale ? '접기' : '전체보기'}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">게시물을 수집할 도매밴드를 선택하세요. 선택하지 않으면 모든 밴드에서 수집합니다.</p>

        {wholesaleBands.length > 0 ? (
          showAllWholesale ? (
            /* 전체보기 모드 */
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {wholesaleBands.map((band) => {
                const isSelected = config.wholesaleBandIds.includes(band.id)
                return (
                  <div
                    key={band.id}
                    onClick={() => handleWholesaleBandToggle(band.id)}
                    className={`
                      relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="h-60 bg-gray-100">
                      {band.coverUrl ? (
                        <img src={band.coverUrl} alt={band.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <Store size={40} />
                        </div>
                      )}
                    </div>
                    <div className="p-2 text-center bg-white">
                      <span className="text-xs font-medium text-gray-800 line-clamp-1">{band.name}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
          /* 캐러셀 모드 */
          <div className="relative">
            {/* Left Arrow */}
            {wholesaleStartIndex > 0 && (
              <button
                onClick={() => setWholesaleStartIndex(prev => Math.max(0, prev - 1))}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 bg-white border border-gray-300 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
            )}

            {/* Band Cards */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 overflow-hidden">
              {wholesaleBands.slice(wholesaleStartIndex, wholesaleStartIndex + BANDS_PER_PAGE).map((band) => {
                const isSelected = config.wholesaleBandIds.includes(band.id)
                return (
                  <div
                    key={band.id}
                    onClick={() => handleWholesaleBandToggle(band.id)}
                    className={`
                      relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    {/* Image */}
                    <div className="h-60 bg-gray-100">
                      {band.coverUrl ? (
                        <img
                          src={band.coverUrl}
                          alt={band.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <Store size={40} />
                        </div>
                      )}
                    </div>
                    {/* Band Name */}
                    <div className="p-2 text-center bg-white">
                      <span className="text-xs font-medium text-gray-800 line-clamp-1">{band.name}</span>
                    </div>
                    {/* Selection Check */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Right Arrow */}
            {wholesaleStartIndex + BANDS_PER_PAGE < wholesaleBands.length && (
              <button
                onClick={() => setWholesaleStartIndex(prev => Math.min(wholesaleBands.length - BANDS_PER_PAGE, prev + 1))}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 bg-white border border-gray-300 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={20} className="text-gray-600" />
              </button>
            )}

            {/* Page Indicator */}
            {wholesaleBands.length > BANDS_PER_PAGE && (
              <div className="flex justify-center mt-4 gap-1">
                {Array.from({ length: Math.ceil(wholesaleBands.length / BANDS_PER_PAGE) }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setWholesaleStartIndex(idx * BANDS_PER_PAGE)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      Math.floor(wholesaleStartIndex / BANDS_PER_PAGE) === idx
                        ? 'bg-blue-500'
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          )
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500 text-sm">
              등록된 도매밴드가 없습니다.
              <a href="/band/wholesale" className="text-blue-600 hover:underline ml-1">
                밴드관리 &gt; 도매밴드 관리
              </a>
              에서 추가해주세요.
            </p>
          </div>
        )}

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
          <Button
            variant="primary"
            onClick={() => handleSaveSection('collection')}
            disabled={savingSection === 'collection' || !hasCollectionChanges}
            className="flex items-center gap-2"
          >
            {savingSection === 'collection' ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            저장
          </Button>
        </div>
      </Card>

      {/* AI Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">AI 변환 설정</h2>

        <div className="space-y-6">
          {/* AI Provider Cards */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">AI 제공자</label>
            {configuredAiProviders.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {configuredAiProviders.map((ai) => (
                  <div
                    key={ai.provider}
                    onClick={() => setConfig(prev => ({ ...prev, aiProvider: ai.provider }))}
                    className={`
                      cursor-pointer rounded-xl border-2 p-4 transition-all
                      ${config.aiProvider === ai.provider
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      {ai.provider === 'GEMINI' ? (
                        <Sparkles size={24} className="text-blue-600" />
                      ) : (
                        <Bot size={24} className="text-green-600" />
                      )}
                      <span className="font-medium text-gray-800">{ai.name}</span>
                    </div>
                    {config.aiProvider === ai.provider && (
                      <div className="mt-2 flex items-center gap-1 text-blue-600 text-sm">
                        <Check size={14} />
                        <span>선택됨</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-500 text-sm">
                  설정된 AI 제공자가 없습니다.
                  <a href="/admin/settings/ai" className="text-blue-600 hover:underline ml-1">
                    환경설정 &gt; AI 설정
                  </a>
                  에서 API 키를 등록해주세요.
                </p>
              </div>
            )}
          </div>

          {/* Pricing Policy Cards */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">가격 정책</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {/* No Policy Option */}
              <div
                onClick={() => setConfig(prev => ({ ...prev, pricingPolicyId: null }))}
                className={`
                  cursor-pointer rounded-xl border-2 p-4 transition-all h-32 flex flex-col
                  ${config.pricingPolicyId === null
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={18} className="text-gray-400" />
                  <span className="font-medium text-gray-700">정책 없음</span>
                  {config.pricingPolicyId === null && (
                    <Check size={14} className="text-blue-600 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-500 line-clamp-3 flex-1">도매가만 추출하여 그대로 사용합니다.</p>
              </div>

              {/* Policy List */}
              {pricingPolicies.map((policy) => (
                <div
                  key={policy.id}
                  onClick={() => setConfig(prev => ({ ...prev, pricingPolicyId: policy.id }))}
                  className={`
                    cursor-pointer rounded-xl border-2 p-4 transition-all h-32 flex flex-col
                    ${config.pricingPolicyId === policy.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={18} className="text-blue-500" />
                    <span className="font-medium text-gray-700 truncate">{policy.name}</span>
                    {config.pricingPolicyId === policy.id && (
                      <Check size={14} className="text-blue-600 ml-auto flex-shrink-0" />
                    )}
                  </div>
                  {policy.content && (
                    <p className="text-xs text-gray-500 line-clamp-3 flex-1">{policy.content}</p>
                  )}
                </div>
              ))}
            </div>
            {pricingPolicies.length === 0 && (
              <p className="text-gray-500 text-sm mt-2">
                등록된 가격 정책이 없습니다.
                <a href="/policy/list" className="text-blue-600 hover:underline ml-1">
                  정책 관리
                </a>
                에서 추가해주세요.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
          <Button
            variant="primary"
            onClick={() => handleSaveSection('ai')}
            disabled={savingSection === 'ai' || !hasAiChanges}
            className="flex items-center gap-2"
          >
            {savingSection === 'ai' ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            저장
          </Button>
        </div>
      </Card>

      {/* Publish Settings - Retail Band Cards */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">발행 설정</h2>
          {retailBands.length > BANDS_PER_PAGE && (
            <button
              onClick={() => setShowAllRetail(!showAllRetail)}
              className="text-sm text-green-600 hover:text-green-800 font-medium"
            >
              {showAllRetail ? '접기' : '전체보기'}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">상품을 발행할 소매밴드를 선택하세요.</p>

        {retailBands.length > 0 ? (
          showAllRetail ? (
            /* 전체보기 모드 */
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {retailBands.map((band) => {
                const isSelected = config.retailBandIds.includes(band.id)
                return (
                  <div
                    key={band.id}
                    onClick={() => handleRetailBandToggle(band.id)}
                    className={`
                      relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected
                        ? 'border-green-500 ring-2 ring-green-200'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="h-60 bg-gray-100">
                      {band.coverUrl ? (
                        <img src={band.coverUrl} alt={band.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <Send size={40} />
                        </div>
                      )}
                    </div>
                    <div className="p-2 text-center bg-white">
                      <span className="text-xs font-medium text-gray-800 line-clamp-1">{band.name}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
          /* 캐러셀 모드 */
          <div className="relative">
            {/* Left Arrow */}
            {retailStartIndex > 0 && (
              <button
                onClick={() => setRetailStartIndex(prev => Math.max(0, prev - 1))}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 bg-white border border-gray-300 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
            )}

            {/* Band Cards */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 overflow-hidden">
              {retailBands.slice(retailStartIndex, retailStartIndex + BANDS_PER_PAGE).map((band) => {
                const isSelected = config.retailBandIds.includes(band.id)
                return (
                  <div
                    key={band.id}
                    onClick={() => handleRetailBandToggle(band.id)}
                    className={`
                      relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected
                        ? 'border-green-500 ring-2 ring-green-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                    `}
                  >
                    {/* Image */}
                    <div className="h-60 bg-gray-100">
                      {band.coverUrl ? (
                        <img
                          src={band.coverUrl}
                          alt={band.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <Send size={40} />
                        </div>
                      )}
                    </div>
                    {/* Band Name */}
                    <div className="p-2 text-center bg-white">
                      <span className="text-xs font-medium text-gray-800 line-clamp-1">{band.name}</span>
                    </div>
                    {/* Selection Check */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Right Arrow */}
            {retailStartIndex + BANDS_PER_PAGE < retailBands.length && (
              <button
                onClick={() => setRetailStartIndex(prev => Math.min(retailBands.length - BANDS_PER_PAGE, prev + 1))}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 bg-white border border-gray-300 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={20} className="text-gray-600" />
              </button>
            )}

            {/* Page Indicator */}
            {retailBands.length > BANDS_PER_PAGE && (
              <div className="flex justify-center mt-4 gap-1">
                {Array.from({ length: Math.ceil(retailBands.length / BANDS_PER_PAGE) }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setRetailStartIndex(idx * BANDS_PER_PAGE)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      Math.floor(retailStartIndex / BANDS_PER_PAGE) === idx
                        ? 'bg-green-500'
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          )
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500 text-sm">
              등록된 소매밴드가 없습니다.
              <a href="/band/retail" className="text-blue-600 hover:underline ml-1">
                밴드관리 &gt; 소매밴드 관리
              </a>
              에서 추가해주세요.
            </p>
          </div>
        )}
        {config.retailBandIds.length === 0 && retailBands.length > 0 && (
          <p className="text-sm text-amber-600 mt-3">
            발행할 소매밴드를 선택해주세요.
          </p>
        )}

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
          <Button
            variant="primary"
            onClick={() => handleSaveSection('publish')}
            disabled={savingSection === 'publish' || !hasPublishChanges}
            className="flex items-center gap-2"
          >
            {savingSection === 'publish' ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            저장
          </Button>
        </div>
      </Card>
    </div>
  )
}
