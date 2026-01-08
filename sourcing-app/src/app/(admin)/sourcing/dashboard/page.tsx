'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  RefreshCw,
  Package,
  Zap,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  ArrowRight,
  Activity,
  Timer,
  BarChart3,
  Settings,
  History,
  ShoppingBag,
  Calendar,
  AlertTriangle,
  ExternalLink,
  Send,
  Loader2,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'
import ChannelStatsTable from '@/components/dashboard/sourcing/ChannelStatsTable'
import { useChannelStats } from '@/hooks/dashboard/useChannelStats'

interface HourlyStats {
  hour: number
  collect: number
  transform: number
  productCreate: number
  publish: number
}

interface AutomationStats {
  todayCollected: number
  pendingTransform: number
  readyToPublish: number
  todayPublished: number
  // 전체 진행률 계산용 추가 필드
  totalPosts: number
  totalTransformed: number
  totalProducts: number
  totalPublishedProducts: number
  // 오늘 통계
  todayTransformed: number
  todayProducts: number
  // 시간대별 통계
  hourlyStats: HourlyStats[]
}

interface AutomationConfig {
  isEnabled: boolean
  cronInterval: string
  selectedHours: number[]
  lastRunAt: string | null
  nextRunAt: string | null
  retailChannelIds: number[]
  shopIds: number[]
}

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
  shop?: ChannelShop | null
}

// WorkflowStepLog 기반 단계 정보
interface StepInfo {
  stepType: string
  stepOrder: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  startedAt: string | null
  completedAt: string | null
  totalItems: number
  processedItems: number
  successCount: number
  failedCount: number
  progress: number  // 0-100
}

// API에서 반환하는 stageProgress 형태
interface StageProgressItem {
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  completed: boolean
  startedAt: string | null
  completedAt: string | null
  duration: number | null
  totalItems: number
  processedItems: number
  successCount: number
  failedCount: number
  progress: number  // 0-100
  errorMessage: string | null
  // 기존 details 호환 필드
  totalNewPosts?: number
  channelResults?: { channelName: string; newPosts: number; failed: number }[]
  batchProgress?: { current: number; total: number }
  currentChannel?: string
  currentProgress?: { current: number; total: number }
  // 기존 필드명 호환 (deprecated)
  total?: number
  success?: number
  failed?: number
}

interface StageProgress {
  collection?: StageProgressItem
  transform?: StageProgressItem
  productCreate?: StageProgressItem
  publish?: StageProgressItem
}

interface RunningWorkflow {
  id: number
  type: string
  status: string
  startedAt: string
  totalItems: number
  successCount: number
  failedCount: number
  currentStage: 'collection' | 'transform' | 'productCreate' | 'publish' | null
  stageProgress: StageProgress | null
  steps?: StepInfo[]  // WorkflowStepLog 정보
}

interface RecentLog {
  id: number
  type: string
  status: 'SUCCESS' | 'FAILED' | 'RUNNING'
  startedAt: string
  completedAt: string | null
  itemCount: number
}

// 기간 필터 타입
type PeriodFilter = 'today' | '7days' | '30days' | 'custom'

// 날짜 포맷 (YYYY-MM-DD)
const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// 오늘 날짜
const getToday = () => new Date()

// N일 전 날짜
const getDaysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

// 선택된 시간 요약
const getSelectedHoursSummary = (selectedHours: number[] | undefined): string => {
  if (!selectedHours || selectedHours.length === 0) return '설정 안됨'
  if (selectedHours.length === 24) return '매 시간 (24회/일)'

  const sortedHours = [...selectedHours].sort((a, b) => a - b)
  if (sortedHours.length <= 3) {
    return sortedHours.map(h => `${h.toString().padStart(2, '0')}:00`).join(', ')
  }
  return `${sortedHours.length}개 시간대`
}

