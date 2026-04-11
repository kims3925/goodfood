'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, RefreshCw, Store, Send, Sparkles, Bot, Check, FileText, ChevronLeft, ChevronRight, Clock, Download, Upload, Zap, Settings2, ShoppingBag, AlertTriangle, ExternalLink, Settings, Info, Plus, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { PipelineStatusPanel, DisableAutomationModal, SessionMissingModal } from '@/components/automation'

interface ChannelShop {
  id: number
  name: string
  subdomain: string
  isActive: boolean
}

interface Channel {
  id: number
  name: string
  coverUrl: string | null
  kind: 'WHOLESALE' | 'RETAIL'
  shop?: ChannelShop | null
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

interface PipelineSteps {
  collection: boolean
  transform: boolean
  productCreate: boolean
  publish: boolean
}

interface StageProgress {
  completed: boolean
  total?: number
  success?: number
  failed?: number
  totalNewPosts?: number
  channelResults?: Array<{ channelId: number; channelName: string; newPosts: number }>
  batchProgress?: { current: number; total: number }
  currentChannel?: string
  currentProgress?: { current: number; total: number }
}

interface PipelineWorkflow {
  id: number
  type: string
  status: string
  startedAt: string
  totalItems: number
  successCount: number
  failedCount: number
  currentStage: 'collection' | 'transform' | 'productCreate' | 'publish' | null
  stageProgress: {
    collection?: StageProgress
    transform?: StageProgress
    productCreate?: StageProgress
    publish?: StageProgress
  }
}

interface AutomationConfig {
  isEnabled: boolean
  cronInterval: string
  scheduleTimes: string[]  // "HH:MM" 형식 (예: ["11:00", "16:30"])
  collectFromAllChannels: boolean
  wholesaleChannelIds: number[]
  aiProvider: string
  retailChannelIds: number[]
  shopIds: number[]
  pipelineSteps: PipelineSteps
  // 수집 기본값 (전체 적용) + 채널별 오버라이드
  collectionLimit: number
  collectionLimitByChannel: Record<number, number>
  // 발행 기본값 (전체 적용) + 쇼핑몰/소매밴드별 오버라이드
  autoPublishLimit: number
  autoPublishLimitByShop: Record<number, number>
  autoPublishLimitByChannel: Record<number, number>
}

// 12시간제 → 24시간제 변환
const to24Hour = (hour12: number, amPm: 'AM' | 'PM'): number => {
  if (amPm === 'AM') return hour12 === 12 ? 0 : hour12
  return hour12 === 12 ? 12 : hour12 + 12
}

// 24시간제 "HH:MM"을 "오전/오후 H:MM" 형식으로 표시
const formatTimeDisplay = (time: string): string => {
  const [h, m] = time.split(':').map(Number)
  const amPm = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${amPm} ${h12}:${m.toString().padStart(2, '0')}`
}

// "HH:MM" 시간 문자열 정렬
const sortTimes = (times: string[]): string[] =>
  [...times].sort((a, b) => {
    const [ah, am] = a.split(':').map(Number)
    const [bh, bm] = b.split(':').map(Number)
    return ah !== bh ? ah - bh : am - bm
  })

// 다음 실행까지 남은 시간을 계산하는 함수
const getNextExecutionInfo = (scheduleTimes: string[]): { text: string; remainingText: string } => {
  if (scheduleTimes.length === 0) {
    return { text: '실행 시간을 입력해주세요', remainingText: '' }
  }

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  const sorted = sortTimes(scheduleTimes)

  let nextTime: string | null = null
  let isToday = true

  for (const time of sorted) {
    const [h, m] = time.split(':').map(Number)
    if (h > currentHour || (h === currentHour && m > currentMinute)) {
      nextTime = time
      break
    }
  }

  if (!nextTime) {
    nextTime = sorted[0]
    isToday = false
  }

  const [nextH, nextM] = nextTime.split(':').map(Number)
  const nextDate = new Date()
  if (!isToday) {
    nextDate.setDate(nextDate.getDate() + 1)
  }
  nextDate.setHours(nextH, nextM, 0, 0)

  const diffMs = nextDate.getTime() - now.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60

  const timeText = `${isToday ? '오늘' : '내일'} ${nextTime}`

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
const getScheduleTimesSummary = (scheduleTimes: string[]): string => {
  if (scheduleTimes.length === 0) return '설정된 시간 없음'

  const sorted = sortTimes(scheduleTimes)
  if (sorted.length <= 4) {
    return sorted.join(', ')
  }
  return `${sorted.length}개 시간 설정됨`
}

const defaultConfig: AutomationConfig = {
  isEnabled: false,
  cronInterval: 'custom',
  scheduleTimes: [],
  collectFromAllChannels: true,
  wholesaleChannelIds: [],
  aiProvider: 'GEMINI',
  retailChannelIds: [],
  shopIds: [],
  pipelineSteps: {
    collection: true,
    transform: true,
    productCreate: true,
    publish: true,
  },
  collectionLimit: 10,
  collectionLimitByChannel: {},
  autoPublishLimit: 20,
  autoPublishLimitByShop: {},
  autoPublishLimitByChannel: {},
}

// 수집 개수 옵션
const COLLECTION_LIMIT_OPTIONS = [
  { value: 10, label: '10개' },
  { value: 20, label: '20개' },
  { value: 30, label: '30개' },
  { value: 50, label: '50개' },
  { value: 100, label: '100개' },
  { value: 0, label: '전체' },
]

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

  // 시간 입력 상태
  const [timeAmPm, setTimeAmPm] = useState<'AM' | 'PM'>('AM')
  const [timeHour, setTimeHour] = useState('')
  const [timeMinute, setTimeMinute] = useState('')

  // 쇼핑몰 미연결 경고 모달
  const [showShopConnectionWarning, setShowShopConnectionWarning] = useState(false)
  const [unconnectedChannels, setUnconnectedChannels] = useState<Channel[]>([])

  // 파이프라인 상태 추적
  const [pipelineStatus, setPipelineStatus] = useState<PipelineWorkflow | null>(null)
  const [isPipelineRunning, setIsPipelineRunning] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showDisableModal, setShowDisableModal] = useState(false)

  // 밴드 세션 검증 상태
  const [showSessionMissingModal, setShowSessionMissingModal] = useState(false)
  const [invalidSessionChannels, setInvalidSessionChannels] = useState<Array<{
    id: number
    name: string
    kind: 'WHOLESALE' | 'RETAIL'
    hasSession: boolean
    isExpired: boolean
  }>>([])
  const [isValidatingSession, setIsValidatingSession] = useState(false)

  const CHANNELS_PER_PAGE = 4

  // 섹션별 변경 여부 확인 (isEnabled는 버튼으로 변경하므로 제외)
  const hasScheduleChanges = JSON.stringify(sortTimes(config.scheduleTimes || [])) !==
    JSON.stringify(sortTimes(initialConfig.scheduleTimes || []))

  const hasCollectionChanges = JSON.stringify((config.wholesaleChannelIds || []).slice().sort()) !==
    JSON.stringify((initialConfig.wholesaleChannelIds || []).slice().sort()) ||
    config.collectionLimit !== initialConfig.collectionLimit ||
    JSON.stringify(config.collectionLimitByChannel || {}) !==
    JSON.stringify(initialConfig.collectionLimitByChannel || {})

  const hasAiChanges = config.aiProvider !== initialConfig.aiProvider

  const hasPublishChanges = JSON.stringify((config.retailChannelIds || []).slice().sort()) !==
    JSON.stringify((initialConfig.retailChannelIds || []).slice().sort())

  const hasShopChanges = JSON.stringify((config.shopIds || []).slice().sort()) !==
    JSON.stringify((initialConfig.shopIds || []).slice().sort())

  const hasPublishLimitChanges = config.autoPublishLimit !== initialConfig.autoPublishLimit ||
    JSON.stringify(config.autoPublishLimitByShop || {}) !==
    JSON.stringify(initialConfig.autoPublishLimitByShop || {}) ||
    JSON.stringify(config.autoPublishLimitByChannel || {}) !==
    JSON.stringify(initialConfig.autoPublishLimitByChannel || {})

  const hasPipelineChanges = JSON.stringify(config.pipelineSteps) !== JSON.stringify(initialConfig.pipelineSteps)

  // 저장되지 않은 변경사항이 있는지 확인
  const hasUnsavedChanges = hasScheduleChanges || hasCollectionChanges || hasAiChanges || hasPublishChanges || hasShopChanges || hasPublishLimitChanges || hasPipelineChanges

  // 필수 설정 누락 여부 (설정이 아예 안 된 경우)
  const isScheduleMissing = config.scheduleTimes.length === 0
  const isShopMissing = config.shopIds.length === 0
  const isCollectionMissing = config.wholesaleChannelIds.length === 0
  const isAiMissing = !config.aiProvider
  const isPublishMissing = config.retailChannelIds.length === 0
  const isPipelineMissing = !config.pipelineSteps.collection && !config.pipelineSteps.transform && !config.pipelineSteps.productCreate && !config.pipelineSteps.publish

  // 섹션별 문제 여부 (설정 누락 또는 저장 안 됨)
  const hasScheduleProblem = isScheduleMissing || hasScheduleChanges
  const hasShopProblem = isShopMissing || hasShopChanges
  const hasCollectionProblem = isCollectionMissing || hasCollectionChanges
  const hasAiProblem = isAiMissing || hasAiChanges
  const hasPublishProblem = isPublishMissing || hasPublishChanges
  const hasPipelineProblem = isPipelineMissing || hasPipelineChanges

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

  // 밴드 세션 검증 함수 (소매채널만 검증 - 도매채널은 세션 불필요)
  const validateBandSessions = async (createNotification = false): Promise<boolean> => {
    setIsValidatingSession(true)
    try {
      const response = await fetch('/api/automation/session/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailChannelIds: config.retailChannelIds,
          type: 'publish',
          createNotification,
        }),
      })

      const data = await response.json()
      if (data.success) {
        if (!data.data.isValid) {
          setInvalidSessionChannels(data.data.invalidChannels)
          setShowSessionMissingModal(true)
          return false
        }
        return true
      } else {
        toast.error('세션 검증에 실패했습니다')
        return false
      }
    } catch (error) {
      console.error('세션 검증 실패:', error)
      toast.error('세션 검증 중 오류가 발생했습니다')
      return false
    } finally {
      setIsValidatingSession(false)
    }
  }

  // 세션 재검증 핸들러 (모달에서 호출)
  const handleRetrySessionValidation = async () => {
    const isValid = await validateBandSessions(false)
    if (isValid) {
      setShowSessionMissingModal(false)
      toast.success('모든 채널의 세션이 유효합니다')
      // 세션이 유효하면 자동화 시작 진행
      saveAutomationState(true)
    }
  }

  // 자동화 시작 핸들러
  const handleStartAutomation = async () => {
    // 필수 설정 검증 - 설정이 안 된 섹션 확인
    const missingSections: string[] = []

    // 실행 시간 선택 확인
    if (config.scheduleTimes.length === 0) {
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

    // 파이프라인 단계 확인
    if (!config.pipelineSteps.collection && !config.pipelineSteps.transform && !config.pipelineSteps.productCreate && !config.pipelineSteps.publish) {
      missingSections.push('pipeline')
    }

    // 저장되지 않은 변경사항 확인
    const unsavedSections: string[] = []
    if (hasShopChanges) unsavedSections.push('shop')
    if (hasScheduleChanges) unsavedSections.push('schedule')
    if (hasCollectionChanges) unsavedSections.push('collection')
    if (hasAiChanges) unsavedSections.push('ai')
    if (hasPublishChanges) unsavedSections.push('publish')
    if (hasPipelineChanges) unsavedSections.push('pipeline')

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

    // 소매채널 중 쇼핑몰 미연결 채널 확인
    const channelsWithoutShop = retailChannels.filter(
      (ch) => config.retailChannelIds.includes(ch.id) && !ch.shop
    )

    if (channelsWithoutShop.length > 0) {
      setUnconnectedChannels(channelsWithoutShop)
      setShowShopConnectionWarning(true)
      return
    }

    // 밴드 세션 유효성 검증 (실패 시 알림도 생성)
    const isSessionValid = await validateBandSessions(true)
    if (!isSessionValid) {
      return
    }

    // 저장된 상태에서만 자동화 시작 (서버에도 저장)
    saveAutomationState(true)
  }

  // 자동화 중지 핸들러
  const handleStopAutomation = () => {
    // 실행 중인 파이프라인이 있으면 모달 표시
    if (isPipelineRunning && pipelineStatus) {
      setShowDisableModal(true)
      return
    }
    // 없으면 바로 비활성화
    saveAutomationState(false)
  }

  // 비활성화 모달 확인 핸들러
  const handleDisableConfirm = async (cancelPipeline: boolean) => {
    if (cancelPipeline && pipelineStatus) {
      await handleCancelPipeline(pipelineStatus.id)
    }
    await saveAutomationState(false)
    setShowDisableModal(false)
  }

  // 파이프라인 취소 핸들러
  const handleCancelPipeline = async (workflowId: number) => {
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/automation/execute?workflowId=${workflowId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        toast.success('파이프라인이 취소되었습니다')
        setPipelineStatus(null)
        setIsPipelineRunning(false)
      } else {
        toast.error(data.error || '취소에 실패했습니다')
      }
    } catch (error) {
      console.error('파이프라인 취소 실패:', error)
      toast.error('취소 요청 중 오류가 발생했습니다')
    } finally {
      setIsCancelling(false)
    }
  }

  // 파이프라인 상태 조회
  const fetchPipelineStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/execute')
      const data = await res.json()
      if (data.success) {
        setPipelineStatus(data.data?.workflow || null)
        setIsPipelineRunning(data.data?.isRunning || false)
      }
    } catch (error) {
      // 조용히 실패 처리 (네트워크 오류 등)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  // 다음 실행 시간 실시간 업데이트 (1분마다)
  useEffect(() => {
    const updateNextExecution = () => {
      setNextExecution(getNextExecutionInfo(config.scheduleTimes))
    }

    // 초기 계산
    updateNextExecution()

    // 1분마다 업데이트
    const interval = setInterval(updateNextExecution, 60000)

    return () => clearInterval(interval)
  }, [config.scheduleTimes])

  // 파이프라인 상태 폴링 (5초마다)
  useEffect(() => {
    // 초기 로드 (자동화 상태와 관계없이 항상 확인)
    fetchPipelineStatus()

    // 5초마다 폴링 (실행 중인 파이프라인이 있으면 계속 폴링)
    const interval = setInterval(() => {
      fetchPipelineStatus()
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchPipelineStatus])

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
            scheduleTimes: configData.data?.scheduleTimes || (configData.data?.selectedHours || []).map((h: number) => `${h.toString().padStart(2, '0')}:00`),
            wholesaleChannelIds: configData.data?.wholesaleChannelIds || [],
            retailChannelIds: configData.data?.retailChannelIds || [],
            shopIds: configData.data?.shopIds || [],
            pipelineSteps: configData.data?.pipelineSteps || defaultConfig.pipelineSteps,
            collectionLimit: configData.data?.collectionLimit ?? 10,
            collectionLimitByChannel: configData.data?.collectionLimitByChannel ?? {},
            autoPublishLimit: configData.data?.autoPublishLimit ?? 20,
            autoPublishLimitByShop: configData.data?.autoPublishLimitByShop ?? {},
            autoPublishLimitByChannel: configData.data?.autoPublishLimitByChannel ?? {},
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
    pipeline: '파이프라인 범위',
  }

  const handleSaveSection = async (section: string) => {
    setSavingSection(section)
    try {
      // 섹션별로 저장할 데이터 구성
      let sectionData: Partial<AutomationConfig> = {}

      switch (section) {
        case 'schedule':
          sectionData = { scheduleTimes: config.scheduleTimes }
          break
        case 'shop':
          sectionData = { shopIds: config.shopIds }
          break
        case 'collection':
          sectionData = {
            wholesaleChannelIds: config.wholesaleChannelIds,
            collectionLimit: config.collectionLimit,
            collectionLimitByChannel: config.collectionLimitByChannel,
          }
          break
        case 'ai':
          sectionData = { aiProvider: config.aiProvider }
          break
        case 'publish':
          sectionData = { retailChannelIds: config.retailChannelIds }
          break
        case 'publishLimit':
          sectionData = {
            autoPublishLimit: config.autoPublishLimit,
            autoPublishLimitByShop: config.autoPublishLimitByShop,
            autoPublishLimitByChannel: config.autoPublishLimitByChannel,
          }
          break
        case 'pipeline':
          sectionData = { pipelineSteps: config.pipelineSteps }
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
                        <span>{getScheduleTimesSummary(config.scheduleTimes)}</span>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200 flex-shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">실행 주기</h2>
                  {hasScheduleChanges && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                  )}
                  {config.scheduleTimes.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-violet-100 text-violet-700">
                      {config.scheduleTimes.length}개
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">자동화가 실행될 시간을 입력하세요</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveSection('schedule')}
                disabled={savingSection === 'schedule' || !hasScheduleChanges}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 shadow-md"
              >
                {savingSection === 'schedule' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                저장
              </Button>
            </div>
          </div>

          {/* 시간 입력 */}
          <div className="space-y-3">
            {/* 시간 입력 행 */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* AM/PM 선택 */}
              <div className="flex h-10 rounded-lg border-2 border-gray-200 overflow-hidden">
                <button
                  onClick={() => setTimeAmPm('AM')}
                  className={`px-3 text-sm font-bold transition-colors ${
                    timeAmPm === 'AM'
                      ? 'bg-violet-500 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  오전
                </button>
                <button
                  onClick={() => setTimeAmPm('PM')}
                  className={`px-3 text-sm font-bold transition-colors border-l border-gray-200 ${
                    timeAmPm === 'PM'
                      ? 'bg-violet-500 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  오후
                </button>
              </div>

              {/* 시 입력 */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="시"
                  value={timeHour}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '') { setTimeHour(''); return }
                    const n = parseInt(v)
                    if (n >= 1 && n <= 12) setTimeHour(v)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const h24 = to24Hour(parseInt(timeHour) || 0, timeAmPm)
                      const m = parseInt(timeMinute) || 0
                      const value = `${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
                      if (timeHour && !config.scheduleTimes.includes(value)) {
                        setConfig(prev => ({ ...prev, scheduleTimes: [...prev.scheduleTimes, value] }))
                        setTimeHour('')
                        setTimeMinute('')
                      }
                    }
                  }}
                  className="w-14 h-10 px-2 text-center rounded-lg border-2 border-gray-200 text-sm font-medium text-gray-700 bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-gray-400 font-bold text-lg">:</span>
                {/* 분 입력 */}
                <input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="분"
                  value={timeMinute}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '') { setTimeMinute(''); return }
                    const n = parseInt(v)
                    if (n >= 0 && n <= 59) setTimeMinute(v)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const h24 = to24Hour(parseInt(timeHour) || 0, timeAmPm)
                      const m = parseInt(timeMinute) || 0
                      const value = `${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
                      if (timeHour && !config.scheduleTimes.includes(value)) {
                        setConfig(prev => ({ ...prev, scheduleTimes: [...prev.scheduleTimes, value] }))
                        setTimeHour('')
                        setTimeMinute('')
                      }
                    }
                  }}
                  className="w-14 h-10 px-2 text-center rounded-lg border-2 border-gray-200 text-sm font-medium text-gray-700 bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* 추가 버튼 */}
              <button
                onClick={() => {
                  const h24 = to24Hour(parseInt(timeHour) || 0, timeAmPm)
                  const m = parseInt(timeMinute) || 0
                  const value = `${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
                  if (timeHour && !config.scheduleTimes.includes(value)) {
                    setConfig(prev => ({ ...prev, scheduleTimes: [...prev.scheduleTimes, value] }))
                    setTimeHour('')
                    setTimeMinute('')
                  }
                }}
                disabled={!timeHour}
                className="h-10 px-4 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1.5"
              >
                <Plus size={16} />
                추가
              </button>

              {config.scheduleTimes.length > 0 && (
                <button
                  onClick={() => setConfig(prev => ({ ...prev, scheduleTimes: [] }))}
                  className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  전체삭제
                </button>
              )}
            </div>

            {/* 추가된 시간 태그 목록 */}
            {config.scheduleTimes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sortTimes(config.scheduleTimes).map(time => (
                  <span
                    key={time}
                    className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-medium shadow-sm shadow-violet-200"
                  >
                    {formatTimeDisplay(time)}
                    <button
                      onClick={() => {
                        setConfig(prev => ({
                          ...prev,
                          scheduleTimes: prev.scheduleTimes.filter(t => t !== time)
                        }))
                      }}
                      className="p-0.5 rounded-md hover:bg-white/20 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                실행할 시간을 추가해주세요
              </div>
            )}
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
                {getScheduleTimesSummary(config.scheduleTimes)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 자동 발행 제한 (쇼핑몰/소매밴드 공통) */}
      <Card className="overflow-hidden transition-all">
        <div className="p-4 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200 flex-shrink-0">
                <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">1회 자동발행 최대 갯수</h2>
                  {hasPublishLimitChanges && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                  )}
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700">
                    {config.autoPublishLimit}개
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                  자동화 1회 실행 시 쇼핑몰·소매밴드 각 대상당 발행할 최대 상품 개수
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSaveSection('publishLimit')}
              disabled={savingSection === 'publishLimit' || !hasPublishLimitChanges}
              className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 shadow-md self-end sm:self-auto"
            >
              {savingSection === 'publishLimit' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              저장
            </Button>
          </div>

          {/* 입력 UI: 숫자 입력 + 프리셋 버튼 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">최대</label>
              <input
                type="number"
                min={1}
                max={500}
                value={config.autoPublishLimit}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v > 0) {
                    setConfig(prev => ({ ...prev, autoPublishLimit: v }))
                  }
                }}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center font-semibold"
              />
              <span className="text-sm text-gray-600">개</span>
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {[10, 20, 30, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, autoPublishLimit: v }))}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    config.autoPublishLimit === v
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {v}개
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 flex-shrink-0 text-amber-500" />
            전체 기본값입니다. 아래에서 쇼핑몰/소매밴드별 개별 설정 가능. 수동 발행은 제한 없음.
          </p>

          {/* 쇼핑몰별 오버라이드 */}
          {config.shopIds.length > 0 && shops.length > 0 && (
            <div className="mt-4 p-3 bg-rose-50/50 rounded-lg border border-rose-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-rose-700">쇼핑몰별 발행 개수 (선택된 쇼핑몰만)</span>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, autoPublishLimitByShop: {} }))}
                  className="text-xs text-rose-600 hover:text-rose-800 underline"
                >
                  초기화
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {shops
                  .filter(s => config.shopIds.includes(s.id))
                  .map(shop => {
                    const override = config.autoPublishLimitByShop?.[shop.id]
                    const currentValue = override ?? config.autoPublishLimit
                    return (
                      <div key={shop.id} className="flex items-center gap-2 bg-white p-2 rounded-md border border-gray-200">
                        <span className="text-xs font-medium text-gray-700 flex-1 truncate">{shop.name}</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={currentValue}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10)
                            setConfig(prev => {
                              const map = { ...(prev.autoPublishLimitByShop || {}) }
                              if (isNaN(v) || v <= 0) {
                                delete map[shop.id]
                              } else {
                                map[shop.id] = v
                              }
                              return { ...prev, autoPublishLimitByShop: map }
                            })
                          }}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                        />
                        <span className="text-xs text-gray-500">개</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* 소매밴드별 오버라이드 */}
          {config.retailChannelIds.length > 0 && retailChannels.length > 0 && (
            <div className="mt-3 p-3 bg-purple-50/50 rounded-lg border border-purple-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-purple-700">소매밴드별 발행 개수 (선택된 소매밴드만)</span>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, autoPublishLimitByChannel: {} }))}
                  className="text-xs text-purple-600 hover:text-purple-800 underline"
                >
                  초기화
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {retailChannels
                  .filter(ch => config.retailChannelIds.includes(ch.id))
                  .map(channel => {
                    const override = config.autoPublishLimitByChannel?.[channel.id]
                    const currentValue = override ?? config.autoPublishLimit
                    return (
                      <div key={channel.id} className="flex items-center gap-2 bg-white p-2 rounded-md border border-gray-200">
                        <span className="text-xs font-medium text-gray-700 flex-1 truncate">{channel.name}</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={currentValue}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10)
                            setConfig(prev => {
                              const map = { ...(prev.autoPublishLimitByChannel || {}) }
                              if (isNaN(v) || v <= 0) {
                                delete map[channel.id]
                              } else {
                                map[channel.id] = v
                              }
                              return { ...prev, autoPublishLimitByChannel: map }
                            })
                          }}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                        />
                        <span className="text-xs text-gray-500">개</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Pipeline Range Settings */}
      <Card className={`overflow-hidden transition-all ${warningSections.includes('pipeline') && warningPhase === 'shake' ? 'ring-2 ring-red-400 animate-shake' : hasPipelineProblem ? 'ring-2 ring-red-300' : ''}`}>
        <div className="p-4 pb-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 flex-shrink-0">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">파이프라인</h2>
                  {hasPipelineChanges && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                  )}
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700">
                    {[config.pipelineSteps.collection, config.pipelineSteps.transform, config.pipelineSteps.productCreate, config.pipelineSteps.publish].filter(Boolean).length}/4
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">자동화 파이프라인 단계를 선택하세요</p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSaveSection('pipeline')}
              disabled={savingSection === 'pipeline' || !hasPipelineChanges}
              className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 shadow-md self-end sm:self-auto"
            >
              {savingSection === 'pipeline' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              저장
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {/* 수집 단계 */}
            {(() => {
              // 수집을 해제하려면 변환이 해제되어 있어야 함
              const canToggleOff = !config.pipelineSteps.transform
              const isDisabled = config.pipelineSteps.collection && !canToggleOff
              return (
                <button
                  onClick={() => {
                    if (isDisabled) {
                      toast.error('다음 단계(변환)를 먼저 해제해주세요')
                      return
                    }
                    setConfig(prev => ({
                      ...prev,
                      pipelineSteps: { ...prev.pipelineSteps, collection: !prev.pipelineSteps.collection }
                    }))
                  }}
                  className={`
                    relative group p-4 rounded-xl border-2 transition-all duration-300
                    ${config.pipelineSteps.collection
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-md shadow-blue-100'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                    }
                    ${isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                      config.pipelineSteps.collection
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-200'
                        : 'bg-gray-100 group-hover:bg-blue-100'
                    }`}>
                      <Download className={`w-7 h-7 ${config.pipelineSteps.collection ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`} />
                    </div>
                    <div className="text-center">
                      <h3 className={`font-bold text-sm ${config.pipelineSteps.collection ? 'text-blue-700' : 'text-gray-600'}`}>수집</h3>
                      <p className="text-xs text-gray-500 mt-1">게시물 수집</p>
                    </div>
                    {config.pipelineSteps.collection && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>
              )
            })()}

            {/* 변환 단계 */}
            {(() => {
              // 변환을 선택하려면 수집이 선택되어 있어야 함
              // 변환을 해제하려면 상품생성이 해제되어 있어야 함
              const canToggleOn = config.pipelineSteps.collection
              const canToggleOff = !config.pipelineSteps.productCreate
              const isDisabledOn = !config.pipelineSteps.transform && !canToggleOn
              const isDisabledOff = config.pipelineSteps.transform && !canToggleOff
              const isDisabled = isDisabledOn || isDisabledOff
              return (
                <button
                  onClick={() => {
                    if (!config.pipelineSteps.transform && !canToggleOn) {
                      toast.error('이전 단계(수집)를 먼저 선택해주세요')
                      return
                    }
                    if (config.pipelineSteps.transform && !canToggleOff) {
                      toast.error('다음 단계(상품생성)를 먼저 해제해주세요')
                      return
                    }
                    setConfig(prev => ({
                      ...prev,
                      pipelineSteps: { ...prev.pipelineSteps, transform: !prev.pipelineSteps.transform }
                    }))
                  }}
                  className={`
                    relative group p-4 rounded-xl border-2 transition-all duration-300
                    ${config.pipelineSteps.transform
                      ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md shadow-amber-100'
                      : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                    }
                    ${isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                      config.pipelineSteps.transform
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-200'
                        : 'bg-gray-100 group-hover:bg-amber-100'
                    }`}>
                      <Sparkles className={`w-7 h-7 ${config.pipelineSteps.transform ? 'text-white' : 'text-gray-400 group-hover:text-amber-500'}`} />
                    </div>
                    <div className="text-center">
                      <h3 className={`font-bold text-sm ${config.pipelineSteps.transform ? 'text-amber-700' : 'text-gray-600'}`}>변환</h3>
                      <p className="text-xs text-gray-500 mt-1">AI 상품 변환</p>
                    </div>
                    {config.pipelineSteps.transform && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>
              )
            })()}

            {/* 상품생성 단계 */}
            {(() => {
              // 상품생성을 선택하려면 변환이 선택되어 있어야 함
              // 상품생성을 해제하려면 발행이 해제되어 있어야 함
              const canToggleOn = config.pipelineSteps.transform
              const canToggleOff = !config.pipelineSteps.publish
              const isDisabledOn = !config.pipelineSteps.productCreate && !canToggleOn
              const isDisabledOff = config.pipelineSteps.productCreate && !canToggleOff
              const isDisabled = isDisabledOn || isDisabledOff
              return (
                <button
                  onClick={() => {
                    if (!config.pipelineSteps.productCreate && !canToggleOn) {
                      toast.error('이전 단계(변환)를 먼저 선택해주세요')
                      return
                    }
                    if (config.pipelineSteps.productCreate && !canToggleOff) {
                      toast.error('다음 단계(발행)를 먼저 해제해주세요')
                      return
                    }
                    setConfig(prev => ({
                      ...prev,
                      pipelineSteps: { ...prev.pipelineSteps, productCreate: !prev.pipelineSteps.productCreate }
                    }))
                  }}
                  className={`
                    relative group p-4 rounded-xl border-2 transition-all duration-300
                    ${config.pipelineSteps.productCreate
                      ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-md shadow-emerald-100'
                      : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }
                    ${isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                      config.pipelineSteps.productCreate
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200'
                        : 'bg-gray-100 group-hover:bg-emerald-100'
                    }`}>
                      <ShoppingBag className={`w-7 h-7 ${config.pipelineSteps.productCreate ? 'text-white' : 'text-gray-400 group-hover:text-emerald-500'}`} />
                    </div>
                    <div className="text-center">
                      <h3 className={`font-bold text-sm ${config.pipelineSteps.productCreate ? 'text-emerald-700' : 'text-gray-600'}`}>상품생성</h3>
                      <p className="text-xs text-gray-500 mt-1">Product 생성</p>
                    </div>
                    {config.pipelineSteps.productCreate && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>
              )
            })()}

            {/* 발행 단계 */}
            {(() => {
              // 발행을 선택하려면 상품생성이 선택되어 있어야 함
              const canToggleOn = config.pipelineSteps.productCreate
              const isDisabled = !config.pipelineSteps.publish && !canToggleOn
              return (
                <button
                  onClick={() => {
                    if (isDisabled) {
                      toast.error('이전 단계(상품생성)를 먼저 선택해주세요')
                      return
                    }
                    setConfig(prev => ({
                      ...prev,
                      pipelineSteps: { ...prev.pipelineSteps, publish: !prev.pipelineSteps.publish }
                    }))
                  }}
                  className={`
                    relative group p-4 rounded-xl border-2 transition-all duration-300
                    ${config.pipelineSteps.publish
                      ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md shadow-green-100'
                      : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'
                    }
                    ${isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                      config.pipelineSteps.publish
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-200'
                        : 'bg-gray-100 group-hover:bg-green-100'
                    }`}>
                      <Upload className={`w-7 h-7 ${config.pipelineSteps.publish ? 'text-white' : 'text-gray-400 group-hover:text-green-500'}`} />
                    </div>
                    <div className="text-center">
                      <h3 className={`font-bold text-sm ${config.pipelineSteps.publish ? 'text-green-700' : 'text-gray-600'}`}>발행</h3>
                      <p className="text-xs text-gray-500 mt-1">채널 발행</p>
                    </div>
                    {config.pipelineSteps.publish && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>
              )
            })()}
          </div>

          {/* 파이프라인 흐름 표시 */}
          <div className="mt-4 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-wrap">
              <span className={`px-2 sm:px-3 py-1 rounded-lg font-medium ${config.pipelineSteps.collection ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400 line-through'}`}>
                수집
              </span>
              <span className="text-indigo-400">→</span>
              <span className={`px-2 sm:px-3 py-1 rounded-lg font-medium ${config.pipelineSteps.transform ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400 line-through'}`}>
                변환
              </span>
              <span className="text-indigo-400">→</span>
              <span className={`px-2 sm:px-3 py-1 rounded-lg font-medium ${config.pipelineSteps.productCreate ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400 line-through'}`}>
                상품생성
              </span>
              <span className="text-indigo-400">→</span>
              <span className={`px-2 sm:px-3 py-1 rounded-lg font-medium ${config.pipelineSteps.publish ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400 line-through'}`}>
                발행
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-200 flex-shrink-0">
                  <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-gray-900">쇼핑몰 발행</h2>
                    {hasShopChanges && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                    )}
                    {config.shopIds.length > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-700">
                        {config.shopIds.length}개
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">상품이 발행될 쇼핑몰 선택</p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveSection('shop')}
                disabled={savingSection === 'shop' || !hasShopChanges}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 shadow-md self-end sm:self-auto"
              >
                {savingSection === 'shop' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                저장
              </Button>
            </div>

            {shops.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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

        {/* AI Settings - 간소화된 버전 */}
        <Card className={`overflow-hidden transition-all ${warningSections.includes('ai') && warningPhase === 'shake' ? 'ring-2 ring-red-400 animate-shake' : hasAiProblem ? 'ring-2 ring-red-300' : ''}`}>
          <div className="p-4 pb-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">AI 변환 설정</h2>
                  <p className="text-sm text-gray-500">AI와 가격 정책 설정 현황</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* AI 설정 상태 */}
              <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {config.aiProvider ? (
                      <>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          config.aiProvider === 'GEMINI'
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                            : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                        }`}>
                          {config.aiProvider === 'GEMINI' ? (
                            <Sparkles size={20} className="text-white" />
                          ) : (
                            <Bot size={20} className="text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">
                              {config.aiProvider === 'GEMINI' ? 'Google Gemini' : 'OpenAI GPT'}
                            </span>
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">활성</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {config.aiProvider === 'GEMINI' ? 'Google AI' : 'OpenAI'} • AI 설정에서 변경 가능
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <Sparkles size={20} className="text-amber-600" />
                        </div>
                        <div>
                          <span className="font-semibold text-amber-700">AI 미설정</span>
                          <p className="text-xs text-amber-600">API 키를 등록해주세요</p>
                        </div>
                      </>
                    )}
                  </div>
                  <a
                    href="/sourcing/settings/ai"
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    <Settings size={14} />
                    AI 설정
                  </a>
                </div>
              </div>

              {/* 가격 정책 안내 */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <FileText size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <span className="font-semibold text-amber-800">가격 정책</span>
                      <p className="text-xs text-amber-600">도매밴드별로 개별 설정됩니다</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/sourcing/policy/list"
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      <FileText size={14} />
                      정책 관리
                    </a>
                    <a
                      href="/sourcing/channel/list"
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Settings size={14} />
                      채널 설정
                    </a>
                  </div>
                </div>
              </div>

              {/* 도움말 */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  가격 정책은 <strong>채널 설정</strong>에서 도매밴드마다 개별 설정할 수 있습니다.
                  AI 변환 시 해당 채널의 가격 정책이 자동으로 적용됩니다.
                </p>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 flex-shrink-0">
                <Download className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">수집 설정</h2>
                  {hasCollectionChanges && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                  )}
                  {config.wholesaleChannelIds.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700">
                      {config.wholesaleChannelIds.length}개
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">도매밴드 선택</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {wholesaleChannels.length > CHANNELS_PER_PAGE && (
                <button
                  onClick={() => setShowAllWholesale(!showAllWholesale)}
                  className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium px-2 sm:px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {showAllWholesale ? '접기' : '전체'}
                </button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveSection('collection')}
                disabled={savingSection === 'collection' || !hasCollectionChanges}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 shadow-md"
              >
                {savingSection === 'collection' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                저장
              </Button>
            </div>
          </div>

          {/* 수집 개수 설정 — 전체 기본값 */}
          <div className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">전체 기본</span>
            <select
              value={config.collectionLimit}
              onChange={(e) => setConfig(prev => ({ ...prev, collectionLimit: parseInt(e.target.value) }))}
              className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {COLLECTION_LIMIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">채널당 최신 게시물 (개별 설정 시 우선)</span>
          </div>

          {/* 수집 개수 설정 — 채널별 오버라이드 */}
          {config.wholesaleChannelIds.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-700">채널별 수집 개수 (선택된 채널만)</span>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, collectionLimitByChannel: {} }))}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  초기화
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {wholesaleChannels
                  .filter(ch => config.wholesaleChannelIds.includes(ch.id))
                  .map(channel => {
                    const override = config.collectionLimitByChannel?.[channel.id]
                    const currentValue = override ?? config.collectionLimit
                    return (
                      <div key={channel.id} className="flex items-center gap-2 bg-white p-2 rounded-md border border-gray-200">
                        <span className="text-xs font-medium text-gray-700 flex-1 truncate">{channel.name}</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={currentValue}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10)
                            setConfig(prev => {
                              const map = { ...(prev.collectionLimitByChannel || {}) }
                              if (isNaN(v) || v <= 0) {
                                delete map[channel.id]
                              } else {
                                map[channel.id] = v
                              }
                              return { ...prev, collectionLimitByChannel: map }
                            })
                          }}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                        />
                        <span className="text-xs text-gray-500">개</span>
                      </div>
                    )
                  })}
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                <Info size={11} className="mt-0.5 flex-shrink-0 text-blue-500" />
                미입력 채널은 전체 기본값({config.collectionLimit}개) 사용
              </p>
            </div>
          )}

        {wholesaleChannels.length > 0 ? (
          showAllWholesale ? (
            /* 전체보기 모드 */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 overflow-hidden">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-200 flex-shrink-0">
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">발행 설정</h2>
                  {hasPublishChanges && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 animate-pulse">변경됨</span>
                  )}
                  {config.retailChannelIds.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700">
                      {config.retailChannelIds.length}개
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">소매밴드 선택</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {retailChannels.length > CHANNELS_PER_PAGE && (
                <button
                  onClick={() => setShowAllRetail(!showAllRetail)}
                  className="text-xs sm:text-sm text-green-600 hover:text-green-800 font-medium px-2 sm:px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                >
                  {showAllRetail ? '접기' : '전체'}
                </button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveSection('publish')}
                disabled={savingSection === 'publish' || !hasPublishChanges}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 shadow-md"
              >
                {savingSection === 'publish' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                저장
              </Button>
            </div>
          </div>

        {retailChannels.length > 0 ? (
          showAllRetail ? (
            /* 전체보기 모드 */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 overflow-hidden">
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

      {/* 쇼핑몰 미연결 경고 모달 */}
      {showShopConnectionWarning && unconnectedChannels.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowShopConnectionWarning(false)
              setUnconnectedChannels([])
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* 헤더 */}
            <div className="bg-orange-50 p-6 border-b border-orange-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-full">
                  <AlertTriangle size={24} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">쇼핑몰 연결 필요</h3>
                  <p className="text-sm text-gray-600">소매밴드에 쇼핑몰이 연결되어 있지 않습니다</p>
                </div>
              </div>
            </div>

            {/* 콘텐츠 */}
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                다음 소매밴드에 연결된 쇼핑몰이 없습니다:
              </p>
              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                {unconnectedChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    {channel.coverUrl ? (
                      <img
                        src={channel.coverUrl}
                        alt={channel.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                        <Send size={20} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{channel.name}</p>
                      <p className="text-xs text-orange-500">쇼핑몰 미연결</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-600 mb-6">
                자동화를 시작하려면 먼저 소매밴드에 쇼핑몰을 연결해주세요.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowShopConnectionWarning(false)
                    setUnconnectedChannels([])
                  }}
                >
                  닫기
                </Button>
                <a
                  href="/sourcing/channel/list"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-color hover:bg-primary-color/90 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <ExternalLink size={16} />
                  채널 관리
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 비활성화 확인 모달 */}
      <DisableAutomationModal
        isOpen={showDisableModal}
        onClose={() => setShowDisableModal(false)}
        onConfirm={handleDisableConfirm}
        workflow={{
          id: pipelineStatus?.id || 0,
          currentStage: pipelineStatus?.currentStage || null,
          successCount: pipelineStatus?.successCount || 0,
          totalItems: pipelineStatus?.totalItems || 0,
        }}
        isLoading={isCancelling}
      />

      {/* 밴드 세션 없음 모달 */}
      <SessionMissingModal
        isOpen={showSessionMissingModal}
        onClose={() => setShowSessionMissingModal(false)}
        invalidChannels={invalidSessionChannels}
        onRetry={handleRetrySessionValidation}
        isValidating={isValidatingSession}
      />
    </div>
  )
}
