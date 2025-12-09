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
  TrendingUp,
  XCircle,
  ArrowRight,
  Activity,
  Timer,
  BarChart3,
  Settings,
  History,
  ShoppingBag,
  Calendar,
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

interface StageProgress {
  collection: {
    completed: boolean
    totalNewPosts: number
    channelResults: { channelName: string; newPosts: number; failed: number }[]
  } | null
  transform: {
    completed: boolean
    total: number
    success: number
    failed: number
    batchProgress: { current: number; total: number } | null
  } | null
  productCreate: {
    completed: boolean
    total: number
    success: number
    failed: number
  } | null
  publish: {
    completed: boolean
    total: number
    success: number
    failed: number
    currentChannel: string | null
    currentProgress: { current: number; total: number } | null
  } | null
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
  const [stats, setStats] = useState<AutomationStats | null>(null)
  const [config, setConfig] = useState<AutomationConfig | null>(null)
  const [runningWorkflow, setRunningWorkflow] = useState<RunningWorkflow | null>(null)
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [countdown, setCountdown] = useState<string>('')

  // 날짜 필터 상태
  const [period, setPeriod] = useState<PeriodFilter>('today')
  const [startDate, setStartDate] = useState<string>(formatDateForInput(getToday()))
  const [endDate, setEndDate] = useState<string>(formatDateForInput(getToday()))
  const [isCustomDate, setIsCustomDate] = useState(false)

