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
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

interface AutomationStats {
  todayCollected: number
  pendingTransform: number
  readyToPublish: number
  todayPublished: number
}

interface AutomationConfig {
  isEnabled: boolean
  cronInterval: string
  lastRunAt: string | null
  nextRunAt: string | null
}

interface RunningWorkflow {
  id: number
  type: string
  status: string
  startedAt: string
  totalItems: number
  successCount: number
  failedCount: number
}

interface RecentLog {
  id: number
  type: string
  status: 'SUCCESS' | 'FAILED' | 'RUNNING'
  startedAt: string
  completedAt: string | null
  itemCount: number
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

  const loadData = useCallback(async () => {
    try {
      const [statsRes, configRes, executeRes, logsRes] = await Promise.all([
        fetch('/api/automation/stats'),
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
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  // 카운트다운 타이머
  useEffect(() => {
    if (!config?.nextRunAt || !config?.isEnabled) {
      setCountdown('')
      return
    }

    const updateCountdown = () => {
      const next = new Date(config.nextRunAt!).getTime()
      const now = Date.now()
      const diff = next - now

      if (diff <= 0) {
        setCountdown('곧 실행')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setCountdown(`${hours}시간 ${minutes}분`)
      } else if (minutes > 0) {
        setCountdown(`${minutes}분 ${seconds}초`)
      } else {
        setCountdown(`${seconds}초`)
      }
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [config?.nextRunAt, config?.isEnabled])

  const handleExecute = async (type: 'collect' | 'transform' | 'publish' | 'full') => {
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
        toast.error(data.error || '실행에 실패했습니다.')
      }
    } catch (error) {
      toast.error('실행 중 오류가 발생했습니다.')
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
      case 'publish': return '소매밴드 발행'
      case 'full': return '전체 파이프라인'
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

  const getIntervalLabel = (interval: string): string => {
    const labels: Record<string, string> = {
      '1h': '1시간',
      '3h': '3시간',
      '6h': '6시간',
      '12h': '12시간',
      '24h': '24시간',
    }
    return labels[interval] || interval
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
                    <span className="mx-2">•</span>
                    {getIntervalLabel(config.cronInterval || '1h')} 간격
                    {countdown && (
                      <>
                        <span className="mx-2">•</span>
                        다음 실행까지 <span className="font-semibold">{countdown}</span>
                      </>
                    )}
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

      {/* Pipeline Flow Visualization */}
      <Card className="p-6 bg-gradient-to-r from-slate-50 to-white">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-500" />
          파이프라인 현황
        </h2>

        <div className="flex items-center justify-between">
          {/* Step 1: 수집 */}
          <div className="flex-1">
            <div className={`relative p-5 rounded-xl border-2 transition-all ${
              runningWorkflow?.type === 'collect'
                ? 'border-green-500 bg-green-50 shadow-lg shadow-green-100'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  runningWorkflow?.type === 'collect' ? 'bg-green-500' : 'bg-green-100'
                }`}>
                  <Package size={24} className={runningWorkflow?.type === 'collect' ? 'text-white' : 'text-green-600'} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">수집</p>
                  <p className="text-xs text-gray-500">도매밴드에서 수집</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-gray-900">{stats?.todayCollected || 0}</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">오늘</span>
              </div>
              {runningWorkflow?.type === 'collect' && (
                <div className="absolute -top-2 -right-2">
                  <span className="flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500 items-center justify-center">
                      <RefreshCw size={12} className="text-white animate-spin" />
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="px-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <ArrowRight size={20} className="text-gray-400" />
            </div>
          </div>

          {/* Step 2: AI 변환 */}
          <div className="flex-1">
            <div className={`relative p-5 rounded-xl border-2 transition-all ${
              runningWorkflow?.type === 'transform'
                ? 'border-yellow-500 bg-yellow-50 shadow-lg shadow-yellow-100'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  runningWorkflow?.type === 'transform' ? 'bg-yellow-500' : 'bg-yellow-100'
                }`}>
                  <Zap size={24} className={runningWorkflow?.type === 'transform' ? 'text-white' : 'text-yellow-600'} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">AI 변환</p>
                  <p className="text-xs text-gray-500">상품 정보 생성</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-gray-900">{stats?.pendingTransform || 0}</span>
                <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">대기중</span>
              </div>
              {runningWorkflow?.type === 'transform' && (
                <div className="absolute -top-2 -right-2">
                  <span className="flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-yellow-500 items-center justify-center">
                      <RefreshCw size={12} className="text-white animate-spin" />
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="px-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <ArrowRight size={20} className="text-gray-400" />
            </div>
          </div>

          {/* Step 3: 발행 */}
          <div className="flex-1">
            <div className={`relative p-5 rounded-xl border-2 transition-all ${
              runningWorkflow?.type === 'publish'
                ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  runningWorkflow?.type === 'publish' ? 'bg-blue-500' : 'bg-blue-100'
                }`}>
                  <Upload size={24} className={runningWorkflow?.type === 'publish' ? 'text-white' : 'text-blue-600'} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">발행</p>
                  <p className="text-xs text-gray-500">소매밴드 발행</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-gray-900">{stats?.readyToPublish || 0}</span>
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">준비됨</span>
              </div>
              {runningWorkflow?.type === 'publish' && (
                <div className="absolute -top-2 -right-2">
                  <span className="flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-500 items-center justify-center">
                      <RefreshCw size={12} className="text-white animate-spin" />
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="px-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <ArrowRight size={20} className="text-gray-400" />
            </div>
          </div>

          {/* Step 4: 완료 */}
          <div className="flex-1">
            <div className="relative p-5 rounded-xl border-2 border-gray-200 bg-gradient-to-br from-purple-50 to-white hover:border-purple-300 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <CheckCircle size={24} className="text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">완료</p>
                  <p className="text-xs text-gray-500">오늘 발행 완료</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-purple-600">{stats?.todayPublished || 0}</span>
                <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">완료</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Running Workflow Monitor */}
      {runningWorkflow && (
        <Card className="p-6 border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center justify-between mb-4">
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

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">진행률</span>
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

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">처리</p>
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Manual Execution */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Play size={20} className="text-green-500" />
            수동 실행
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => handleExecute('collect')}
              disabled={isExecuting || !!runningWorkflow}
              className="group relative p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-green-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-lg bg-green-100 group-hover:bg-green-500 flex items-center justify-center mb-3 transition-colors">
                <Package size={20} className="text-green-600 group-hover:text-white transition-colors" />
              </div>
              <p className="font-medium text-gray-900 text-sm">게시물 수집</p>
              <p className="text-xs text-gray-500 mt-1">도매밴드 수집</p>
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
              onClick={() => handleExecute('publish')}
              disabled={isExecuting || !!runningWorkflow}
              className="group relative p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 group-hover:bg-blue-500 flex items-center justify-center mb-3 transition-colors">
                <Upload size={20} className="text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <p className="font-medium text-gray-900 text-sm">소매밴드 발행</p>
              <p className="text-xs text-gray-500 mt-1">준비된 상품 발행</p>
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

        {/* Schedule Info */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-blue-500" />
            스케줄 정보
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Timer size={18} className="text-gray-500" />
              <div>
                <p className="text-xs text-gray-500">실행 주기</p>
                <p className="font-medium text-gray-900">
                  {config?.cronInterval ? `${getIntervalLabel(config.cronInterval)} 마다` : '설정 안됨'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <CheckCircle size={18} className="text-green-500" />
              <div>
                <p className="text-xs text-gray-500">마지막 실행</p>
                <p className="font-medium text-gray-900">{formatTime(config?.lastRunAt || null)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <TrendingUp size={18} className="text-blue-500" />
              <div>
                <p className="text-xs text-gray-500">다음 실행</p>
                <p className="font-medium text-blue-600">
                  {config?.isEnabled ? formatTime(config?.nextRunAt || null) : '비활성화'}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Logs */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <History size={20} className="text-gray-500" />
            최근 실행 기록
          </h2>
          <Link href="/automation/logs" className="text-sm text-blue-600 hover:text-blue-800">
            전체보기 →
          </Link>
        </div>

        {recentLogs.length > 0 ? (
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    log.status === 'SUCCESS' ? 'bg-green-100' :
                    log.status === 'FAILED' ? 'bg-red-100' : 'bg-yellow-100'
                  }`}>
                    {log.status === 'SUCCESS' ? (
                      <CheckCircle size={16} className="text-green-600" />
                    ) : log.status === 'FAILED' ? (
                      <AlertCircle size={16} className="text-red-600" />
                    ) : (
                      <RefreshCw size={16} className="text-yellow-600 animate-spin" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{getTypeName(log.type)}</p>
                    <p className="text-xs text-gray-500">{formatDate(log.startedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">{log.itemCount}건</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    log.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                    log.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {log.status === 'SUCCESS' ? '성공' : log.status === 'FAILED' ? '실패' : '실행중'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <History size={40} className="mx-auto mb-2 text-gray-300" />
            <p>아직 실행 기록이 없습니다.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
