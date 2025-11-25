'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'

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

export default function AutomationDashboardPage() {
  const toast = useToast()
  const [stats, setStats] = useState<AutomationStats | null>(null)
  const [config, setConfig] = useState<AutomationConfig | null>(null)
  const [runningWorkflow, setRunningWorkflow] = useState<RunningWorkflow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000) // 10초마다 갱신
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, configRes, executeRes] = await Promise.all([
        fetch('/api/automation/stats'),
        fetch('/api/automation/config'),
        fetch('/api/automation/execute'),
      ])

      const statsData = await statsRes.json()
      const configData = await configRes.json()
      const executeData = await executeRes.json()

      if (statsData.success) setStats(statsData.data)
      if (configData.success) setConfig(configData.data)
      if (executeData.success) setRunningWorkflow(executeData.data.workflow)
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

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
        toast.success(`${getTypeName(type)} 실행이 완료되었습니다.`)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">자동화 대시보드</h1>
          <p className="text-gray-600 mt-1">자동화 워크플로우 상태 및 수동 실행</p>
        </div>
        <div className="flex items-center gap-2">
          {config?.isEnabled ? (
            <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              자동화 활성
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
              <span className="w-2 h-2 bg-gray-400 rounded-full" />
              자동화 비활성
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">오늘 수집</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.todayCollected || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Zap className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">AI 대기</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.pendingTransform || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">발행 준비</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.readyToPublish || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">오늘 발행</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.todayPublished || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Running Workflow */}
      {runningWorkflow && (
        <Card className="p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-yellow-600" />
              <div>
                <p className="font-medium text-gray-900">
                  {getTypeName(runningWorkflow.type)} 실행 중
                </p>
                <p className="text-sm text-gray-600">
                  시작: {formatDate(runningWorkflow.startedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  진행: {runningWorkflow.successCount} / {runningWorkflow.totalItems}
                </p>
                {runningWorkflow.failedCount > 0 && (
                  <p className="text-sm text-red-600">
                    실패: {runningWorkflow.failedCount}
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <XCircle size={16} />
                {isCancelling ? '취소 중...' : '취소'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">수동 실행</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            variant="secondary"
            onClick={() => handleExecute('collect')}
            disabled={isExecuting || !!runningWorkflow}
            className="flex items-center justify-center gap-2"
          >
            <Package size={18} />
            게시물 수집
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleExecute('transform')}
            disabled={isExecuting || !!runningWorkflow}
            className="flex items-center justify-center gap-2"
          >
            <Zap size={18} />
            AI 변환
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleExecute('publish')}
            disabled={isExecuting || !!runningWorkflow}
            className="flex items-center justify-center gap-2"
          >
            <Upload size={18} />
            소매밴드 발행
          </Button>

          <Button
            variant="primary"
            onClick={() => handleExecute('full')}
            disabled={isExecuting || !!runningWorkflow}
            className="flex items-center justify-center gap-2"
          >
            <Play size={18} />
            전체 실행
          </Button>
        </div>
      </Card>

      {/* Schedule Info */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">스케줄 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-600">실행 주기</p>
              <p className="font-medium text-gray-900">
                {config?.cronInterval ? getIntervalLabel(config.cronInterval) : '설정 안됨'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-600">마지막 실행</p>
              <p className="font-medium text-gray-900">{formatDate(config?.lastRunAt || null)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-600">다음 실행</p>
              <p className="font-medium text-gray-900">{formatDate(config?.nextRunAt || null)}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function getIntervalLabel(interval: string): string {
  const labels: Record<string, string> = {
    '1h': '1시간마다',
    '3h': '3시간마다',
    '6h': '6시간마다',
    '12h': '12시간마다',
    '24h': '24시간마다',
  }
  return labels[interval] || interval
}
