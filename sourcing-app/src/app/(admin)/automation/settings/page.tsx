'use client'

import { useState, useEffect } from 'react'
import { Save, RefreshCw, Store, Send, Sparkles, Bot, Check, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

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

interface AutomationConfig {
  isEnabled: boolean
  cronInterval: string
  collectFromAllChannels: boolean
  wholesaleChannelIds: number[]
  aiProvider: string
  pricingPolicyId: number | null
  autoPublish: boolean
  retailChannelIds: number[]
}

const INTERVAL_OPTIONS = [
  { value: '1h', label: '1시간마다', description: '매 정각 실행 (0분)', examples: '1:00, 2:00, 3:00...' },
  { value: '3h', label: '3시간마다', description: '매 3시간 정각', examples: '0:00, 3:00, 6:00, 9:00...' },
  { value: '6h', label: '6시간마다', description: '매 6시간 정각', examples: '0:00, 6:00, 12:00, 18:00' },
  { value: '12h', label: '12시간마다', description: '매 12시간 정각', examples: '0:00, 12:00' },
  { value: '24h', label: '24시간마다', description: '매일 자정', examples: '0:00 (자정)' },
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
  autoPublish: false,
  retailChannelIds: [],
}

export default function AutomationSettingsPage() {
  const [config, setConfig] = useState<AutomationConfig>(defaultConfig)
  const [initialConfig, setInitialConfig] = useState<AutomationConfig>(defaultConfig)
  const [wholesaleChannels, setWholesaleChannels] = useState<Channel[]>([])
  const [retailChannels, setRetailChannels] = useState<Channel[]>([])
  const [pricingPolicies, setPricingPolicies] = useState<PricingPolicy[]>([])
  const [configuredAiProviders, setConfiguredAiProviders] = useState<AiProviderInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [wholesaleStartIndex, setWholesaleStartIndex] = useState(0)
  const [retailStartIndex, setRetailStartIndex] = useState(0)
  const [showAllWholesale, setShowAllWholesale] = useState(false)
  const [showAllRetail, setShowAllRetail] = useState(false)
  const [warningSections, setWarningSections] = useState<string[]>([])
  const [warningPhase, setWarningPhase] = useState<'idle' | 'shake' | 'fading'>('idle')

  const CHANNELS_PER_PAGE = 6

  // 섹션별 변경 여부 확인 (isEnabled는 버튼으로 변경하므로 제외)
  const hasScheduleChanges = config.cronInterval !== initialConfig.cronInterval

  const hasCollectionChanges = JSON.stringify((config.wholesaleChannelIds || []).slice().sort()) !==
    JSON.stringify((initialConfig.wholesaleChannelIds || []).slice().sort())

  const hasAiChanges = config.aiProvider !== initialConfig.aiProvider ||
    config.pricingPolicyId !== initialConfig.pricingPolicyId

  const hasPublishChanges = JSON.stringify((config.retailChannelIds || []).slice().sort()) !==
    JSON.stringify((initialConfig.retailChannelIds || []).slice().sort())

  // 저장되지 않은 변경사항이 있는지 확인
  const hasUnsavedChanges = hasScheduleChanges || hasCollectionChanges || hasAiChanges || hasPublishChanges

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
      }
    } catch (error) {
      console.error('자동화 상태 저장 실패:', error)
    }
  }

  // 자동화 시작 핸들러
  const handleStartAutomation = () => {
    const unsavedSections: string[] = []

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
      const [configRes, wholesaleRes, retailRes, policyRes, aiSettingsRes] = await Promise.all([
        fetch('/api/automation/config'),
        fetch('/api/channel?kind=WHOLESALE'),
        fetch('/api/channel?kind=RETAIL'),
        fetch('/api/policy'),
        fetch('/api/settings/ai'),
      ])

      const configData = await configRes.json()
      const wholesaleData = await wholesaleRes.json()
      const retailData = await retailRes.json()
      const policyData = await policyRes.json()
      const aiSettingsData = await aiSettingsRes.json()

      if (configData.success) {
        const loadedConfig = {
          ...defaultConfig,
          ...configData.data,
          wholesaleChannelIds: configData.data?.wholesaleChannelIds || [],
          retailChannelIds: configData.data?.retailChannelIds || [],
        }
        setConfig(loadedConfig)
        setInitialConfig(loadedConfig)
      }
      if (wholesaleData.success) {
        setWholesaleChannels(wholesaleData.data || [])
      }
      if (retailData.success) {
        setRetailChannels(retailData.data || [])
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">자동화 설정</h1>
        <p className="text-gray-600 mt-1">자동화 워크플로우 스케줄 및 설정</p>
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
      {config.isEnabled ? (
        <div className="p-5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              </div>
              <div className="text-white">
                <h2 className="text-xl font-bold">자동화 실행 중</h2>
                <p className="text-green-100 text-sm mt-1">
                  다음 실행: <span className="font-semibold text-white">{getNextExecution(config.cronInterval)}</span>
                  <span className="mx-2">•</span>
                  {INTERVAL_OPTIONS.find(o => o.value === config.cronInterval)?.label}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={handleStopAutomation}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              자동화 중지
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`p-5 rounded-xl border-2 transition-all ease-out ${
            warningPhase === 'shake' ? 'duration-0' : 'duration-[2000ms]'
          } ${
            warningPhase === 'shake'
              ? 'bg-red-100 border-red-500 animate-shake'
              : warningPhase === 'fading'
              ? 'bg-gray-100 border-gray-300'
              : 'bg-gray-100 border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ease-out ${
                warningPhase === 'shake' ? 'duration-0 bg-red-300' : 'duration-[2000ms] bg-gray-300'
              }`}>
                <div className={`w-3 h-3 rounded-full transition-all ease-out ${
                  warningPhase === 'shake' ? 'duration-0 bg-red-600' : 'duration-[2000ms] bg-gray-500'
                }`} />
              </div>
              <div>
                <h2 className={`text-xl font-bold transition-all ease-out ${
                  warningPhase === 'shake' ? 'duration-0 text-red-700' : 'duration-[2000ms] text-gray-700'
                }`}>
                  {warningSections.length > 0 ? '저장되지 않은 설정이 있습니다' : '자동화 비활성화'}
                </h2>
                <p className={`text-sm mt-1 transition-all ease-out ${
                  warningPhase === 'shake' ? 'duration-0 text-red-600' : 'duration-[2000ms] text-gray-500'
                }`}>
                  {warningSections.length > 0
                    ? '아래 빨간색으로 표시된 섹션을 저장해주세요'
                    : '아래 설정을 완료하고 자동화를 시작하세요'
                  }
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={handleStartAutomation}
              className={`transition-all ease-out ${
                warningPhase === 'shake'
                  ? 'duration-0 bg-red-500 hover:bg-red-600'
                  : 'duration-[2000ms] bg-green-600 hover:bg-green-700'
              }`}
            >
              자동화 시작
            </Button>
          </div>
        </div>
      )}

      {/* Schedule Settings */}
      <Card className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">실행 주기</h2>
            {hasScheduleChanges && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600">저장 필요</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">모든 실행은 정각(0분)에 시작됩니다.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {INTERVAL_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setConfig(prev => ({ ...prev, cronInterval: option.value }))}
              className={`
                px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors text-left
                ${config.cronInterval === option.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }
              `}
            >
              <div className="font-semibold">{option.label}</div>
              <div className={`text-xs mt-1 ${config.cronInterval === option.value ? 'text-blue-600' : 'text-gray-500'}`}>
                {option.examples}
              </div>
            </button>
          ))}
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

      {/* Collection Settings - Wholesale Channel Cards */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">수집 설정</h2>
            {hasCollectionChanges && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600">저장 필요</span>
            )}
          </div>
          {wholesaleChannels.length > CHANNELS_PER_PAGE && (
            <button
              onClick={() => setShowAllWholesale(!showAllWholesale)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showAllWholesale ? '접기' : '전체보기'}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">게시물을 수집할 도매밴드를 선택하세요. 선택하지 않으면 모든 밴드에서 수집합니다.</p>

        {wholesaleChannels.length > 0 ? (
          showAllWholesale ? (
            /* 전체보기 모드 */
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {wholesaleChannels.map((channel) => {
                const isSelected = config.wholesaleChannelIds.includes(channel.id)
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleWholesaleChannelToggle(channel.id)}
                    className={`
                      relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="h-60 bg-gray-100">
                      {channel.coverUrl ? (
                        <img src={channel.coverUrl} alt={channel.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <Store size={40} />
                        </div>
                      )}
                    </div>
                    <div className="p-2 text-center bg-white">
                      <span className="text-xs font-medium text-gray-800 line-clamp-1">{channel.name}</span>
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

            {/* Channel Cards */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 overflow-hidden">
              {wholesaleChannels.slice(wholesaleStartIndex, wholesaleStartIndex + CHANNELS_PER_PAGE).map((channel) => {
                const isSelected = config.wholesaleChannelIds.includes(channel.id)
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleWholesaleChannelToggle(channel.id)}
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
                      {channel.coverUrl ? (
                        <img
                          src={channel.coverUrl}
                          alt={channel.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <Store size={40} />
                        </div>
                      )}
                    </div>
                    {/* Channel Name */}
                    <div className="p-2 text-center bg-white">
                      <span className="text-xs font-medium text-gray-800 line-clamp-1">{channel.name}</span>
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
            {wholesaleStartIndex + CHANNELS_PER_PAGE < wholesaleChannels.length && (
              <button
                onClick={() => setWholesaleStartIndex(prev => Math.min(wholesaleChannels.length - CHANNELS_PER_PAGE, prev + 1))}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 bg-white border border-gray-300 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={20} className="text-gray-600" />
              </button>
            )}

            {/* Page Indicator */}
            {wholesaleChannels.length > CHANNELS_PER_PAGE && (
              <div className="flex justify-center mt-4 gap-1">
                {Array.from({ length: Math.ceil(wholesaleChannels.length / CHANNELS_PER_PAGE) }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setWholesaleStartIndex(idx * CHANNELS_PER_PAGE)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      Math.floor(wholesaleStartIndex / CHANNELS_PER_PAGE) === idx
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
              <a href="/channel" className="text-blue-600 hover:underline ml-1">
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
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">AI 변환 설정</h2>
          {hasAiChanges && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600">저장 필요</span>
          )}
        </div>

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

      {/* Publish Settings - Retail Channel Cards */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">발행 설정</h2>
            {hasPublishChanges && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600">저장 필요</span>
            )}
          </div>
          {retailChannels.length > CHANNELS_PER_PAGE && (
            <button
              onClick={() => setShowAllRetail(!showAllRetail)}
              className="text-sm text-green-600 hover:text-green-800 font-medium"
            >
              {showAllRetail ? '접기' : '전체보기'}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">상품을 발행할 소매밴드를 선택하세요.</p>

        {retailChannels.length > 0 ? (
          showAllRetail ? (
            /* 전체보기 모드 */
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {retailChannels.map((channel) => {
                const isSelected = config.retailChannelIds.includes(channel.id)
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleRetailChannelToggle(channel.id)}
                    className={`
                      relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected
                        ? 'border-green-500 ring-2 ring-green-200'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="h-60 bg-gray-100">
                      {channel.coverUrl ? (
                        <img src={channel.coverUrl} alt={channel.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <Send size={40} />
                        </div>
                      )}
                    </div>
                    <div className="p-2 text-center bg-white">
                      <span className="text-xs font-medium text-gray-800 line-clamp-1">{channel.name}</span>
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

            {/* Channel Cards */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 overflow-hidden">
              {retailChannels.slice(retailStartIndex, retailStartIndex + CHANNELS_PER_PAGE).map((channel) => {
                const isSelected = config.retailChannelIds.includes(channel.id)
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleRetailChannelToggle(channel.id)}
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
                      {channel.coverUrl ? (
                        <img
                          src={channel.coverUrl}
                          alt={channel.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <Send size={40} />
                        </div>
                      )}
                    </div>
                    {/* Channel Name */}
                    <div className="p-2 text-center bg-white">
                      <span className="text-xs font-medium text-gray-800 line-clamp-1">{channel.name}</span>
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
            {retailStartIndex + CHANNELS_PER_PAGE < retailChannels.length && (
              <button
                onClick={() => setRetailStartIndex(prev => Math.min(retailChannels.length - CHANNELS_PER_PAGE, prev + 1))}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 bg-white border border-gray-300 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={20} className="text-gray-600" />
              </button>
            )}

            {/* Page Indicator */}
            {retailChannels.length > CHANNELS_PER_PAGE && (
              <div className="flex justify-center mt-4 gap-1">
                {Array.from({ length: Math.ceil(retailChannels.length / CHANNELS_PER_PAGE) }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setRetailStartIndex(idx * CHANNELS_PER_PAGE)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      Math.floor(retailStartIndex / CHANNELS_PER_PAGE) === idx
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
              <a href="/channel" className="text-blue-600 hover:underline ml-1">
                밴드관리 &gt; 소매밴드 관리
              </a>
              에서 추가해주세요.
            </p>
          </div>
        )}
        {config.retailChannelIds.length === 0 && retailChannels.length > 0 && (
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
