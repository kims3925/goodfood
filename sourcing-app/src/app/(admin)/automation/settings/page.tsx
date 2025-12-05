'use client'

import { useState, useEffect } from 'react'
import { Save, RefreshCw, Store, Send, Sparkles, Bot, Check, FileText, ChevronLeft, ChevronRight, Clock, Download, Upload, Zap, Settings2, ShoppingBag } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'

interface Channel {
  id: number
  name: string
  coverUrl: string | null
  kind: 'WHOLESALE' | 'RETAIL'
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

interface Shop {
  id: number
  name: string
  subdomain: string
  coverUrl: string | null
}

interface AutomationConfig {
  isEnabled: boolean
  cronInterval: string
  collectFromAllChannels: boolean
  wholesaleChannelIds: number[]
  aiProvider: string
  pricingPolicyId: number | null
  retailChannelIds: number[]
  shopIds: number[]
}

const INTERVAL_OPTIONS = [
  { value: '1h', label: '1시간', description: '매 정각 실행 (0분)', examples: '1:00, 2:00, 3:00...' },
  { value: '3h', label: '3시간', description: '매 3시간 정각', examples: '0:00, 3:00, 6:00, 9:00...' },
  { value: '6h', label: '6시간', description: '매 6시간 정각', examples: '0:00, 6:00, 12:00, 18:00' },
  { value: '12h', label: '12시간', description: '매 12시간 정각', examples: '0:00, 12:00' },
  { value: '24h', label: '24시간', description: '매일 자정', examples: '0:00 (자정)' },
]

// 다음 실행 시간 계산 함수
const getNextExecutionTimes = (interval: string): string[] => {
  const now = new Date()
  const times: string[] = []

  const intervalHours: { [key: string]: number } = {
    '1h': 1,
    '3h': 3,
    '6h': 6,
    '12h': 12,
    '24h': 24,
  }

  const hours = intervalHours[interval] || 1

  // 다음 실행 시간들 계산 (최대 3개)
  for (let i = 0; i < 24 && times.length < 3; i++) {
    const checkHour = (Math.floor(now.getHours() / hours) * hours + hours * (times.length === 0 ? 0 : 1) + i) % 24
    if (checkHour % hours === 0) {
      const nextTime = new Date(now)
      nextTime.setHours(checkHour, 0, 0, 0)

      // 이미 지난 시간이면 다음 날로
      if (nextTime <= now) {
        if (times.length === 0) continue
      }

      if (times.length === 0 || !times.includes(nextTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))) {
        times.push(nextTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
      }

      if (times.length >= 3) break
    }
  }

  // 간단한 방식으로 재계산
  const result: string[] = []
  const currentHour = now.getHours()

  for (let h = 0; h < 24 && result.length < 3; h++) {
    if (h % hours === 0) {
      if (h > currentHour || (h === currentHour && now.getMinutes() === 0)) {
        result.push(`${h.toString().padStart(2, '0')}:00`)
      } else if (result.length === 0 && h <= currentHour) {
        // 오늘 남은 시간 중 가장 가까운 것
        const nextH = Math.ceil((currentHour + 1) / hours) * hours
        if (nextH < 24) {
          result.push(`${nextH.toString().padStart(2, '0')}:00`)
        } else {
          result.push(`내일 00:00`)
        }
      }
    }
  }

  // 결과가 비어있으면 기본값
  if (result.length === 0) {
    const nextH = Math.ceil((currentHour + 1) / hours) * hours
    if (nextH >= 24) {
      result.push('내일 00:00')
    } else {
      result.push(`${nextH.toString().padStart(2, '0')}:00`)
    }
  }

  return result
}

// 가장 가까운 다음 실행 시간
const getNextExecution = (interval: string): string => {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  const intervalHours: { [key: string]: number } = {
    '1h': 1,
    '3h': 3,
    '6h': 6,
    '12h': 12,
    '24h': 24,
  }

  const hours = intervalHours[interval] || 1

  // 다음 실행 시간 계산
  let nextHour = Math.ceil((currentHour + (currentMinute > 0 ? 1 : 0)) / hours) * hours

  if (nextHour >= 24) {
    return '내일 00:00'
  }

  if (nextHour === currentHour && currentMinute > 0) {
    nextHour += hours
    if (nextHour >= 24) {
      return '내일 00:00'
    }
  }

  return `오늘 ${nextHour.toString().padStart(2, '0')}:00`
}

const defaultConfig: AutomationConfig = {
  isEnabled: false,
  cronInterval: '1h',
  collectFromAllChannels: true,
  wholesaleChannelIds: [],
  aiProvider: 'GEMINI',
  pricingPolicyId: null,
  retailChannelIds: [],
  shopIds: [],
}

export default function AutomationSettingsPage() {
  const toast = useToast()
  const [config, setConfig] = useState<AutomationConfig>(defaultConfig)
  const [initialConfig, setInitialConfig] = useState<AutomationConfig>(defaultConfig)
  const [wholesaleChannels, setWholesaleChannels] = useState<Channel[]>([])
  const [retailChannels, setRetailChannels] = useState<Channel[]>([])
  const [pricingPolicies, setPricingPolicies] = useState<PricingPolicy[]>([])
  const [configuredAiProviders, setConfiguredAiProviders] = useState<AiProviderInfo[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [wholesaleStartIndex, setWholesaleStartIndex] = useState(0)
  const [retailStartIndex, setRetailStartIndex] = useState(0)
  const [showAllWholesale, setShowAllWholesale] = useState(false)
  const [showAllRetail, setShowAllRetail] = useState(false)
  const [warningSections, setWarningSections] = useState<string[]>([])
  const [warningPhase, setWarningPhase] = useState<'idle' | 'shake' | 'fading'>('idle')

  const CHANNELS_PER_PAGE = 4

  // 섹션별 변경 여부 확인 (isEnabled는 버튼으로 변경하므로 제외)
  const hasScheduleChanges = config.cronInterval !== initialConfig.cronInterval

  const hasCollectionChanges = JSON.stringify((config.wholesaleChannelIds || []).slice().sort()) !==
    JSON.stringify((initialConfig.wholesaleChannelIds || []).slice().sort())

  const hasAiChanges = config.aiProvider !== initialConfig.aiProvider ||
    config.pricingPolicyId !== initialConfig.pricingPolicyId

  const hasPublishChanges = JSON.stringify((config.retailChannelIds || []).slice().sort()) !==
    JSON.stringify((initialConfig.retailChannelIds || []).slice().sort())

  const hasShopChanges = JSON.stringify((config.shopIds || []).slice().sort()) !==
    JSON.stringify((initialConfig.shopIds || []).slice().sort())

  // 저장되지 않은 변경사항이 있는지 확인
  const hasUnsavedChanges = hasScheduleChanges || hasCollectionChanges || hasAiChanges || hasPublishChanges || hasShopChanges

  // 자동화 활성화 상태 저장
  const saveAutomationState = async (enabled: boolean) => {
    try {
      const newConfig = { ...config, isEnabled: enabled }
      const response = await fetch('/api/automation/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      })
      const data = await response.json()
      if (data.success) {
        setConfig(newConfig)
        setInitialConfig(newConfig)
        toast.success(enabled ? '자동화가 시작되었습니다' : '자동화가 중지되었습니다')
      } else {
        toast.error('자동화 상태 변경에 실패했습니다')
      }
    } catch (error) {
      console.error('자동화 상태 저장 실패:', error)
      toast.error('자동화 상태 변경에 실패했습니다')
    }
  }

  // 자동화 시작 핸들러
  const handleStartAutomation = () => {
    // 필수 설정 검증
    const missingSettings: string[] = []

    // 쇼핑몰 선택 확인
    if (config.shopIds.length === 0) {
      missingSettings.push('쇼핑몰')
    }

    // 수집할 도매채널 확인
    if (config.wholesaleChannelIds.length === 0) {
      missingSettings.push('수집할 도매채널')
    }

    // AI 제공자 확인
    if (!config.aiProvider) {
      missingSettings.push('AI 제공자')
    }

    // 발행할 소매채널 확인
    if (config.retailChannelIds.length === 0) {
      missingSettings.push('발행할 소매채널')
    }

    // 필수 설정이 없으면 toast로 안내
    if (missingSettings.length > 0) {
      toast.error(`자동화를 시작하려면 다음 설정이 필요합니다: ${missingSettings.join(', ')}`)
      return
    }

    const unsavedSections: string[] = []

    if (hasShopChanges) unsavedSections.push('shop')
    if (hasScheduleChanges) unsavedSections.push('schedule')
    if (hasCollectionChanges) unsavedSections.push('collection')
    if (hasAiChanges) unsavedSections.push('ai')
    if (hasPublishChanges) unsavedSections.push('publish')

    if (unsavedSections.length > 0) {
      // 1단계: 빨간색 + 진동
      setWarningSections(unsavedSections)
      setWarningPhase('shake')

      // 2단계: 0.6초 후 진동 끝, 페이딩 시작
      setTimeout(() => {
        setWarningPhase('fading')
      }, 600)

      // 3단계: 2.5초 후 완전히 원래 상태로
      setTimeout(() => {
        setWarningSections([])
        setWarningPhase('idle')
      }, 3000)

      return
    }

    // 저장된 상태에서만 자동화 시작 (서버에도 저장)
    saveAutomationState(true)
  }

  // 자동화 중지 핸들러
  const handleStopAutomation = () => {
    saveAutomationState(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [configRes, wholesaleRes, retailRes, policyRes, aiSettingsRes, shopsRes] = await Promise.all([
        fetch('/api/automation/config'),
        fetch('/api/channel?kind=WHOLESALE'),
        fetch('/api/channel?kind=RETAIL'),
        fetch('/api/policy'),
        fetch('/api/settings/ai'),
        fetch('/api/shop'),
      ])

      // 각 응답을 개별적으로 처리 (하나가 실패해도 다른 것들은 처리)
      try {
        const configData = await configRes.json()
        if (configData.success) {
          const loadedConfig = {
            ...defaultConfig,
            ...configData.data,
            wholesaleChannelIds: configData.data?.wholesaleChannelIds || [],
            retailChannelIds: configData.data?.retailChannelIds || [],
            shopIds: configData.data?.shopIds || [],
          }
          setConfig(loadedConfig)
          setInitialConfig(loadedConfig)
        } else {
          console.error('자동화 설정 로드 실패:', configData.error)
        }
      } catch (e) {
        console.error('자동화 설정 파싱 실패:', e)
      }

      try {
        const wholesaleData = await wholesaleRes.json()
        if (wholesaleData.success) {
          setWholesaleChannels(wholesaleData.data || [])
        } else {
          console.error('도매채널 로드 실패:', wholesaleData.error)
        }
      } catch (e) {
        console.error('도매채널 파싱 실패:', e)
      }

      try {
        const retailData = await retailRes.json()
        if (retailData.success) {
          setRetailChannels(retailData.data || [])
        } else {
          console.error('소매채널 로드 실패:', retailData.error)
        }
      } catch (e) {
        console.error('소매채널 파싱 실패:', e)
      }

      try {
        const policyData = await policyRes.json()
        if (policyData.success) {
          setPricingPolicies(policyData.data || [])
        } else {
          console.error('가격정책 로드 실패:', policyData.error)
        }
      } catch (e) {
        console.error('가격정책 파싱 실패:', e)
      }

      try {
        const shopsData = await shopsRes.json()
        if (shopsData.success) {
          setShops(shopsData.data || [])
        } else {
          console.error('쇼핑몰 로드 실패:', shopsData.error)
        }
      } catch (e) {
        console.error('쇼핑몰 파싱 실패:', e)
      }

      // AI 설정 여부 확인
      try {
        const aiSettingsData = await aiSettingsRes.json()
        if (aiSettingsData.success) {
          const providers: AiProviderInfo[] = []
          if (aiSettingsData.settings?.gemini?.apiKey) {
            providers.push({ provider: 'GEMINI', name: 'Google Gemini', isConfigured: true })
          }
          if (aiSettingsData.settings?.openai?.apiKey) {
            providers.push({ provider: 'OPENAI', name: 'OpenAI GPT', isConfigured: true })
          }
          setConfiguredAiProviders(providers)
        } else {
          console.error('AI 설정 로드 실패:', aiSettingsData.error)
        }
      } catch (e) {
        console.error('AI 설정 파싱 실패:', e)
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sectionNames: { [key: string]: string } = {
    shop: '쇼핑몰 설정',
    schedule: '실행 주기',
    collection: '수집 설정',
    ai: 'AI 변환 설정',
    publish: '발행 설정',
  }

  const handleSaveSection = async (section: string) => {
    setSavingSection(section)
    try {
      const response = await fetch('/api/automation/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      const data = await response.json()

      if (data.success) {
        setInitialConfig(config)
        toast.success(`${sectionNames[section] || section} 설정이 저장되었습니다`)
      } else {
        toast.error(`${sectionNames[section] || section} 저장에 실패했습니다`)
      }
    } catch (error) {
      console.error('[Automation Save] Error:', error)
      toast.error(`${sectionNames[section] || section} 저장에 실패했습니다`)
    } finally {
      setSavingSection(null)
    }
  }

  const handleWholesaleChannelToggle = (channelId: number) => {
    setConfig(prev => ({
      ...prev,
      wholesaleChannelIds: prev.wholesaleChannelIds.includes(channelId)
        ? prev.wholesaleChannelIds.filter(id => id !== channelId)
        : [...prev.wholesaleChannelIds, channelId],
    }))
  }

  const handleRetailChannelToggle = (channelId: number) => {
    setConfig(prev => ({
      ...prev,
      retailChannelIds: prev.retailChannelIds.includes(channelId)
        ? prev.retailChannelIds.filter(id => id !== channelId)
        : [...prev.retailChannelIds, channelId],
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-200">
            <Settings2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">자동화 설정</h1>
            <p className="text-gray-500 text-xs">워크플로우 스케줄 및 파이프라인 설정</p>
          </div>
        </div>
      </div>

      {/* CSS for shake animation */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>

      {/* 자동화 상태 배너 */}
      <div
        className={`relative overflow-hidden p-4 rounded-xl border-2 transition-all ease-out ${
          warningPhase === 'shake' ? 'duration-0' : 'duration-300'
        } ${
          warningPhase === 'shake'
            ? 'bg-red-50 border-red-400 animate-shake'
            : config.isEnabled
              ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 border-transparent shadow-lg'
              : 'bg-gradient-to-r from-gray-50 to-slate-100 border-gray-200'
        }`}
      >
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              warningPhase === 'shake'
                ? 'bg-red-200'
                : config.isEnabled
                  ? 'bg-white/20 backdrop-blur-sm'
                  : 'bg-gray-200'
            }`}>
              <Zap className={`w-5 h-5 transition-all ${
                warningPhase === 'shake'
                  ? 'text-red-600'
                  : config.isEnabled
                    ? 'text-white'
                    : 'text-gray-400'
              }`} />
            </div>
            <div className={config.isEnabled ? 'text-white' : ''}>
              <div className="flex items-center gap-2">
                <h2 className={`text-base font-bold transition-all ${
                  warningPhase === 'shake'
                    ? 'text-red-700'
                    : config.isEnabled
                      ? 'text-white'
                      : 'text-gray-700'
                }`}>
                  {warningSections.length > 0
                    ? '저장되지 않은 설정이 있습니다'
                    : config.isEnabled
                      ? '자동화 실행 중'
                      : '자동화 비활성화'
                  }
                </h2>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                  warningPhase === 'shake'
                    ? 'bg-red-200 text-red-700'
                    : config.isEnabled
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 text-gray-600'
                }`}>
                  {config.isEnabled ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className={`text-xs mt-0.5 transition-all ${
                warningPhase === 'shake'
                  ? 'text-red-600'
                  : config.isEnabled
                    ? 'text-green-100'
                    : 'text-gray-500'
              }`}>
                {warningSections.length > 0
                  ? '아래 빨간색으로 표시된 섹션을 저장해주세요'
                  : config.isEnabled
                    ? (
                      <span className="flex items-center gap-2">
                        <Clock size={12} />
                        <span>다음: <span className="font-semibold text-white">{getNextExecution(config.cronInterval)}</span></span>
                        <span className="w-1 h-1 bg-green-200 rounded-full" />
                        <span>{INTERVAL_OPTIONS.find(o => o.value === config.cronInterval)?.label}</span>
                      </span>
                    )
                    : '아래 설정을 완료하고 자동화를 시작하세요'
                }
              </p>
            </div>
          </div>
          {/* 토글 스위치 */}
          <button
            onClick={() => config.isEnabled ? handleStopAutomation() : handleStartAutomation()}
            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              warningPhase === 'shake'
                ? 'bg-red-300 focus:ring-red-500'
                : config.isEnabled
                  ? 'bg-white/30 focus:ring-white'
                  : 'bg-gray-300 focus:ring-green-500'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                config.isEnabled ? 'translate-x-9' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Shop Selection Section - 발행 설정과 동일한 스타일 */}
      <Card className={`overflow-hidden transition-all ${warningSections.includes('shop') && warningPhase === 'shake' ? 'ring-2 ring-red-400' : ''}`}>
        <div className="p-4 pb-5 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-200">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">쇼핑몰 발행</h2>
                  {hasShopChanges && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                  )}
                  {config.shopIds.length > 0 && (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-700">
                      {config.shopIds.length}개
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">상품이 발행될 쇼핑몰을 선택하세요 (복수 선택 가능)</p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSaveSection('shop')}
              disabled={savingSection === 'shop' || !hasShopChanges}
              className="flex items-center gap-2 text-sm px-4 shadow-md"
            >
              {savingSection === 'shop' ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              저장
            </Button>
          </div>

          {shops.length > 0 ? (
            <div className="grid grid-cols-4 gap-4">
              {shops.map((shop) => {
                const isSelected = config.shopIds.includes(shop.id)
                return (
                  <div
                    key={shop.id}
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        shopIds: prev.shopIds.includes(shop.id)
                          ? prev.shopIds.filter(id => id !== shop.id)
                          : [...prev.shopIds, shop.id]
                      }))
                    }}
                    className={`
                      relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 group
                      ${isSelected
                        ? 'border-rose-500 shadow-lg shadow-rose-100 scale-[1.02]'
                        : 'border-gray-200 hover:border-rose-300 hover:shadow-md hover:scale-[1.01]'
                      }
                    `}
                  >
                    <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
                      {shop.coverUrl ? (
                        <img
                          src={shop.coverUrl}
                          alt={shop.name}
                          className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? '' : 'group-hover:scale-105'}`}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-300">
                          <ShoppingBag size={36} />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-gradient-to-t from-rose-500/30 to-transparent" />
                      )}
                      {!isSelected && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                      )}
                    </div>
                    <div className={`p-2 text-center transition-colors ${isSelected ? 'bg-rose-50' : 'bg-white'}`}>
                      <span className={`text-sm font-medium line-clamp-1 ${isSelected ? 'text-rose-700' : 'text-gray-700'}`}>{shop.name}</span>
                      <p className={`text-xs ${isSelected ? 'text-rose-500' : 'text-gray-400'}`}>{shop.subdomain}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-br from-rose-500 to-pink-600 rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-5 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200">
              <p className="text-gray-600 text-sm">
                등록된 쇼핑몰이 없습니다.
                <a href="/admin/settings/shop" className="text-blue-600 hover:underline font-medium ml-1">
                  설정 &gt; 쇼핑몰 설정
                </a>
                에서 추가해주세요.
              </p>
            </div>
          )}
          {config.shopIds.length === 0 && shops.length > 0 && (
            <div className="flex items-center gap-3 mt-5 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <ShoppingBag size={16} className="text-amber-600" />
              </div>
              <p className="text-sm text-amber-700 font-medium">
                상품이 발행될 쇼핑몰을 선택해주세요
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Row 1: Schedule Settings + AI Settings - 2 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Schedule Settings */}
        <Card className={`overflow-hidden transition-all ${warningSections.includes('schedule') && warningPhase === 'shake' ? 'ring-2 ring-red-400' : ''}`}>
          <div className="p-4 pb-5 flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">실행 주기</h2>
                    {hasScheduleChanges && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">자동화가 실행될 간격을 선택하세요</p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveSection('schedule')}
                disabled={savingSection === 'schedule' || !hasScheduleChanges}
                className="flex items-center gap-2 text-sm px-4 shadow-md"
              >
                {savingSection === 'schedule' ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                저장
              </Button>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {INTERVAL_OPTIONS.map((option) => {
                const isSelected = config.cronInterval === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => setConfig(prev => ({ ...prev, cronInterval: option.value }))}
                    className={`
                      relative group px-3 py-4 rounded-xl border-2 transition-all duration-200 text-center
                      ${isSelected
                        ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50 shadow-md shadow-violet-100'
                        : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-sm'
                      }
                    `}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                    <div className={`font-bold text-xl mb-1 ${isSelected ? 'text-violet-700' : 'text-gray-700 group-hover:text-violet-600'}`}>
                      {option.label}
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-violet-600' : 'text-gray-400'}`}>
                      {option.description}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 다음 실행 시간 미리보기 */}
            <div className="mt-5 p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100">
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} className="text-violet-500" />
                <span className="text-violet-700 font-medium">다음 실행:</span>
                <span className="text-violet-900 font-bold">{getNextExecution(config.cronInterval)}</span>
                <span className="text-violet-400 mx-1">|</span>
                <span className="text-violet-600 text-xs">
                  {INTERVAL_OPTIONS.find(o => o.value === config.cronInterval)?.examples}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* AI Settings */}
        <Card className={`overflow-hidden transition-all ${warningSections.includes('ai') && warningPhase === 'shake' ? 'ring-2 ring-red-400' : ''}`}>
          <div className="p-4 pb-5 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">AI 변환 설정</h2>
                    {hasAiChanges && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">상품 정보 변환에 사용할 AI를 선택하세요</p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveSection('ai')}
                disabled={savingSection === 'ai' || !hasAiChanges}
                className="flex items-center gap-2 text-sm px-4 shadow-md"
              >
                {savingSection === 'ai' ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                저장
              </Button>
            </div>

            <div className="space-y-6 flex-1">
              {/* AI Provider */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">AI 제공자</label>
                {configuredAiProviders.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {configuredAiProviders.map((ai) => {
                      const isSelected = config.aiProvider === ai.provider
                      return (
                        <button
                          key={ai.provider}
                          onClick={() => setConfig(prev => ({ ...prev, aiProvider: ai.provider }))}
                          className={`
                            relative group flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all duration-200
                            ${isSelected
                              ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md shadow-amber-100'
                              : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                            }
                          `}
                        >
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center shadow-md">
                              <Check size={14} className="text-white" />
                            </div>
                          )}
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            ai.provider === 'GEMINI'
                              ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                              : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                          }`}>
                            {ai.provider === 'GEMINI' ? (
                              <Sparkles size={20} className="text-white" />
                            ) : (
                              <Bot size={20} className="text-white" />
                            )}
                          </div>
                          <div className="text-left">
                            <div className={`font-bold ${isSelected ? 'text-amber-700' : 'text-gray-800'}`}>{ai.name}</div>
                            <div className="text-xs text-gray-500">
                              {ai.provider === 'GEMINI' ? 'Google AI' : 'OpenAI'}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-600">
                      <a href="/admin/settings/ai" className="text-blue-600 hover:underline font-medium">AI 설정</a>에서 API 키를 등록하세요
                    </p>
                  </div>
                )}
              </div>

              {/* Pricing Policy */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">가격 정책</label>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setConfig(prev => ({ ...prev, pricingPolicyId: null }))}
                    className={`
                      relative group flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 text-sm
                      ${config.pricingPolicyId === null
                        ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm'
                        : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                      }
                    `}
                  >
                    {config.pricingPolicyId === null && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                    <FileText size={16} className={config.pricingPolicyId === null ? 'text-amber-600' : 'text-gray-400'} />
                    <span className={`font-medium ${config.pricingPolicyId === null ? 'text-amber-700' : 'text-gray-600'}`}>없음</span>
                  </button>
                  {pricingPolicies.map((policy) => {
                    const isSelected = config.pricingPolicyId === policy.id
                    return (
                      <button
                        key={policy.id}
                        onClick={() => setConfig(prev => ({ ...prev, pricingPolicyId: policy.id }))}
                        className={`
                          relative group flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 text-sm
                          ${isSelected
                            ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm'
                            : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                          }
                        `}
                      >
                        {isSelected && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                        <FileText size={16} className={isSelected ? 'text-amber-600' : 'text-gray-400'} />
                        <span className={`font-medium truncate max-w-[120px] ${isSelected ? 'text-amber-700' : 'text-gray-600'}`}>{policy.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Collection + Publish Settings - 2 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Collection Settings - Wholesale Channel Cards */}
      <Card className={`overflow-hidden transition-all ${warningSections.includes('collection') && warningPhase === 'shake' ? 'ring-2 ring-red-400' : ''}`}>
        <div className="p-4 pb-5 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">수집 설정</h2>
                  {hasCollectionChanges && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                  )}
                  {config.wholesaleChannelIds.length > 0 && (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700">
                      {config.wholesaleChannelIds.length}개
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">게시물을 수집할 도매밴드를 선택하세요</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {wholesaleChannels.length > CHANNELS_PER_PAGE && (
                <button
                  onClick={() => setShowAllWholesale(!showAllWholesale)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {showAllWholesale ? '접기' : '전체보기'}
                </button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveSection('collection')}
                disabled={savingSection === 'collection' || !hasCollectionChanges}
                className="flex items-center gap-2 text-sm px-4 shadow-md"
              >
                {savingSection === 'collection' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                저장
              </Button>
            </div>
          </div>

        {wholesaleChannels.length > 0 ? (
          showAllWholesale ? (
            /* 전체보기 모드 */
            <div className="grid grid-cols-4 gap-4">
              {wholesaleChannels.map((channel) => {
                const isSelected = config.wholesaleChannelIds.includes(channel.id)
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleWholesaleChannelToggle(channel.id)}
                    className={`
                      relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 group
                      ${isSelected
                        ? 'border-blue-500 shadow-lg shadow-blue-100 scale-[1.02]'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md hover:scale-[1.01]'
                      }
                    `}
                  >
                    <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
                      {channel.coverUrl ? (
                        <img src={channel.coverUrl} alt={channel.name} className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? '' : 'group-hover:scale-105'}`} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-300">
                          <Store size={36} />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/30 to-transparent" />
                      )}
                      {!isSelected && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                      )}
                    </div>
                    <div className={`p-2 text-center transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
                      <span className={`text-sm font-medium line-clamp-1 ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>{channel.name}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} className="text-white" />
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
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-9 h-9 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-all group"
              >
                <ChevronLeft size={18} className="text-gray-500 group-hover:text-blue-600" />
              </button>
            )}

            {/* Channel Cards */}
            <div className="grid grid-cols-4 gap-4 overflow-hidden">
              {wholesaleChannels.slice(wholesaleStartIndex, wholesaleStartIndex + CHANNELS_PER_PAGE).map((channel) => {
                const isSelected = config.wholesaleChannelIds.includes(channel.id)
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleWholesaleChannelToggle(channel.id)}
                    className={`
                      relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 group
                      ${isSelected
                        ? 'border-blue-500 shadow-lg shadow-blue-100 scale-[1.02]'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md hover:scale-[1.01]'
                      }
                    `}
                  >
                    {/* Image */}
                    <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
                      {channel.coverUrl ? (
                        <img
                          src={channel.coverUrl}
                          alt={channel.name}
                          className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? '' : 'group-hover:scale-105'}`}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-300">
                          <Store size={36} />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/30 to-transparent" />
                      )}
                      {!isSelected && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                      )}
                    </div>
                    {/* Channel Name */}
                    <div className={`p-2 text-center transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
                      <span className={`text-sm font-medium line-clamp-1 ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>{channel.name}</span>
                    </div>
                    {/* Selection Check */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Right Arrow */}
            {wholesaleStartIndex + CHANNELS_PER_PAGE < wholesaleChannels.length && (
              <button
                onClick={() => setWholesaleStartIndex(prev => Math.min(wholesaleChannels.length - CHANNELS_PER_PAGE, prev + 1))}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-9 h-9 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-all group"
              >
                <ChevronRight size={18} className="text-gray-500 group-hover:text-blue-600" />
              </button>
            )}

            {/* Page Indicator */}
            {wholesaleChannels.length > CHANNELS_PER_PAGE && (
              <div className="flex justify-center mt-4 gap-1.5">
                {Array.from({ length: Math.ceil(wholesaleChannels.length / CHANNELS_PER_PAGE) }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setWholesaleStartIndex(idx * CHANNELS_PER_PAGE)}
                    className={`h-1.5 rounded-full transition-all ${
                      Math.floor(wholesaleStartIndex / CHANNELS_PER_PAGE) === idx
                        ? 'bg-blue-500 w-4'
                        : 'bg-gray-300 hover:bg-blue-300 w-1.5'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          )
        ) : (
          <div className="p-5 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200">
            <p className="text-gray-600 text-sm">
              등록된 도매밴드가 없습니다.
              <a href="/channel" className="text-blue-600 hover:underline font-medium ml-1">
                밴드관리 &gt; 도매밴드 관리
              </a>
              에서 추가해주세요.
            </p>
          </div>
        )}
          {config.wholesaleChannelIds.length === 0 && wholesaleChannels.length > 0 && (
            <div className="flex items-center gap-3 mt-5 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Store size={16} className="text-amber-600" />
              </div>
              <p className="text-sm text-amber-700 font-medium">
                수집할 도매밴드를 선택해주세요
              </p>
            </div>
          )}
        </div>
      </Card>

        {/* Publish Settings - Retail Channel Cards */}
      <Card className={`overflow-hidden transition-all ${warningSections.includes('publish') && warningPhase === 'shake' ? 'ring-2 ring-red-400' : ''}`}>
        <div className="p-4 pb-5 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">발행 설정</h2>
                  {hasPublishChanges && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                  )}
                  {config.retailChannelIds.length > 0 && (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700">
                      {config.retailChannelIds.length}개
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">상품을 발행할 소매밴드를 선택하세요</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {retailChannels.length > CHANNELS_PER_PAGE && (
                <button
                  onClick={() => setShowAllRetail(!showAllRetail)}
                  className="text-sm text-green-600 hover:text-green-800 font-medium px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                >
                  {showAllRetail ? '접기' : '전체보기'}
                </button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveSection('publish')}
                disabled={savingSection === 'publish' || !hasPublishChanges}
                className="flex items-center gap-2 text-sm px-4 shadow-md"
              >
                {savingSection === 'publish' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                저장
              </Button>
            </div>
          </div>

        {retailChannels.length > 0 ? (
          showAllRetail ? (
            /* 전체보기 모드 */
            <div className="grid grid-cols-4 gap-4">
              {retailChannels.map((channel) => {
                const isSelected = config.retailChannelIds.includes(channel.id)
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleRetailChannelToggle(channel.id)}
                    className={`
                      relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 group
                      ${isSelected
                        ? 'border-green-500 shadow-lg shadow-green-100 scale-[1.02]'
                        : 'border-gray-200 hover:border-green-300 hover:shadow-md hover:scale-[1.01]'
                      }
                    `}
                  >
                    <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
                      {channel.coverUrl ? (
                        <img src={channel.coverUrl} alt={channel.name} className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? '' : 'group-hover:scale-105'}`} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-300">
                          <Send size={36} />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-gradient-to-t from-green-500/30 to-transparent" />
                      )}
                      {!isSelected && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                      )}
                    </div>
                    <div className={`p-2 text-center transition-colors ${isSelected ? 'bg-green-50' : 'bg-white'}`}>
                      <span className={`text-sm font-medium line-clamp-1 ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>{channel.name}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} className="text-white" />
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
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-9 h-9 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-green-50 hover:border-green-300 transition-all group"
              >
                <ChevronLeft size={18} className="text-gray-500 group-hover:text-green-600" />
              </button>
            )}

            {/* Channel Cards */}
            <div className="grid grid-cols-4 gap-4 overflow-hidden">
              {retailChannels.slice(retailStartIndex, retailStartIndex + CHANNELS_PER_PAGE).map((channel) => {
                const isSelected = config.retailChannelIds.includes(channel.id)
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleRetailChannelToggle(channel.id)}
                    className={`
                      relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 group
                      ${isSelected
                        ? 'border-green-500 shadow-lg shadow-green-100 scale-[1.02]'
                        : 'border-gray-200 hover:border-green-300 hover:shadow-md hover:scale-[1.01]'
                      }
                    `}
                  >
                    {/* Image */}
                    <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
                      {channel.coverUrl ? (
                        <img
                          src={channel.coverUrl}
                          alt={channel.name}
                          className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? '' : 'group-hover:scale-105'}`}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-300">
                          <Send size={36} />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-gradient-to-t from-green-500/30 to-transparent" />
                      )}
                      {!isSelected && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                      )}
                    </div>
                    {/* Channel Name */}
                    <div className={`p-2 text-center transition-colors ${isSelected ? 'bg-green-50' : 'bg-white'}`}>
                      <span className={`text-sm font-medium line-clamp-1 ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>{channel.name}</span>
                    </div>
                    {/* Selection Check */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Right Arrow */}
            {retailStartIndex + CHANNELS_PER_PAGE < retailChannels.length && (
              <button
                onClick={() => setRetailStartIndex(prev => Math.min(retailChannels.length - CHANNELS_PER_PAGE, prev + 1))}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-9 h-9 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-green-50 hover:border-green-300 transition-all group"
              >
                <ChevronRight size={18} className="text-gray-500 group-hover:text-green-600" />
              </button>
            )}

            {/* Page Indicator */}
            {retailChannels.length > CHANNELS_PER_PAGE && (
              <div className="flex justify-center mt-4 gap-1.5">
                {Array.from({ length: Math.ceil(retailChannels.length / CHANNELS_PER_PAGE) }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setRetailStartIndex(idx * CHANNELS_PER_PAGE)}
                    className={`h-1.5 rounded-full transition-all ${
                      Math.floor(retailStartIndex / CHANNELS_PER_PAGE) === idx
                        ? 'bg-green-500 w-4'
                        : 'bg-gray-300 hover:bg-green-300 w-1.5'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          )
        ) : (
          <div className="p-5 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200">
            <p className="text-gray-600 text-sm">
              등록된 소매밴드가 없습니다.
              <a href="/channel" className="text-blue-600 hover:underline font-medium ml-1">
                밴드관리 &gt; 소매밴드 관리
              </a>
              에서 추가해주세요.
            </p>
          </div>
        )}
          {config.retailChannelIds.length === 0 && retailChannels.length > 0 && (
            <div className="flex items-center gap-3 mt-5 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Send size={16} className="text-amber-600" />
              </div>
              <p className="text-sm text-amber-700 font-medium">
                발행할 소매밴드를 선택해주세요
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
    </div>
  )
}