  const loadData = useCallback(async () => {
    try {
      // 날짜 필터가 적용된 stats URL 생성
      let statsUrl = '/api/automation/stats'
      if (isCustomDate) {
        statsUrl += `?period=custom&startDate=${startDate}&endDate=${endDate}`
      } else {
        statsUrl += `?period=${period}`
      }

      const [statsRes, configRes, executeRes, logsRes] = await Promise.all([
        fetch(statsUrl),
        fetch('/api/automation/config'),
        fetch('/api/automation/execute'),
        fetch('/api/automation/logs?limit=5'),
      ])

      const statsData = await statsRes.json()
      const configData = await configRes.json()
      const executeData = await executeRes.json()
      const logsData = await logsRes.json()

      if (statsData.success) setStats(statsData.data)
      if (configData.success) setConfig(configData.data)
      if (executeData.success) setRunningWorkflow(executeData.data.workflow)
      if (logsData.success) setRecentLogs(logsData.data || [])
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
      {/* 날짜 필터 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-center gap-3">
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
          <button
            onClick={() => loadData()}
            className="rounded-xl bg-gray-100 p-2.5 text-gray-600 transition-colors hover:bg-gray-200"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* 직접선택 시 날짜 선택기 표시 */}
        {isCustomDate && (
          <div className="flex justify-center">
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
          </div>
        )}
      </div>

      {/* Hero Header */}
      <div className={`relative overflow-hidden rounded-2xl p-6 ${
        config?.isEnabled
          ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600'
          : 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-40" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              config?.isEnabled ? 'bg-white/20' : 'bg-white/10'
            }`}>
              {config?.isEnabled ? (
                <div className="relative">
                  <Activity className="w-8 h-8 text-white" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full" />
                </div>
              ) : (
                <Pause className="w-8 h-8 text-white/70" />
              )}
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold">자동화 대시보드</h1>
              <p className={`mt-1 ${config?.isEnabled ? 'text-green-100' : 'text-slate-300'}`}>
                {config?.isEnabled ? (
                  <>
                    <span className="font-medium">실행 중</span>
                  </>
                ) : (
                  '자동화가 비활성화되어 있습니다'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/automation/logs">
              <Button
                variant="secondary"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <History size={18} className="mr-2" />
                실행 로그
              </Button>
            </Link>
            <Link href="/automation/settings">
              <Button
                variant="secondary"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Settings size={18} className="mr-2" />
                설정
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Actions - 수동 실행 */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Play size={20} className="text-green-500" />
          수동 실행
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button
            onClick={() => handleExecute('collect')}
            disabled={isExecuting || !!runningWorkflow}
            className="group relative p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-green-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-lg bg-green-100 group-hover:bg-green-500 flex items-center justify-center mb-3 transition-colors">
              <Package size={20} className="text-green-600 group-hover:text-white transition-colors" />
            </div>
            <p className="font-medium text-gray-900 text-sm">게시물 수집</p>
            <p className="text-xs text-gray-500 mt-1">도매채널 게시물 수집</p>
          </button>

          <button
            onClick={() => handleExecute('transform')}
            disabled={isExecuting || !!runningWorkflow}
            className="group relative p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-yellow-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-lg bg-yellow-100 group-hover:bg-yellow-500 flex items-center justify-center mb-3 transition-colors">
              <Zap size={20} className="text-yellow-600 group-hover:text-white transition-colors" />
            </div>
            <p className="font-medium text-gray-900 text-sm">AI 변환</p>
            <p className="text-xs text-gray-500 mt-1">상품 정보 생성</p>
          </button>

          <button
            onClick={() => handleExecute('register')}
            disabled={isExecuting || !!runningWorkflow}
            className="group relative p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-orange-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-100 group-hover:bg-orange-500 flex items-center justify-center mb-3 transition-colors">
              <ShoppingBag size={20} className="text-orange-600 group-hover:text-white transition-colors" />
            </div>
            <p className="font-medium text-gray-900 text-sm">상품 등록</p>
            <p className="text-xs text-gray-500 mt-1">Product 생성</p>
          </button>

          <button
            onClick={() => handleExecute('publish')}
            disabled={isExecuting || !!runningWorkflow}
            className="group relative p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 group-hover:bg-blue-500 flex items-center justify-center mb-3 transition-colors">
              <Upload size={20} className="text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <p className="font-medium text-gray-900 text-sm">발행</p>
            <p className="text-xs text-gray-500 mt-1">소매밴드 발행</p>
          </button>

          <button
            onClick={() => handleExecute('full')}
            disabled={isExecuting || !!runningWorkflow}
            className="group relative p-4 rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:border-purple-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 group-hover:bg-purple-500 flex items-center justify-center mb-3 transition-colors">
              <Play size={20} className="text-purple-600 group-hover:text-white transition-colors" />
            </div>
            <p className="font-medium text-gray-900 text-sm">전체 실행</p>
            <p className="text-xs text-gray-500 mt-1">전체 파이프라인</p>
          </button>
        </div>
      </Card>

      {/* Pipeline Flow Visualization */}
      <Card className="p-6 bg-gradient-to-r from-slate-50 to-white">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-500" />
          파이프라인 현황
        </h2>

        {/* 파이프라인 플로우 + 전환율 */}
        <div className="flex items-center justify-between mb-6">
          {/* Step 1: 수집 */}
          <div className="flex-1">
            <div className={`relative p-4 rounded-xl border-2 transition-all ${
              runningWorkflow?.type === 'collect'
                ? 'border-green-500 bg-green-50 shadow-lg shadow-green-100'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  runningWorkflow?.type === 'collect' ? 'bg-green-500' : 'bg-green-100'
                }`}>
                  <Package size={20} className={runningWorkflow?.type === 'collect' ? 'text-white' : 'text-green-600'} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">수집</p>
                  <p className="text-xs text-gray-500">도매밴드</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats?.todayCollected || 0}</div>
              {runningWorkflow?.type === 'collect' && (
                <div className="absolute -top-2 -right-2">
                  <span className="flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 items-center justify-center">
                      <RefreshCw size={10} className="text-white animate-spin" />
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Arrow with Conversion Rate */}
          <div className="px-2 flex flex-col items-center">
            <span className="text-xs font-medium text-gray-500 mb-1">
              {stats?.todayCollected ? ((stats.todayTransformed / stats.todayCollected) * 100).toFixed(1) : 0}%
            </span>
            <ArrowRight size={18} className="text-gray-300" />
          </div>

          {/* Step 2: AI 변환 */}
          <div className="flex-1">
            <div className={`relative p-4 rounded-xl border-2 transition-all ${
              runningWorkflow?.type === 'transform'
                ? 'border-yellow-500 bg-yellow-50 shadow-lg shadow-yellow-100'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  runningWorkflow?.type === 'transform' ? 'bg-yellow-500' : 'bg-yellow-100'
                }`}>
                  <Zap size={20} className={runningWorkflow?.type === 'transform' ? 'text-white' : 'text-yellow-600'} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">AI 변환</p>
                  <p className="text-xs text-gray-500">상품 정보</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats?.todayTransformed || 0}</div>
              {runningWorkflow?.type === 'transform' && (
                <div className="absolute -top-2 -right-2">
                  <span className="flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500 items-center justify-center">
                      <RefreshCw size={10} className="text-white animate-spin" />
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Arrow with Conversion Rate */}
          <div className="px-2 flex flex-col items-center">
            <span className="text-xs font-medium text-gray-500 mb-1">
              {stats?.todayTransformed ? ((stats.todayProducts / stats.todayTransformed) * 100).toFixed(1) : 0}%
            </span>
            <ArrowRight size={18} className="text-gray-300" />
          </div>

          {/* Step 3: 상품 등록 */}
          <div className="flex-1">
            <div className="relative p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <ShoppingBag size={20} className="text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">상품 등록</p>
                  <p className="text-xs text-gray-500">Product</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats?.todayProducts || 0}</div>
            </div>
          </div>

          {/* Arrow with Conversion Rate (채널별 평균) */}
          <div className="px-2 flex flex-col items-center">
            <span className="text-xs font-medium text-gray-500 mb-1">
              {(() => {
                const channelCount = (config?.retailChannelIds?.length || 0) + (config?.shopIds?.length || 0)
                if (!stats?.todayProducts || !channelCount) return '0'
                return ((stats.todayPublished / channelCount / stats.todayProducts) * 100).toFixed(1)
              })()}%
            </span>
            <ArrowRight size={18} className="text-gray-300" />
          </div>

          {/* Step 4: 발행 */}
          <div className="flex-1">
            <div className={`relative p-4 rounded-xl border-2 transition-all ${
              runningWorkflow?.type === 'publish'
                ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  runningWorkflow?.type === 'publish' ? 'bg-blue-500' : 'bg-blue-100'
                }`}>
                  <Upload size={20} className={runningWorkflow?.type === 'publish' ? 'text-white' : 'text-blue-600'} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">발행</p>
                  <p className="text-xs text-gray-500">소매밴드</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats?.todayPublished || 0}</div>
              {runningWorkflow?.type === 'publish' && (
                <div className="absolute -top-2 -right-2">
                  <span className="flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 items-center justify-center">
                      <RefreshCw size={10} className="text-white animate-spin" />
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

      </Card>

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

        {/* Schedule Info - 그래프 옆에 배치 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={20} className="text-blue-500" />
              스케줄 정보
            </h2>
            <Link href="/automation/settings">
              <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Settings size={12} />
                설정
              </button>
            </Link>
          </div>

          {/* 다음 실행 시간 - 강조 표시 */}
          {config?.isEnabled && config?.selectedHours && config.selectedHours.length > 0 ? (
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-xs mb-1">다음 실행</p>
                  <p className="text-2xl font-bold">
                    {calculateNextExecution(config.selectedHours).nextTime}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-blue-100 text-xs mb-1">남은 시간</p>
                  <p className="text-lg font-semibold text-blue-100">
                    {countdown || '계산 중...'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-gray-100 rounded-xl">
              <div className="flex items-center gap-3 text-gray-500">
                <Pause size={20} />
                <div>
                  <p className="font-medium text-gray-700">자동 실행 비활성화</p>
                  <p className="text-xs">설정에서 스케줄을 활성화하세요</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* 실행 시간대 */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Timer size={16} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1">실행 시간대</p>
                {config?.selectedHours && config.selectedHours.length > 0 ? (
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {config.selectedHours.length === 24
                        ? '매 시간 실행'
                        : `하루 ${config.selectedHours.length}회`}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {[...config.selectedHours].sort((a, b) => a - b).slice(0, 6).map(hour => (
                        <span
                          key={hour}
                          className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded font-medium"
                        >
                          {hour.toString().padStart(2, '0')}:00
                        </span>
                      ))}
                      {config.selectedHours.length > 6 && (
                        <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                          +{config.selectedHours.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="font-medium text-gray-400 text-sm">설정 안됨</p>
                )}
              </div>
            </div>

            {/* 마지막 실행 */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={16} className="text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">마지막 실행</p>
                <p className="font-medium text-gray-900 text-sm">
                  {config?.lastRunAt
                    ? new Date(config.lastRunAt).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '아직 실행 기록 없음'}
                </p>
              </div>
            </div>
          </div>
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
          {runningWorkflow.type === 'FULL_PIPELINE1' && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                {/* 1. 수집 */}
                <div className={`flex-1 relative ${runningWorkflow.currentStage === 'collection' ? 'z-10' : ''}`}>
                  <div className={`p-3 rounded-lg border-2 transition-all ${
                    runningWorkflow.stageProgress?.collection
                      ? 'bg-green-50 border-green-300'
                      : runningWorkflow.currentStage === 'collection'
                      ? 'bg-green-100 border-green-500 shadow-lg animate-pulse'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {runningWorkflow.stageProgress?.collection ? (
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
                        {runningWorkflow.stageProgress.collection.totalNewPosts}건
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
                      : runningWorkflow.stageProgress?.collection
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
                        {runningWorkflow.stageProgress.transform.batchProgress ? (
                          `${runningWorkflow.stageProgress.transform.batchProgress.current}/${runningWorkflow.stageProgress.transform.batchProgress.total}`
                        ) : (
                          `${runningWorkflow.stageProgress.transform.success}건`
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
                    runningWorkflow.stageProgress?.productCreate
                      ? 'bg-orange-50 border-orange-300'
                      : runningWorkflow.currentStage === 'productCreate'
                      ? 'bg-orange-100 border-orange-500 shadow-lg animate-pulse'
                      : runningWorkflow.stageProgress?.transform?.completed
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-gray-50 border-gray-100 opacity-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {runningWorkflow.stageProgress?.productCreate ? (
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
                        {runningWorkflow.stageProgress.productCreate.success}건
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
                      : runningWorkflow.stageProgress?.productCreate
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
                        {runningWorkflow.stageProgress.publish.currentProgress ? (
                          <>
                            <p>{runningWorkflow.stageProgress.publish.currentChannel}</p>
                            <p>{runningWorkflow.stageProgress.publish.currentProgress.current}/{runningWorkflow.stageProgress.publish.currentProgress.total}</p>
                          </>
                        ) : (
                          <p>{runningWorkflow.stageProgress.publish.success}건</p>
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
                  {runningWorkflow.stageProgress.collection && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">수집 완료</span>
                      <span className="text-green-600 font-medium">
                        {runningWorkflow.stageProgress.collection.channelResults.length}개 채널에서 {runningWorkflow.stageProgress.collection.totalNewPosts}건
                      </span>
                    </div>
                  )}
                  {runningWorkflow.stageProgress.transform && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">AI 변환</span>
                      <span className={runningWorkflow.stageProgress.transform.completed ? 'text-yellow-600 font-medium' : 'text-gray-500'}>
                        {runningWorkflow.stageProgress.transform.batchProgress
                          ? `${runningWorkflow.stageProgress.transform.batchProgress.current}/${runningWorkflow.stageProgress.transform.batchProgress.total} 배치`
                          : `${runningWorkflow.stageProgress.transform.success}건 성공`}
                        {runningWorkflow.stageProgress.transform.failed > 0 && (
                          <span className="text-red-500 ml-1">({runningWorkflow.stageProgress.transform.failed}건 실패)</span>
                        )}
                      </span>
                    </div>
                  )}
                  {runningWorkflow.stageProgress.productCreate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">상품 등록</span>
                      <span className="text-orange-600 font-medium">
                        {runningWorkflow.stageProgress.productCreate.success}건 성공
                        {runningWorkflow.stageProgress.productCreate.failed > 0 && (
                          <span className="text-red-500 ml-1">({runningWorkflow.stageProgress.productCreate.failed}건 실패)</span>
                        )}
                      </span>
                    </div>
                  )}
                  {runningWorkflow.stageProgress.publish && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">발행</span>
                      <span className="text-blue-600 font-medium">
                        {runningWorkflow.stageProgress.publish.success}건 성공
                        {runningWorkflow.stageProgress.publish.failed > 0 && (
                          <span className="text-red-500 ml-1">({runningWorkflow.stageProgress.publish.failed}건 실패)</span>
                        )}
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

      {/* Recent Logs - Timeline Style */}
      <Card className="p-6 bg-gradient-to-br from-slate-50 to-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <History size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">최근 실행 기록</h2>
              <p className="text-sm text-gray-500">최근 5개의 실행 내역</p>
            </div>
          </div>
          <Link
            href="/automation/logs"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            전체보기
            <ArrowRight size={16} />
          </Link>
        </div>

        {recentLogs.length > 0 ? (
          <div className="space-y-3">
            {recentLogs.map((log, index) => {
              const isSuccess = log.status === 'SUCCESS'
              const isFailed = log.status === 'FAILED'
              const isRunning = log.status === 'RUNNING'

              // 타입별 아이콘 및 색상
              const typeConfig: Record<string, { icon: JSX.Element; gradient: string; bgLight: string }> = {
                collect: {
                  icon: <Package size={16} />,
                  gradient: 'from-green-500 to-emerald-600',
                  bgLight: 'bg-green-50'
                },
                transform: {
                  icon: <Zap size={16} />,
                  gradient: 'from-yellow-500 to-amber-600',
                  bgLight: 'bg-yellow-50'
                },
                register: {
                  icon: <ShoppingBag size={16} />,
                  gradient: 'from-orange-500 to-red-600',
                  bgLight: 'bg-orange-50'
                },
                publish: {
                  icon: <Upload size={16} />,
                  gradient: 'from-blue-500 to-cyan-600',
                  bgLight: 'bg-blue-50'
                },
                full: {
                  icon: <Play size={16} />,
                  gradient: 'from-purple-500 to-pink-600',
                  bgLight: 'bg-purple-50'
                },
              }

              const config = typeConfig[log.type] || typeConfig.full

              // 상대 시간 계산
              const getRelativeTime = (dateStr: string) => {
                const date = new Date(dateStr)
                const now = new Date()
                const diffMs = now.getTime() - date.getTime()
                const diffMinutes = Math.floor(diffMs / (1000 * 60))
                const diffHours = Math.floor(diffMinutes / 60)
                const diffDays = Math.floor(diffHours / 24)

                if (diffMinutes < 1) return '방금 전'
                if (diffMinutes < 60) return `${diffMinutes}분 전`
                if (diffHours < 24) return `${diffHours}시간 전`
                if (diffDays < 7) return `${diffDays}일 전`
                return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
              }

              return (
                <div
                  key={log.id}
                  className={`relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    isSuccess ? 'border-green-200 bg-gradient-to-r from-green-50/80 to-white hover:border-green-300' :
                    isFailed ? 'border-red-200 bg-gradient-to-r from-red-50/80 to-white hover:border-red-300' :
                    'border-yellow-200 bg-gradient-to-r from-yellow-50/80 to-white hover:border-yellow-300'
                  }`}
                >
                  {/* Timeline connector */}
                  {index < recentLogs.length - 1 && (
                    <div className="absolute left-[1.875rem] top-full w-0.5 h-3 bg-gray-200 z-0" />
                  )}

                  {/* Type Icon */}
                  <div className={`relative z-10 w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
                    <span className="text-white">{config.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{getTypeName(log.type)}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        isSuccess ? 'bg-green-100 text-green-700' :
                        isFailed ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {isSuccess ? (
                          <><CheckCircle size={12} /> 성공</>
                        ) : isFailed ? (
                          <><AlertCircle size={12} /> 실패</>
                        ) : (
                          <><RefreshCw size={12} className="animate-spin" /> 실행중</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {getRelativeTime(log.startedAt)}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-400 text-xs">
                        {new Date(log.startedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Item Count Badge */}
                  <div className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl ${
                    isSuccess ? 'bg-green-100' :
                    isFailed ? 'bg-red-100' :
                    'bg-yellow-100'
                  }`}>
                    <span className={`text-xl font-bold ${
                      isSuccess ? 'text-green-700' :
                      isFailed ? 'text-red-700' :
                      'text-yellow-700'
                    }`}>
                      {log.itemCount}
                    </span>
                    <span className={`text-xs ${
                      isSuccess ? 'text-green-600' :
                      isFailed ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      처리
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <History size={32} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium mb-1">아직 실행 기록이 없습니다</p>
            <p className="text-sm text-gray-400">자동화를 실행하면 여기에 기록이 표시됩니다</p>
          </div>
        )}
      </Card>
    </div>
  )
}
