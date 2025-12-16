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
  selectedHours: number[]
  collectFromAllChannels: boolean
  wholesaleChannelIds: number[]
  aiProvider: string
  pricingPolicyId: number | null
  retailChannelIds: number[]
  shopIds: number[]
}

// 00:00 ~ 23:00 시간 버튼 생성
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  label: `${i.toString().padStart(2, '0')}:00`,
}))

// 다음 실행까지 남은 시간을 계산하는 함수
const getNextExecutionInfo = (selectedHours: number[]): { text: string; remainingText: string } => {
  if (selectedHours.length === 0) {
    return { text: '실행 시간을 선택해주세요', remainingText: '' }
  }

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  const sortedHours = [...selectedHours].sort((a, b) => a - b)

  let nextHour: number | null = null
  let isToday = true

  // 오늘 남은 시간 중 가장 가까운 것 찾기
  // 현재 시간이 14:30이면 14시는 이미 지났으므로 다음 시간을 찾아야 함
  for (const hour of sortedHours) {
    // 해당 시간이 현재 시간보다 크거나, 같은 시간이지만 아직 정각이 안 됐으면
    if (hour > currentHour || (hour === currentHour && currentMinute < 1)) {
      nextHour = hour
      break
    }
  }

  // 오늘 남은 시간이 없으면 내일 첫 번째 시간
  if (nextHour === null) {
    nextHour = sortedHours[0]
    isToday = false
  }

  // 남은 시간 계산
  const nextDate = new Date()
  if (!isToday) {
    nextDate.setDate(nextDate.getDate() + 1)
  }
  nextDate.setHours(nextHour, 0, 0, 0)

  const diffMs = nextDate.getTime() - now.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60

  const timeText = `${isToday ? '오늘' : '내일'} ${nextHour.toString().padStart(2, '0')}:00`

  let remainingText = ''
  if (hours > 0 && minutes > 0) {
    remainingText = `${hours}시간 ${minutes}분 후`
  } else if (hours > 0) {
    remainingText = `${hours}시간 후`
  } else if (minutes > 0) {
    remainingText = `${minutes}분 후`
  } else {
    remainingText = '곧 실행'
  }

  return { text: timeText, remainingText }
}

// 선택된 시간 요약
const getSelectedHoursSummary = (selectedHours: number[]): string => {
  if (selectedHours.length === 0) return '선택된 시간 없음'
  if (selectedHours.length === 24) return '매 시간 (24회/일)'

  const sortedHours = [...selectedHours].sort((a, b) => a - b)
  if (sortedHours.length <= 4) {
    return sortedHours.map(h => `${h.toString().padStart(2, '0')}:00`).join(', ')
  }
  return `${sortedHours.length}개 시간 선택됨`
}