// 다음 실행까지 남은 시간을 계산하는 함수
const calculateNextExecution = (selectedHours: number[] | undefined): { countdown: string; nextTime: string } => {
  if (!selectedHours || selectedHours.length === 0) {
    return { countdown: '', nextTime: '' }
  }

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  const sortedHours = [...selectedHours].sort((a, b) => a - b)

  let nextHour: number | null = null
  let isToday = true

  // 오늘 남은 시간 중 가장 가까운 것 찾기
  for (const hour of sortedHours) {
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

  let countdown = ''
  if (hours > 0 && minutes > 0) {
    countdown = `${hours}시간 ${minutes}분`
  } else if (hours > 0) {
    countdown = `${hours}시간`
  } else if (minutes > 0) {
    countdown = `${minutes}분`
  } else {
    countdown = '곧 실행'
  }

  const nextTime = `${nextHour.toString().padStart(2, '0')}:00`

  return { countdown, nextTime }
}

export default function AutomationDashboardPage() {
  const toast = useToast()

  // 날짜 필터 상태 (가장 먼저 선언)
  const [period, setPeriod] = useState<PeriodFilter>('today')
  const [startDate, setStartDate] = useState<string>(formatDateForInput(getToday()))
  const [endDate, setEndDate] = useState<string>(formatDateForInput(getToday()))
  const [isCustomDate, setIsCustomDate] = useState(false)

  // 채널 통계 (날짜 필터 적용)
  const {
    data: channelData,
    isLoading: isChannelLoading,
    error: channelError,
    refetch: refetchChannels,
  } = useChannelStats({
    pollInterval: 30000,
    period: isCustomDate ? 'custom' : period,
    startDate: isCustomDate ? startDate : undefined,
    endDate: isCustomDate ? endDate : undefined,
  })

  const [stats, setStats] = useState<AutomationStats | null>(null)
  const [config, setConfig] = useState<AutomationConfig | null>(null)
  const [runningWorkflow, setRunningWorkflow] = useState<RunningWorkflow | null>(null)
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [countdown, setCountdown] = useState<string>('')

  // 소매채널 및 쇼핑몰 미연결 경고 모달
  const [retailChannels, setRetailChannels] = useState<Channel[]>([])
  const [showShopConnectionWarning, setShowShopConnectionWarning] = useState(false)
  const [unconnectedChannels, setUnconnectedChannels] = useState<Channel[]>([])

  const loadData = useCallback(async () => {
    try {
      // 날짜 필터가 적용된 stats URL 생성
      let statsUrl = '/api/automation/stats'
      if (isCustomDate) {
        statsUrl += `?period=custom&startDate=${startDate}&endDate=${endDate}`
      } else {
        statsUrl += `?period=${period}`
      }

      const [statsRes, configRes, executeRes, logsRes, retailChannelsRes] = await Promise.all([
        fetch(statsUrl),
        fetch('/api/automation/config'),
        fetch('/api/automation/execute'),
        fetch('/api/automation/logs?limit=5'),
        fetch('/api/channel?kind=RETAIL'),
      ])

      // 각 응답을 개별적으로 처리 (404 등 에러 시에도 다른 데이터는 표시)
      if (statsRes.ok) {
        try {
          const statsData = await statsRes.json()
          if (statsData.success) setStats(statsData.data)
        } catch (e) {
          console.error('stats 파싱 실패:', e)
        }
      }

      if (configRes.ok) {
        try {
          const configData = await configRes.json()
          if (configData.success) setConfig(configData.data)
        } catch (e) {
          console.error('config 파싱 실패:', e)
        }
      }

      if (executeRes.ok) {
        try {
          const executeData = await executeRes.json()
          if (executeData.success) setRunningWorkflow(executeData.data.workflow)
        } catch (e) {
          console.error('execute 파싱 실패:', e)
        }
      }

      if (logsRes.ok) {
        try {
          const logsData = await logsRes.json()
          if (logsData.success) setRecentLogs(logsData.data?.logs || [])
        } catch (e) {
          console.error('logs 파싱 실패:', e)
        }
      } else {
        // logs API가 없으면 빈 배열로 설정 (404 에러 방지)
        setRecentLogs([])
      }

      if (retailChannelsRes.ok) {
        try {
          const channelsData = await retailChannelsRes.json()
          if (channelsData.success) setRetailChannels(channelsData.data || [])
        } catch (e) {
          console.error('retail channels 파싱 실패:', e)
        }
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }, [period, isCustomDate, startDate, endDate])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [loadData])

  // 기간 프리셋 선택 시
  const handlePeriodChange = (newPeriod: PeriodFilter) => {
    if (newPeriod === 'custom') {
      setIsCustomDate(true)
    } else {
      setIsCustomDate(false)
      setPeriod(newPeriod)

      // 날짜 범위도 업데이트
      const days = newPeriod === 'today' ? 0 : newPeriod === '7days' ? 6 : 29
      setStartDate(formatDateForInput(getDaysAgo(days)))
      setEndDate(formatDateForInput(getToday()))
    }
  }

  // 카운트다운 타이머 - selectedHours 기반으로 클라이언트에서 계산
  useEffect(() => {
    if (!config?.selectedHours || config.selectedHours.length === 0 || !config?.isEnabled) {
      setCountdown('')
      return
    }

    const updateCountdown = () => {
      const { countdown: newCountdown } = calculateNextExecution(config.selectedHours)
      setCountdown(newCountdown)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [config?.selectedHours, config?.isEnabled])

  const handleExecute = async (type: 'collect' | 'transform' | 'register' | 'publish' | 'full') => {
    if (isExecuting || runningWorkflow) return

    // 발행 또는 전체 실행 시 쇼핑몰 연결 체크
    if ((type === 'publish' || type === 'full') && config?.retailChannelIds) {
      const channelsWithoutShop = retailChannels.filter(
        (ch) => config.retailChannelIds.includes(ch.id) && !ch.shop
      )

      if (channelsWithoutShop.length > 0) {
        setUnconnectedChannels(channelsWithoutShop)
        setShowShopConnectionWarning(true)
        return
      }
    }

    setIsExecuting(true)
    try {
      const response = await fetch('/api/automation/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`${getTypeName(type)} 실행이 시작되었습니다.`)
        loadData()
      } else {
        // 설정 누락 에러인 경우 더 친절한 메시지 표시
        if (data.missingItems?.length > 0) {
          toast.error(`설정 필요: ${data.missingItems.join(', ')}`)
        } else {
          toast.error(data.error || '실행에 실패했습니다.')
        }
      }
    } catch (error) {
      toast.error('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleCancel = async () => {
    if (isCancelling || !runningWorkflow) return

    setIsCancelling(true)
    try {
      const response = await fetch('/api/automation/execute', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast.success('워크플로우가 취소되었습니다.')
        setRunningWorkflow(null)
        loadData()
      } else {
        toast.error(data.error || '취소에 실패했습니다.')
      }
    } catch (error) {
      toast.error('취소 중 오류가 발생했습니다.')
    } finally {
      setIsCancelling(false)
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'collect': return '게시물 수집'
      case 'transform': return 'AI 변환'
      case 'register': return '상품 등록'
      case 'publish': return '발행'
      case 'full': return '전체 실행'
      default: return type
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('ko-KR')
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  const pipelineProgress = runningWorkflow
    ? Math.round((runningWorkflow.successCount / Math.max(runningWorkflow.totalItems, 1)) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* 날짜 필터 + 자동화 상태 (상단, 왼쪽 정렬) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-start gap-3">
          <div className="flex rounded-xl bg-gray-100 p-1">
            {[
              { value: 'today', label: '오늘' },
              { value: '7days', label: '7일' },
              { value: '30days', label: '30일' },
              { value: 'custom', label: '직접선택' },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => handlePeriodChange(item.value as PeriodFilter)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  (item.value === 'custom' && isCustomDate) || (!isCustomDate && period === item.value)
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {/* 직접선택 시 날짜 선택기 표시 */}
          {isCustomDate && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <Calendar size={16} className="text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm text-gray-700 outline-none w-32"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm text-gray-700 outline-none w-32"
              />
            </div>
          )}
        </div>
      </div>

      {/* 채널 현황 섹션 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">채널 현황</h2>
            <p className="text-sm text-gray-500">
              {isCustomDate
                ? `${startDate} ~ ${endDate} 기간`
                : period === 'today'
                ? '오늘'
                : period === '7days'
                ? '최근 7일'
                : '최근 30일'} 도매/소매 채널별 수집 및 발행 현황
            </p>
          </div>
        </div>

        {channelError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {channelError}
          </div>
        )}

        <ChannelStatsTable
          channels={channelData?.channels ?? []}
          isLoading={isChannelLoading}
        />
      </div>

      {/* 자동화 섹션 */}
      <div className="space-y-6">
      {/* Quick Actions - 수동 실행 */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Play size={20} className="text-green-500" />
          수동 실행
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* 게시물 수집 버튼 */}
          {(() => {
            const isThisRunning = runningWorkflow?.type === 'COLLECT'
            const isOtherRunning = runningWorkflow && !isThisRunning
            return (
              <button
                onClick={() => handleExecute('collect')}
                disabled={isExecuting || isOtherRunning || isCancelling || isThisRunning}
                className={`group relative p-4 rounded-xl border-2 transition-all ${
                  isThisRunning
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-green-400 hover:shadow-lg'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isThisRunning && (
                  <div className="absolute -top-2 -right-2">
                    <span className="flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500" />
                    </span>
                  </div>
                )}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                  isThisRunning
                    ? 'bg-green-500'
                    : 'bg-green-100 group-hover:bg-green-500'
                }`}>
                  {isThisRunning ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <Package size={20} className="text-green-600 group-hover:text-white transition-colors" />
                  )}
                </div>
                <p className={`font-medium text-sm ${isThisRunning ? 'text-green-700' : 'text-gray-900'}`}>
                  {isThisRunning ? '실행 중' : '게시물 수집'}
                </p>
                <p className={`text-xs mt-1 ${isThisRunning ? 'text-green-500' : 'text-gray-500'}`}>
                  {isThisRunning ? '잠시만 기다려주세요' : '도매채널 게시물 수집'}
                </p>
              </button>
            )
          })()}

          {/* AI 변환 버튼 */}
          {(() => {
            const isThisRunning = runningWorkflow?.type === 'TRANSFORM'
            const isOtherRunning = runningWorkflow && !isThisRunning
            return (
              <button
                onClick={() => handleExecute('transform')}
                disabled={isExecuting || isOtherRunning || isCancelling || isThisRunning}
                className={`group relative p-4 rounded-xl border-2 transition-all ${
                  isThisRunning
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 bg-white hover:border-yellow-400 hover:shadow-lg'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isThisRunning && (
                  <div className="absolute -top-2 -right-2">
                    <span className="flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500" />
                    </span>
                  </div>
                )}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                  isThisRunning
                    ? 'bg-yellow-500'
                    : 'bg-yellow-100 group-hover:bg-yellow-500'
                }`}>
                  {isThisRunning ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <Zap size={20} className="text-yellow-600 group-hover:text-white transition-colors" />
                  )}
                </div>
                <p className={`font-medium text-sm ${isThisRunning ? 'text-yellow-700' : 'text-gray-900'}`}>
                  {isThisRunning ? '실행 중' : 'AI 변환'}
                </p>
                <p className={`text-xs mt-1 ${isThisRunning ? 'text-yellow-500' : 'text-gray-500'}`}>
                  {isThisRunning ? '잠시만 기다려주세요' : '상품 정보 생성'}
                </p>
              </button>
            )
          })()}

          {/* 상품 등록 버튼 */}
          {(() => {
            const isThisRunning = runningWorkflow?.type === 'PRODUCT_CREATE'
            const isOtherRunning = runningWorkflow && !isThisRunning
            return (
              <button
                onClick={() => handleExecute('register')}
                disabled={isExecuting || isOtherRunning || isCancelling || isThisRunning}
                className={`group relative p-4 rounded-xl border-2 transition-all ${
                  isThisRunning
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-orange-400 hover:shadow-lg'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isThisRunning && (
                  <div className="absolute -top-2 -right-2">
                    <span className="flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500" />
                    </span>
                  </div>
                )}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                  isThisRunning
                    ? 'bg-orange-500'
                    : 'bg-orange-100 group-hover:bg-orange-500'
                }`}>
                  {isThisRunning ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <ShoppingBag size={20} className="text-orange-600 group-hover:text-white transition-colors" />
                  )}
                </div>
                <p className={`font-medium text-sm ${isThisRunning ? 'text-orange-700' : 'text-gray-900'}`}>
                  {isThisRunning ? '실행 중' : '상품 등록'}
                </p>
                <p className={`text-xs mt-1 ${isThisRunning ? 'text-orange-500' : 'text-gray-500'}`}>
                  {isThisRunning ? '잠시만 기다려주세요' : 'Product 생성'}
                </p>
              </button>
            )
          })()}

          {/* 발행 버튼 */}
          {(() => {
            const isThisRunning = runningWorkflow?.type === 'PUBLISH'
            const isOtherRunning = runningWorkflow && !isThisRunning
            return (
              <button
                onClick={() => handleExecute('publish')}
                disabled={isExecuting || isOtherRunning || isCancelling || isThisRunning}
                className={`group relative p-4 rounded-xl border-2 transition-all ${
                  isThisRunning
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isThisRunning && (
                  <div className="absolute -top-2 -right-2">
                    <span className="flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500" />
                    </span>
                  </div>
                )}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                  isThisRunning
                    ? 'bg-blue-500'
                    : 'bg-blue-100 group-hover:bg-blue-500'
                }`}>
                  {isThisRunning ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <Upload size={20} className="text-blue-600 group-hover:text-white transition-colors" />
                  )}
                </div>
                <p className={`font-medium text-sm ${isThisRunning ? 'text-blue-700' : 'text-gray-900'}`}>
                  {isThisRunning ? '실행 중' : '발행'}
                </p>
                <p className={`text-xs mt-1 ${isThisRunning ? 'text-blue-500' : 'text-gray-500'}`}>
                  {isThisRunning ? '잠시만 기다려주세요' : '소매밴드 발행'}
                </p>
              </button>
            )
          })()}

          {/* 전체 실행 버튼 */}
          {(() => {
            const isThisRunning = runningWorkflow?.type === 'FULL_PIPELINE'
            const isOtherRunning = runningWorkflow && !isThisRunning
            return (
              <button
                onClick={() => handleExecute('full')}
                disabled={isExecuting || isOtherRunning || isCancelling || isThisRunning}
                className={`group relative p-4 rounded-xl border-2 transition-all ${
                  isThisRunning
                    ? 'border-purple-400 bg-purple-50'
                    : 'border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:border-purple-400 hover:shadow-lg'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isThisRunning && (
                  <div className="absolute -top-2 -right-2">
                    <span className="flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500" />
                    </span>
                  </div>
                )}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                  isThisRunning
                    ? 'bg-purple-500'
                    : 'bg-purple-100 group-hover:bg-purple-500'
                }`}>
                  {isThisRunning ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <Play size={20} className="text-purple-600 group-hover:text-white transition-colors" />
                  )}
                </div>
                <p className={`font-medium text-sm ${isThisRunning ? 'text-purple-700' : 'text-gray-900'}`}>
                  {isThisRunning ? '실행 중' : '전체 실행'}
                </p>
                <p className={`text-xs mt-1 ${isThisRunning ? 'text-purple-500' : 'text-gray-500'}`}>
                  {isThisRunning ? '잠시만 기다려주세요' : '전체 파이프라인'}
                </p>
              </button>
            )
          })()}
        </div>
      </Card>

      {/* 자동화 상태 바 */}
      <div className="flex items-center justify-start">
        <div className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
          config?.isEnabled
            ? 'bg-green-50 border-green-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          {/* 상태 아이콘 */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            config?.isEnabled
              ? 'bg-green-500'
              : 'bg-gray-300'
          }`}>
            {config?.isEnabled ? (
              <Activity size={16} className="text-white" />
            ) : (
              <Pause size={16} className="text-white" />
            )}
          </div>

          {/* 상태 텍스트 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">자동화</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              config?.isEnabled
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {config?.isEnabled ? '활성' : '비활성'}
            </span>
          </div>

          {/* 다음 실행 정보 (활성화 시) */}
          {config?.isEnabled && config?.selectedHours && config.selectedHours.length > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock size={14} className="text-green-500" />
                <span className="text-gray-600">다음</span>
                <span className="font-semibold text-green-600">{calculateNextExecution(config.selectedHours).nextTime}</span>
                <span className="text-gray-400 text-xs">({countdown || '계산 중...'})</span>
              </div>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500">
                하루 <span className="font-medium text-gray-700">{config.selectedHours.length}</span>회
              </span>
            </>
          )}

          {/* 설정 버튼 */}
          <Link href="/automation/settings">
            <button className="p-1.5 rounded-lg hover:bg-gray-200/50 transition-colors">
              <Settings size={16} className="text-gray-500" />
            </button>
          </Link>
        </div>
      </div>

      {/* 비활성화 시 음영 처리 컨테이너 (수동 실행 제외) */}
      <div className={`relative space-y-6 ${!config?.isEnabled ? 'pointer-events-none' : ''}`}>
        {/* 비활성화 오버레이 */}
        {!config?.isEnabled && (
          <div className="absolute inset-0 -m-3 p-3 bg-gray-400/30 rounded-2xl z-10" />
        )}

      {/* 시간대별 처리량 그래프 + 스케줄 정보 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 시간대별 처리량 선 그래프 - recharts */}
        {stats?.hourlyStats && stats.hourlyStats.length > 0 && (
          <Card className="p-4 lg:col-span-2">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Activity size={16} className="text-blue-500" />
              {isCustomDate
                ? `${startDate} ~ ${endDate} 시간대별 처리량`
                : period === 'today'
                ? '오늘 시간대별 처리량'
                : period === '7days'
                ? '최근 7일 시간대별 처리량'
                : '최근 30일 시간대별 처리량'}
            </h3>

            {/* recharts 선 그래프 */}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={stats.hourlyStats.map(h => ({
                    ...h,
                    hourLabel: `${h.hour.toString().padStart(2, '0')}:00`,
                    isScheduled: config?.selectedHours?.includes(h.hour) ?? false,
                  }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                  {/* 예약된 시간대 하이라이트 - 더 눈에 띄는 배경 */}
                  {config?.selectedHours?.map(hour => (
                    <ReferenceArea
                      key={`scheduled-${hour}`}
                      x1={hour - 0.45}
                      x2={hour + 0.45}
                      fill="#8b5cf6"
                      fillOpacity={0.25}
                      stroke="#8b5cf6"
                      strokeOpacity={0.5}
                    />
                  ))}

                  {/* 현재 시간 세로선 */}
                  <ReferenceLine
                    x={new Date().getHours()}
                    stroke="#ef4444"
                    strokeDasharray="4 2"
                    strokeWidth={2}
                  />

                  <XAxis
                    dataKey="hour"
                    tick={(props) => {
                      const { x, y, payload } = props
                      const hour = payload.value
                      const isScheduled = config?.selectedHours?.includes(hour) ?? false
                      // 3시간 간격이 아니고 예약된 시간도 아니면 표시 안함
                      if (hour % 3 !== 0 && !isScheduled) return null
                      return (
                        <g transform={`translate(${x},${y})`}>
                          {isScheduled && (
                            <rect
                              x={-12}
                              y={2}
                              width={24}
                              height={16}
                              rx={4}
                              fill="#8b5cf6"
                            />
                          )}
                          <text
                            x={0}
                            y={12}
                            textAnchor="middle"
                            fill={isScheduled ? '#ffffff' : '#9ca3af'}
                            fontSize={isScheduled ? 10 : 11}
                            fontWeight={isScheduled ? 600 : 400}
                          >
                            {hour.toString().padStart(2, '0')}
                          </text>
                        </g>
                      )
                    }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={{ stroke: '#e5e7eb' }}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={{ stroke: '#e5e7eb' }}
                    width={35}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null
                      const isScheduled = config?.selectedHours?.includes(Number(label)) ?? false
                      return (
                        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl">
                          <div className="font-semibold mb-1 flex items-center gap-2">
                            {String(label).padStart(2, '0')}:00
                            {isScheduled && (
                              <span className="px-1.5 py-0.5 bg-violet-500 rounded text-[10px]">예약</span>
                            )}
                          </div>
                          <div className="space-y-1 text-[11px]">
                            {payload.map((entry, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                {entry.name}: {entry.value}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="collect"
                    name="수집"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="transform"
                    name="변환"
                    stroke="#eab308"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="productCreate"
                    name="등록"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="publish"
                    name="발행"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 범례 */}
            <div className="flex items-center justify-center gap-3 text-xs text-gray-500 flex-wrap mt-2">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-green-500 rounded" /> 수집
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-yellow-500 rounded" /> 변환
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-orange-500 rounded" /> 등록
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-blue-500 rounded" /> 발행
              </span>
              <span className="flex items-center gap-1 ml-1 pl-1 border-l border-gray-300">
                <span className="w-2 h-2 rounded-full bg-violet-500" /> 예약
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-red-500 rounded" /> 현재
              </span>
            </div>
          </Card>
        )}

        {/* 최근 실행 기록 - 컴팩트 버전 */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <History size={16} className="text-indigo-500" />
              최근 실행 기록
            </h3>
            <Link
              href="/automation/logs"
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              전체보기
              <ArrowRight size={12} />
            </Link>
          </div>

          {recentLogs.length > 0 ? (
            <div className="space-y-2">
              {recentLogs.slice(0, 5).map((log) => {
                const isSuccess = log.status === 'SUCCESS'
                const isFailed = log.status === 'FAILED'
                const isRunning = log.status === 'RUNNING'

                return (
                  <div
                    key={log.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                      isSuccess ? 'border-green-200 bg-green-50/50' :
                      isFailed ? 'border-red-200 bg-red-50/50' :
                      'border-yellow-200 bg-yellow-50/50'
                    }`}
                  >
                    {/* Status Icon */}
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                      isSuccess ? 'bg-green-500' :
                      isFailed ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`}>
                      {isRunning ? (
                        <RefreshCw size={12} className="text-white animate-spin" />
                      ) : isSuccess ? (
                        <CheckCircle size={12} className="text-white" />
                      ) : (
                        <AlertCircle size={12} className="text-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {getTypeName(log.type)}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(log.startedAt).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                    {/* Status */}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      isSuccess ? 'text-green-700 bg-green-100' :
                      isFailed ? 'text-red-700 bg-red-100' :
                      'text-yellow-700 bg-yellow-100'
                    }`}>
                      {isRunning ? '실행중' : isSuccess ? '성공' : '실패'}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History size={24} className="text-gray-300 mb-2" />
              <p className="text-xs text-gray-400">실행 기록 없음</p>
            </div>
          )}
        </Card>
      </div>

      {/* Running Workflow Monitor */}
      {runningWorkflow && (
        <Card className="p-6 border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-white">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-blue-500 flex items-center justify-center">
                  <RefreshCw className="w-7 h-7 text-white animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {getTypeName(runningWorkflow.type)} 실행 중
                </h3>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Timer size={14} />
                  시작: {formatDate(runningWorkflow.startedAt)}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isCancelling}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <XCircle size={18} className="mr-2" />
              {isCancelling ? '취소 중...' : '취소'}
            </Button>
          </div>

          {/* 단계별 진행 상태 (전체 파이프라인일 때만 표시) */}
          {runningWorkflow.type === 'FULL_PIPELINE' && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                {/* 1. 수집 */}
                <div className={`flex-1 relative ${runningWorkflow.currentStage === 'collection' ? 'z-10' : ''}`}>
                  <div className={`p-3 rounded-lg border-2 transition-all ${
                    runningWorkflow.stageProgress?.collection?.completed
                      ? 'bg-green-50 border-green-300'
                      : runningWorkflow.currentStage === 'collection'
                      ? 'bg-green-100 border-green-500 shadow-lg animate-pulse'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {runningWorkflow.stageProgress?.collection?.completed ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : runningWorkflow.currentStage === 'collection' ? (
                        <RefreshCw size={16} className="text-green-600 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span className="text-xs font-semibold text-gray-700">수집</span>
                    </div>
                    {runningWorkflow.stageProgress?.collection && (
                      <p className="text-xs text-green-700 font-medium">
                        {runningWorkflow.stageProgress.collection.totalNewPosts ?? runningWorkflow.stageProgress.collection.successCount ?? 0}건
                        {runningWorkflow.currentStage === 'collection' && runningWorkflow.stageProgress.collection.progress !== undefined && (
                          <span className="text-green-500 ml-1">({runningWorkflow.stageProgress.collection.progress}%)</span>
                        )}
                      </p>
                    )}
                    {runningWorkflow.currentStage === 'collection' && !runningWorkflow.stageProgress?.collection && (
                      <p className="text-xs text-green-600">진행 중...</p>
                    )}
                  </div>
                </div>

                <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />

                {/* 2. 변환 */}
                <div className={`flex-1 relative ${runningWorkflow.currentStage === 'transform' ? 'z-10' : ''}`}>
                  <div className={`p-3 rounded-lg border-2 transition-all ${
                    runningWorkflow.stageProgress?.transform?.completed
                      ? 'bg-yellow-50 border-yellow-300'
                      : runningWorkflow.currentStage === 'transform'
                      ? 'bg-yellow-100 border-yellow-500 shadow-lg animate-pulse'
                      : runningWorkflow.stageProgress?.collection?.completed
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-gray-50 border-gray-100 opacity-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {runningWorkflow.stageProgress?.transform?.completed ? (
                        <CheckCircle size={16} className="text-yellow-600" />
                      ) : runningWorkflow.currentStage === 'transform' ? (
                        <RefreshCw size={16} className="text-yellow-600 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span className="text-xs font-semibold text-gray-700">변환</span>
                    </div>
                    {runningWorkflow.stageProgress?.transform && (
                      <p className="text-xs text-yellow-700 font-medium">
                        {(() => {
                          const t = runningWorkflow.stageProgress.transform
                          const success = t.successCount ?? t.success
                          const processed = t.processedItems ?? 0
                          const total = t.totalItems ?? t.total ?? 0
                          if (runningWorkflow.currentStage === 'transform' && total > 0) {
                            return `${processed}/${total}건`
                          }
                          return success !== undefined ? `${success}건` : '처리 중...'
                        })()}
                        {runningWorkflow.currentStage === 'transform' && runningWorkflow.stageProgress.transform.progress !== undefined && (
                          <span className="text-yellow-500 ml-1">
                            ({runningWorkflow.stageProgress.transform.progress}%)
                          </span>
                        )}
                      </p>
                    )}
                    {runningWorkflow.currentStage === 'transform' && !runningWorkflow.stageProgress?.transform && (
                      <p className="text-xs text-yellow-600">대기 중...</p>
                    )}
                  </div>
                </div>

                <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />

                {/* 3. 등록 */}
                <div className={`flex-1 relative ${runningWorkflow.currentStage === 'productCreate' ? 'z-10' : ''}`}>
                  <div className={`p-3 rounded-lg border-2 transition-all ${
                    runningWorkflow.stageProgress?.productCreate?.completed
                      ? 'bg-orange-50 border-orange-300'
                      : runningWorkflow.currentStage === 'productCreate'
                      ? 'bg-orange-100 border-orange-500 shadow-lg animate-pulse'
                      : runningWorkflow.stageProgress?.transform?.completed
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-gray-50 border-gray-100 opacity-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {runningWorkflow.stageProgress?.productCreate?.completed ? (
                        <CheckCircle size={16} className="text-orange-600" />
                      ) : runningWorkflow.currentStage === 'productCreate' ? (
                        <RefreshCw size={16} className="text-orange-600 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span className="text-xs font-semibold text-gray-700">등록</span>
                    </div>
                    {runningWorkflow.stageProgress?.productCreate && (
                      <p className="text-xs text-orange-700 font-medium">
                        {(() => {
                          const p = runningWorkflow.stageProgress.productCreate
                          const success = p.successCount ?? p.success ?? 0
                          const processed = p.processedItems ?? 0
                          const total = p.totalItems ?? p.total ?? 0
                          if (runningWorkflow.currentStage === 'productCreate' && total > 0) {
                            return `${processed}/${total}건`
                          }
                          return `${success}건`
                        })()}
                        {runningWorkflow.currentStage === 'productCreate' && runningWorkflow.stageProgress.productCreate.progress !== undefined && (
                          <span className="text-orange-500 ml-1">
                            ({runningWorkflow.stageProgress.productCreate.progress}%)
                          </span>
                        )}
                      </p>
                    )}
                    {runningWorkflow.currentStage === 'productCreate' && !runningWorkflow.stageProgress?.productCreate && (
                      <p className="text-xs text-orange-600">대기 중...</p>
                    )}
                  </div>
                </div>

                <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />

                {/* 4. 발행 */}
                <div className={`flex-1 relative ${runningWorkflow.currentStage === 'publish' ? 'z-10' : ''}`}>
                  <div className={`p-3 rounded-lg border-2 transition-all ${
                    runningWorkflow.stageProgress?.publish?.completed
                      ? 'bg-blue-50 border-blue-300'
                      : runningWorkflow.currentStage === 'publish'
                      ? 'bg-blue-100 border-blue-500 shadow-lg animate-pulse'
                      : runningWorkflow.stageProgress?.productCreate?.completed
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-gray-50 border-gray-100 opacity-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {runningWorkflow.stageProgress?.publish?.completed ? (
                        <CheckCircle size={16} className="text-blue-600" />
                      ) : runningWorkflow.currentStage === 'publish' ? (
                        <RefreshCw size={16} className="text-blue-600 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span className="text-xs font-semibold text-gray-700">발행</span>
                    </div>
                    {runningWorkflow.stageProgress?.publish && (
                      <div className="text-xs text-blue-700 font-medium">
                        {(() => {
                          const pub = runningWorkflow.stageProgress.publish
                          const success = pub.successCount ?? pub.success ?? 0
                          const processed = pub.processedItems ?? 0
                          const total = pub.totalItems ?? pub.total ?? 0

                          if (runningWorkflow.currentStage === 'publish') {
                            if (pub.currentChannel && pub.currentProgress) {
                              return (
                                <>
                                  <p>{pub.currentChannel}</p>
                                  <p>{pub.currentProgress.current}/{pub.currentProgress.total}</p>
                                </>
                              )
                            }
                            if (total > 0) {
                              return `${processed}/${total}건`
                            }
                          }
                          return `${success}건`
                        })()}
                        {runningWorkflow.currentStage === 'publish' && runningWorkflow.stageProgress.publish.progress !== undefined && (
                          <span className="text-blue-500 ml-1">
                            ({runningWorkflow.stageProgress.publish.progress}%)
                          </span>
                        )}
                      </div>
                    )}
                    {runningWorkflow.currentStage === 'publish' && !runningWorkflow.stageProgress?.publish && (
                      <p className="text-xs text-blue-600">대기 중...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 단계별 상세 정보 (완료된 단계들) */}
              {runningWorkflow.stageProgress && (
                <div className="bg-white rounded-lg p-4 border border-gray-100 space-y-2">
                  {runningWorkflow.stageProgress.collection?.completed && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">수집 완료</span>
                      <span className="text-green-600 font-medium">
                        {runningWorkflow.stageProgress.collection.channelResults?.length ?? 0}개 채널에서 {runningWorkflow.stageProgress.collection.totalNewPosts ?? runningWorkflow.stageProgress.collection.successCount ?? 0}건
                      </span>
                    </div>
                  )}
                  {runningWorkflow.stageProgress.transform && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">AI 변환</span>
                      <span className={runningWorkflow.stageProgress.transform.completed ? 'text-yellow-600 font-medium' : 'text-gray-500'}>
                        {(() => {
                          const t = runningWorkflow.stageProgress.transform
                          const success = t.successCount ?? t.success
                          const failed = t.failedCount ?? t.failed ?? 0
                          const processed = t.processedItems ?? 0
                          const total = t.totalItems ?? t.total ?? 0

                          if (success !== undefined) {
                            return `${success}건 성공`
                          }
                          if (runningWorkflow.currentStage === 'transform' && total > 0) {
                            return `${processed}/${total}건 처리 중`
                          }
                          return '처리 중...'
                        })()}
                        {runningWorkflow.currentStage === 'transform' && runningWorkflow.stageProgress.transform.progress !== undefined && (
                          <span className="text-yellow-500 ml-1">
                            ({runningWorkflow.stageProgress.transform.progress}%)
                          </span>
                        )}
                        {(() => {
                          const failed = runningWorkflow.stageProgress.transform?.failedCount ?? runningWorkflow.stageProgress.transform?.failed ?? 0
                          return failed > 0 ? <span className="text-red-500 ml-1">({failed}건 실패)</span> : null
                        })()}
                      </span>
                    </div>
                  )}
                  {runningWorkflow.stageProgress.productCreate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">상품 등록</span>
                      <span className="text-orange-600 font-medium">
                        {runningWorkflow.stageProgress.productCreate.successCount ?? runningWorkflow.stageProgress.productCreate.success ?? 0}건 성공
                        {(() => {
                          const failed = runningWorkflow.stageProgress.productCreate?.failedCount ?? runningWorkflow.stageProgress.productCreate?.failed ?? 0
                          return failed > 0 ? <span className="text-red-500 ml-1">({failed}건 실패)</span> : null
                        })()}
                      </span>
                    </div>
                  )}
                  {runningWorkflow.stageProgress.publish && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">발행</span>
                      <span className="text-blue-600 font-medium">
                        {runningWorkflow.stageProgress.publish.successCount ?? runningWorkflow.stageProgress.publish.success ?? 0}건 성공
                        {(() => {
                          const failed = runningWorkflow.stageProgress.publish?.failedCount ?? runningWorkflow.stageProgress.publish?.failed ?? 0
                          return failed > 0 ? <span className="text-red-500 ml-1">({failed}건 실패)</span> : null
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 전체 Progress Bar (단일 파이프라인 또는 요약) */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">전체 진행률</span>
              <span className="font-medium text-blue-600">{pipelineProgress}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 relative"
                style={{ width: `${pipelineProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">총 처리</p>
              <p className="text-2xl font-bold text-gray-900">{runningWorkflow.totalItems}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <p className="text-xs text-green-600 mb-1">성공</p>
              <p className="text-2xl font-bold text-green-600">{runningWorkflow.successCount}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-red-100">
              <p className="text-xs text-red-600 mb-1">실패</p>
              <p className="text-2xl font-bold text-red-600">{runningWorkflow.failedCount}</p>
            </div>
          </div>
        </Card>
      )}
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
                수동 실행을 하려면 먼저 소매밴드에 쇼핑몰을 연결해주세요.
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
                <Link
                  href="/sourcing/channel/list"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-color hover:bg-primary-color/90 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <ExternalLink size={16} />
                  채널 관리
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
