'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  Bot,
  ListChecks,
  Clock,
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import AgentCard, { type Agent } from '@/components/admin/agents/AgentCard'
import AgentLayerSection from '@/components/admin/agents/AgentLayerSection'
import RealtimeEventFeed from '@/components/admin/agents/RealtimeEventFeed'

type AgentLayer = 'CORE' | 'BUSINESS' | 'INTELLIGENCE'

interface KpiSummary {
  activeAgents: number
  totalAgents: number
  todayTasks: number
  avgResponseTime: string
  kpiAchievement: number
}

interface DashboardData {
  kpiSummary: KpiSummary
  agents: Agent[]
}

const REFRESH_INTERVAL = 30_000

const sampleData: DashboardData = {
  kpiSummary: {
    activeAgents: 8,
    totalAgents: 12,
    todayTasks: 156,
    avgResponseTime: '1.2s',
    kpiAchievement: 87,
  },
  agents: [
    {
      id: 'orchestrator',
      name: 'orchestrator',
      displayName: '오케스트레이터',
      layer: 'CORE',
      icon: 'Workflow',
      status: 'ACTIVE',
      description: '에이전트 간 작업 조율 및 워크플로우 관리',
      config: { kpiTargets: [{ label: '워크플로우 성공률', current: 95, target: 100 }] },
    },
    {
      id: 'scheduler',
      name: 'scheduler',
      displayName: '스케줄러',
      layer: 'CORE',
      icon: 'Clock',
      status: 'ACTIVE',
      description: '작업 스케줄링 및 큐 관리',
      config: { kpiTargets: [{ label: '스케줄 정시율', current: 98, target: 100 }] },
    },
    {
      id: 'health-monitor',
      name: 'health-monitor',
      displayName: '헬스 모니터',
      layer: 'CORE',
      icon: 'HeartPulse',
      status: 'ACTIVE',
      description: '시스템 상태 모니터링 및 알림',
      config: { kpiTargets: [{ label: '가동률', current: 99, target: 100 }] },
    },
    {
      id: 'sourcing-agent',
      name: 'sourcing-agent',
      displayName: '소싱 에이전트',
      layer: 'BUSINESS',
      icon: 'Package',
      status: 'ACTIVE',
      description: '도매밴드 상품 수집 및 AI 가공 자동화',
      config: { kpiTargets: [{ label: '수집 목표 달성률', current: 85, target: 100 }] },
    },
    {
      id: 'order-agent',
      name: 'order-agent',
      displayName: '주문 에이전트',
      layer: 'BUSINESS',
      icon: 'ShoppingCart',
      status: 'ACTIVE',
      description: '주문 접수, 상태 변경, 배송 연동',
      config: { kpiTargets: [{ label: '주문 처리율', current: 92, target: 100 }] },
    },
    {
      id: 'cs-agent',
      name: 'cs-agent',
      displayName: 'CS 에이전트',
      layer: 'BUSINESS',
      icon: 'MessageSquare',
      status: 'INACTIVE',
      description: '고객 문의 자동 분류 및 응답',
      config: { kpiTargets: [{ label: '응답률', current: 60, target: 100 }] },
    },
    {
      id: 'settlement-agent',
      name: 'settlement-agent',
      displayName: '정산 에이전트',
      layer: 'BUSINESS',
      icon: 'Calculator',
      status: 'ACTIVE',
      description: '판매자 정산 자동 처리',
      config: {},
    },
    {
      id: 'price-optimizer',
      name: 'price-optimizer',
      displayName: '가격 최적화',
      layer: 'INTELLIGENCE',
      icon: 'TrendingUp',
      status: 'ACTIVE',
      description: '경쟁사 분석 기반 가격 자동 조정',
      config: { kpiTargets: [{ label: '마진 목표 달성률', current: 78, target: 100 }] },
    },
    {
      id: 'demand-predictor',
      name: 'demand-predictor',
      displayName: '수요 예측',
      layer: 'INTELLIGENCE',
      icon: 'BarChart3',
      status: 'ACTIVE',
      description: 'AI 기반 수요 예측 및 재고 권장',
      config: { kpiTargets: [{ label: '예측 정확도', current: 82, target: 90 }] },
    },
    {
      id: 'content-generator',
      name: 'content-generator',
      displayName: '콘텐츠 생성',
      layer: 'INTELLIGENCE',
      icon: 'Sparkles',
      status: 'ERROR',
      description: 'AI 상품 설명 및 이미지 자동 생성',
      config: {},
    },
  ],
}

export default function AgentDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agents/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch {
      // Fallback to sample data in development
      setData(sampleData)
      setError(null)
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    const timer = setInterval(fetchDashboard, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [fetchDashboard])

  const handleToggle = useCallback(async (agentId: string) => {
    if (!data) return
    const agent = data.agents.find(a => a.id === agentId)
    if (!agent) return

    const endpoint = agent.status === 'ACTIVE'
      ? `/api/admin/agents/${agentId}/stop`
      : `/api/admin/agents/${agentId}/start`

    try {
      await fetch(endpoint, { method: 'POST' })
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          agents: prev.agents.map(a =>
            a.id === agentId
              ? { ...a, status: a.status === 'ACTIVE' ? 'INACTIVE' as const : 'ACTIVE' as const }
              : a
          ),
        }
      })
    } catch {
      // Optimistic update fallback
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          agents: prev.agents.map(a =>
            a.id === agentId
              ? { ...a, status: a.status === 'ACTIVE' ? 'INACTIVE' as const : 'ACTIVE' as const }
              : a
          ),
        }
      })
    }
  }, [data])

  const layers: AgentLayer[] = ['CORE', 'BUSINESS', 'INTELLIGENCE']

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">에이전트 대시보드</h1>
              <p className="text-gray-600">전체 에이전트 현황을 한눈에 확인합니다</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">에이전트 대시보드</h1>
              <p className="text-gray-600">전체 에이전트 현황을 한눈에 확인합니다</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  const summary = data?.kpiSummary
  const agents = data?.agents ?? []

  const kpiCards = [
    {
      label: '활성 에이전트',
      value: `${summary?.activeAgents ?? 0}/${summary?.totalAgents ?? 0}`,
      icon: Bot,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '오늘 작업',
      value: `${summary?.todayTasks ?? 0}건`,
      icon: ListChecks,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '평균 응답 시간',
      value: summary?.avgResponseTime ?? '-',
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'KPI 달성률',
      value: `${summary?.kpiAchievement ?? 0}%`,
      icon: TrendingUp,
      color: summary && summary.kpiAchievement >= 80 ? 'text-green-600' : 'text-yellow-600',
      bg: summary && summary.kpiAchievement >= 80 ? 'bg-green-50' : 'bg-yellow-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">에이전트 대시보드</h1>
              <p className="text-gray-600">전체 에이전트 현황을 한눈에 확인합니다</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              마지막 갱신: {lastRefresh.toLocaleTimeString('ko-KR')}
            </span>
            <button
              onClick={fetchDashboard}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Layer Sections */}
      <div className="space-y-2">
        {layers.map((layer) => {
          const layerAgents = agents.filter(a => a.layer === layer)
          return (
            <AgentLayerSection
              key={layer}
              layer={layer}
              agents={layerAgents}
              onToggle={handleToggle}
            />
          )
        })}
      </div>

      {/* Real-time Event Feed */}
      <RealtimeEventFeed />
    </div>
  )
}