const defaultConfig: AutomationConfig = {
  isEnabled: false,
  cronInterval: 'custom',
  selectedHours: [],
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
  const [nextExecution, setNextExecution] = useState<{ text: string; remainingText: string }>({ text: '', remainingText: '' })

  const CHANNELS_PER_PAGE = 4

  // 섹션별 변경 여부 확인 (isEnabled는 버튼으로 변경하므로 제외)
  const hasScheduleChanges = JSON.stringify([...(config.selectedHours || [])].sort()) !==
    JSON.stringify([...(initialConfig.selectedHours || [])].sort())

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

  // 필수 설정 누락 여부 (설정이 아예 안 된 경우)
  const isScheduleMissing = config.selectedHours.length === 0
  const isShopMissing = config.shopIds.length === 0
  const isCollectionMissing = config.wholesaleChannelIds.length === 0
  const isAiMissing = !config.aiProvider
  const isPublishMissing = config.retailChannelIds.length === 0

  // 섹션별 문제 여부 (설정 누락 또는 저장 안 됨)
  const hasScheduleProblem = isScheduleMissing || hasScheduleChanges
  const hasShopProblem = isShopMissing || hasShopChanges
  const hasCollectionProblem = isCollectionMissing || hasCollectionChanges
  const hasAiProblem = isAiMissing || hasAiChanges
  const hasPublishProblem = isPublishMissing || hasPublishChanges

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
    // 필수 설정 검증 - 설정이 안 된 섹션 확인
    const missingSections: string[] = []

    // 실행 시간 선택 확인
    if (config.selectedHours.length === 0) {
      missingSections.push('schedule')
    }

    // 쇼핑몰 선택 확인
    if (config.shopIds.length === 0) {
      missingSections.push('shop')
    }

    // 수집할 도매채널 확인
    if (config.wholesaleChannelIds.length === 0) {
      missingSections.push('collection')
    }

    // AI 제공자 확인
    if (!config.aiProvider) {
      missingSections.push('ai')
    }

    // 발행할 소매채널 확인
    if (config.retailChannelIds.length === 0) {
      missingSections.push('publish')
    }

    // 저장되지 않은 변경사항 확인
    const unsavedSections: string[] = []
    if (hasShopChanges) unsavedSections.push('shop')
    if (hasScheduleChanges) unsavedSections.push('schedule')
    if (hasCollectionChanges) unsavedSections.push('collection')
    if (hasAiChanges) unsavedSections.push('ai')
    if (hasPublishChanges) unsavedSections.push('publish')

    // 설정 누락 또는 저장되지 않은 섹션이 있으면 빨간색 강조
    const problemSections = [...new Set([...missingSections, ...unsavedSections])]

    if (problemSections.length > 0) {
      // 1단계: 빨간색 + 진동
      setWarningSections(problemSections)
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

  // 다음 실행 시간 실시간 업데이트 (1분마다)
  useEffect(() => {
    const updateNextExecution = () => {
      setNextExecution(getNextExecutionInfo(config.selectedHours))
    }

    // 초기 계산
    updateNextExecution()

    // 1분마다 업데이트
    const interval = setInterval(updateNextExecution, 60000)

    return () => clearInterval(interval)
  }, [config.selectedHours])

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
            selectedHours: configData.data?.selectedHours || [],
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
      // 섹션별로 저장할 데이터 구성
      let sectionData: Partial<AutomationConfig> = {}

      switch (section) {
        case 'schedule':
          sectionData = { selectedHours: config.selectedHours }
          break
        case 'shop':
          sectionData = { shopIds: config.shopIds }
          break
        case 'collection':
          sectionData = { wholesaleChannelIds: config.wholesaleChannelIds }
          break
        case 'ai':
          sectionData = { aiProvider: config.aiProvider, pricingPolicyId: config.pricingPolicyId }
          break
        case 'publish':
          sectionData = { retailChannelIds: config.retailChannelIds }
          break
        default:
          sectionData = config
      }

      // 기존 설정에 섹션 데이터만 병합하여 저장
      const dataToSave = { ...initialConfig, ...sectionData }

      const response = await fetch('/api/automation/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      })

      const data = await response.json()

      if (data.success) {
        // 해당 섹션의 initialConfig만 업데이트
        setInitialConfig(prev => ({ ...prev, ...sectionData }))
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
                        <span>다음: <span className="font-semibold text-white">{nextExecution.text}</span></span>
                        {nextExecution.remainingText && (
                          <>
                            <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-medium">{nextExecution.remainingText}</span>
                            <span className="w-1 h-1 bg-green-200 rounded-full" />
                          </>
                        )}
                        <span>{getSelectedHoursSummary(config.selectedHours)}</span>
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

      {/* Schedule Settings - 독립 섹션 */}
      <Card className={`overflow-hidden transition-all ${warningSections.includes('schedule') && warningPhase === 'shake' ? 'ring-2 ring-red-400 animate-shake' : hasScheduleProblem ? 'ring-2 ring-red-300' : ''}`}>
        <div className="p-4 pb-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
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
                  {config.selectedHours.length > 0 && (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-violet-100 text-violet-700">
                      {config.selectedHours.length}개 시간
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">자동화가 실행될 시간을 선택하세요 (복수 선택 가능)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (config.selectedHours.length === 24) {
                    setConfig(prev => ({ ...prev, selectedHours: [] }))
                  } else {
                    setConfig(prev => ({ ...prev, selectedHours: HOUR_OPTIONS.map(o => o.hour) }))
                  }
                }}
                className="text-sm text-violet-600 hover:text-violet-800 font-medium px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
              >
                {config.selectedHours.length === 24 ? '전체 해제' : '전체 선택'}
              </button>
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
          </div>

          {/* 24시간 버튼 그리드 */}
          <div className="grid grid-cols-12 gap-1.5">
            {HOUR_OPTIONS.map((option) => {
              const isSelected = config.selectedHours.includes(option.hour)
              return (
                <button
                  key={option.hour}
                  onClick={() => {
                    setConfig(prev => ({
                      ...prev,
                      selectedHours: prev.selectedHours.includes(option.hour)
                        ? prev.selectedHours.filter(h => h !== option.hour)
                        : [...prev.selectedHours, option.hour]
                    }))
                  }}
                  className={`
                    relative group py-2 rounded-lg border-2 transition-all duration-200 text-center text-sm font-medium
                    ${isSelected
                      ? 'border-violet-500 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200'
                      : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600'
                    }
                  `}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          {/* 다음 실행 시간 미리보기 */}
          <div className="mt-4 p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-violet-500" />
                <span className="text-violet-700 font-medium">다음 실행:</span>
                <span className="text-violet-900 font-bold">{nextExecution.text}</span>
                {nextExecution.remainingText && (
                  <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                    {nextExecution.remainingText}
                  </span>
                )}
              </div>
              <span className="text-violet-600 text-xs">
                {getSelectedHoursSummary(config.selectedHours)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Row 1: Shop Selection + AI Settings - 2 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Shop Selection Section */}
        <Card className={`overflow-hidden transition-all ${warningSections.includes('shop') && warningPhase === 'shake' ? 'ring-2 ring-red-400 animate-shake' : hasShopProblem ? 'ring-2 ring-red-300' : ''}`}>
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
                  <p className="text-sm text-gray-500">상품이 발행될 쇼핑몰을 선택하세요</p>
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
              <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl border border-rose-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                      <ShoppingBag size={16} className="text-rose-600" />
                    </div>
                    <p className="text-sm text-rose-700">
                      등록된 쇼핑몰이 없습니다. 쇼핑몰을 추가해주세요.
                    </p>
                  </div>
                  <a
                    href="/shop/store/list"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <ShoppingBag size={14} />
                    쇼핑몰 설정
                  </a>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* AI Settings */}
        <Card className={`overflow-hidden transition-all ${warningSections.includes('ai') && warningPhase === 'shake' ? 'ring-2 ring-red-400 animate-shake' : hasAiProblem ? 'ring-2 ring-red-300' : ''}`}>
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
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                          <Sparkles size={16} className="text-amber-600" />
                        </div>
                        <p className="text-sm text-amber-700">
                          등록된 AI API가 없습니다. API 키를 등록해주세요.
                        </p>
                      </div>
                      <a
                        href="/sourcing/settings/ai"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Sparkles size={14} />
                        AI 설정
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Policy */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">가격 정책</label>
                {pricingPolicies.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
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
                ) : (
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                          <FileText size={16} className="text-amber-600" />
                        </div>
                        <p className="text-sm text-amber-700">
                          등록된 가격 정책이 없습니다. 정책을 추가해주세요.
                        </p>
                      </div>
                      <a
                        href="/sourcing/policy/list"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <FileText size={14} />
                        정책 설정
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Collection + Publish Settings - 2 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Collection Settings - Wholesale Channel Cards */}
      <Card className={`overflow-hidden transition-all ${warningSections.includes('collection') && warningPhase === 'shake' ? 'ring-2 ring-red-400 animate-shake' : hasCollectionProblem ? 'ring-2 ring-red-300' : ''}`}>
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
          <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Store size={16} className="text-blue-600" />
                </div>
                <p className="text-sm text-blue-700">
                  등록된 도매밴드가 없습니다. 도매밴드를 추가해주세요.
                </p>
              </div>
              <a
                href="/sourcing/channel"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Store size={14} />
                밴드 관리
              </a>
            </div>
          </div>
        )}
        </div>
      </Card>

        {/* Publish Settings - Retail Channel Cards */}
      <Card className={`overflow-hidden transition-all ${warningSections.includes('publish') && warningPhase === 'shake' ? 'ring-2 ring-red-400 animate-shake' : hasPublishProblem ? 'ring-2 ring-red-300' : ''}`}>
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
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Send size={16} className="text-green-600" />
                </div>
                <p className="text-sm text-green-700">
                  등록된 소매밴드가 없습니다. 소매밴드를 추가해주세요.
                </p>
              </div>
              <a
                href="/sourcing/channel"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Send size={14} />
                밴드 관리
              </a>
            </div>
          </div>
        )}
        </div>
      </Card>
    </div>
    </div>
  )
}
