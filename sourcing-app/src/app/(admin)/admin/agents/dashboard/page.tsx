'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LayoutDashboard,
  Bot,
  ListChecks,
  Clock,
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pause,
  Wrench,
  ArrowUpRight,
} from 'lucide-react'
import AgentCard, { type Agent } from '@/components/admin/agents/AgentCard'
import AgentLayerSection from '@/components/admin/agents/AgentLayerSection'
import RealtimeEventFeed from '@/components/admin/agents/RealtimeEventFeed'

type AgentLayer = 'COMMAND' | 'SOURCING' | 'OPERATIONS' | 'COMMERCE' | 'INFRA'

interface KpiSummary {
  activeAgents: number
  totalAgents: number
  todayTasks: number
  avgResponseTime: string
  kpiAchievement: number
  errorAgents: number
}

interface DashboardAlert {
  agentName: string
  type: 'error' | 'kpi_miss' | 'high_latency'
  message: string
}

interface DashboardData {
  kpiSummary: KpiSummary
  agents: Agent[]
  alerts: DashboardAlert[]
}

const REFRESH_INTERVAL = 30_000

// 11개 자율운영 AI 에이전트 시드 데이터 (5 Layer) — v3
const SEED_AGENTS: Agent[] = [
  // COMMAND (1)
  { id: '1', name: 'commander', displayName: '🧠 Commander', layer: 'COMMAND', icon: 'Brain', status: 'INACTIVE', description: '전체 에이전트 오케스트레이션, 이벤트 라우팅, 장애 자동복구, 운영 리포트', config: { kpiTargets: [{ label: '이벤트 지연', current: 0, target: 500 }, { label: '자동복구율', current: 0, target: 95 }] } },
  // SOURCING (2)
  { id: '2', name: 'sourcing-agent', displayName: '📦 Sourcing Agent', layer: 'SOURCING', icon: 'Package', status: 'INACTIVE', description: '카테고리/조건 기반 소싱, 잘팔리는 상품 우선 소싱, AI 변환, 발행, 소싱처 추적관리', config: { kpiTargets: [{ label: '일일 수집량', current: 0, target: 50 }, { label: '발행 성공률', current: 0, target: 95 }] } },
  { id: '3', name: 'product-manager', displayName: '📋 Product Manager', layer: 'SOURCING', icon: 'ClipboardCheck', status: 'INACTIVE', description: '상품 품절/변동 감지, 쇼핑몰·소매밴드 즉시 반영, 가격 동기화', config: { kpiTargets: [{ label: '품절 반영', current: 0, target: 5 }, { label: '가격 동기화율', current: 0, target: 100 }] } },
  // OPERATIONS (2)
  { id: '4', name: 'marketing-agent', displayName: '📢 Marketing Agent', layer: 'OPERATIONS', icon: 'Megaphone', status: 'INACTIVE', description: '소매밴드 공지 자동발송(3회/일), 카카오톡채널 광고, 프로모션 관리', config: { kpiTargets: [{ label: '공지 발송률', current: 0, target: 100 }] } },
  { id: '5', name: 'customer-agent', displayName: '👤 Customer Agent', layer: 'OPERATIONS', icon: 'MessageCircle', status: 'INACTIVE', description: '카톡/댓글/문자/1:1창 소통 관리, FAQ 자동응답, 반품/교환 처리', config: { kpiTargets: [{ label: '자동 응답률', current: 0, target: 70 }] } },
  // COMMERCE (3)
  { id: '6', name: 'order-agent', displayName: '📝 Order Agent', layer: 'COMMERCE', icon: 'ClipboardList', status: 'INACTIVE', description: '주문 접수, 결제 관리, 소싱처 발주(각 양식), 미결제 자동취소', config: { kpiTargets: [{ label: '주문처리 지연', current: 0, target: 1 }, { label: '발주 성공률', current: 0, target: 99 }] } },
  { id: '7', name: 'shipping-agent', displayName: '🚚 Shipping Agent', layer: 'COMMERCE', icon: 'Truck', status: 'INACTIVE', description: '배송 진행사항 관리, 송장번호 등록, 배송 상태 추적 및 알림', config: { kpiTargets: [{ label: '송장 등록률', current: 0, target: 100 }] } },
  { id: '8', name: 'settlement-agent', displayName: '💰 Settlement Agent', layer: 'COMMERCE', icon: 'Coins', status: 'INACTIVE', description: '도매밴드 정산, 관리소매밴드 정산, 매출/수익 정산 자동화', config: { kpiTargets: [{ label: '정산 정확도', current: 0, target: 100 }] } },
  // INFRA (3)
  { id: '9', name: 'session-keeper', displayName: '🔐 Session Keeper', layer: 'INFRA', icon: 'Shield', status: 'INACTIVE', description: 'Band 세션 모니터링, 자동 복구, Docker 헬스체크, DB 연결 감시', config: { kpiTargets: [{ label: '가동률', current: 0, target: 99.9 }] } },
  { id: '10', name: 'watcher', displayName: '📡 Watcher', layer: 'INFRA', icon: 'Radio', status: 'INACTIVE', description: '시스템 모니터링, KPI 추적, 이상탐지, 관리자 알림', config: { kpiTargets: [{ label: '감지 시간', current: 0, target: 1 }] } },
  { id: '11', name: 'analyst', displayName: '📊 Analyst', layer: 'INFRA', icon: 'BarChart3', status: 'INACTIVE', description: '매출/전환 분석, 상품 성과 평가, 가격 최적화, 운영 리포트', config: { kpiTargets: [{ label: '데이터 정확도', current: 0, target: 99 }] } },
]

const defaultSummary: KpiSummary = {
  activeAgents: 0,
  totalAgents: 11,
  todayTasks: 0,
  avgResponseTime: '-',
  kpiAchievement: 0,
  errorAgents: 0,
}

export default function AgentDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, agentsRes] = await Promise.allSettled([
        fetch('/api/admin/agents/dashboard'),
        fetch('/api/admin/agents'),
      ])

      let summary = { ...defaultSummary }
      let agents: Agent[] = [...SEED_AGENTS]
      let alerts: DashboardAlert[] = []

      // 대시보드 통계
      if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
        const dash = await dashRes.value.json()
        if (dash.overview) {
          summary = {
            activeAgents: dash.overview.activeAgents || 0,
            totalAgents: dash.overview.totalAgents || 17,
            todayTasks: dash.overview.tasksToday || 0,
            avgResponseTime: dash.overview.avgLatency ? `${dash.overview.avgLatency}ms` : '-',
            kpiAchievement: dash.overview.kpiAchievement || 0,
            errorAgents: dash.overview.errorAgents || 0,
          }
        }
        if (dash.alerts) alerts = dash.alerts
      }

      // 에이전트 목록 (DB에 있으면 병합)
      if (agentsRes.status === 'fulfilled' && agentsRes.value.ok) {
        const agentsData = await agentsRes.value.json()
        const dbAgents: Agent[] = agentsData.agents || []
        if (dbAgents.length > 0) {
          // DB 에이전트로 시드 데이터 업데이트
          agents = SEED_AGENTS.map(seed => {
            const db = dbAgents.find((a: Agent) => a.name === seed.name)
            if (db) {
              return {
                ...seed,
                id: db.id,
                status: db.status,
                config: db.config?.kpiTargets ? db.config : seed.config,
              }
            }
            return seed
          })
          // DB에만 있는 에이전트 추가
          for (const db of dbAgents) {
            if (!agents.find(a => a.name === db.name)) {
              agents.push(db)
            }
          }
          summary.activeAgents = agents.filter(a => a.status === 'ACTIVE').length
          summary.errorAgents = agents.filter(a => a.status === 'ERROR').length
          summary.totalAgents = agents.length
        }
      }

      setData({ kpiSummary: summary, agents, alerts })
    } catch {
      // Fallback
      setData({
        kpiSummary: defaultSummary,
        agents: SEED_AGENTS,
        alerts: [],
      })
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

    // Optimistic update
    setData(prev => {
      if (!prev) return prev
      const newStatus = agent.status === 'ACTIVE' ? 'INACTIVE' as const : 'ACTIVE' as const
      return {
        ...prev,
        agents: prev.agents.map(a =>
          a.id === agentId ? { ...a, status: newStatus } : a
        ),
        kpiSummary: {
          ...prev.kpiSummary,
          activeAgents: prev.kpiSummary.activeAgents + (newStatus === 'ACTIVE' ? 1 : -1),
        },
      }
    })

    try {
      await fetch(endpoint, { method: 'POST' })
    } catch {
      // 실패 시 원복
      fetchDashboard()
    }
  }, [data, fetchDashboard])

  const layers: AgentLayer[] = ['COMMAND', 'SOURCING', 'OPERATIONS', 'COMMERCE', 'INFRA']

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">에이전트 대시보드</h1>
            <p className="text-sm text-gray-500">11개 자율운영 에이전트 현황</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    )
  }

  const summary = data?.kpiSummary ?? defaultSummary
  const agents = data?.agents ?? SEED_AGENTS
  const alerts = data?.alerts ?? []

  const statusCounts = {
    active: agents.filter(a => a.status === 'ACTIVE').length,
    inactive: agents.filter(a => a.status === 'INACTIVE').length,
    error: agents.filter(a => a.status === 'ERROR').length,
    maintenance: agents.filter(a => a.status === 'MAINTENANCE').length,
  }

  const kpiCards = [
    {
      label: '활성 에이전트',
      value: `${statusCounts.active}/${agents.length}`,
      icon: Bot,
      color: 'text-green-600',
      bg: 'bg-green-50',
      detail: statusCounts.error > 0 ? `${statusCounts.error}개 오류` : '모두 정상',
      detailColor: statusCounts.error > 0 ? 'text-red-500' : 'text-green-500',
    },
    {
      label: '오늘 태스크',
      value: `${summary.todayTasks}`,
      icon: ListChecks,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      detail: '처리 완료',
      detailColor: 'text-blue-500',
    },
    {
      label: '평균 응답시간',
      value: summary.avgResponseTime,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      detail: 'latency',
      detailColor: 'text-purple-500',
    },
    {
      label: 'KPI 달성률',
      value: `${summary.kpiAchievement}%`,
      icon: TrendingUp,
      color: summary.kpiAchievement >= 80 ? 'text-green-600' : summary.kpiAchievement >= 50 ? 'text-yellow-600' : 'text-red-600',
      bg: summary.kpiAchievement >= 80 ? 'bg-green-50' : summary.kpiAchievement >= 50 ? 'bg-yellow-50' : 'bg-red-50',
      detail: summary.kpiAchievement >= 80 ? '목표 달성' : '개선 필요',
      detailColor: summary.kpiAchievement >= 80 ? 'text-green-500' : 'text-yellow-500',
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">에이전트 대시보드</h1>
            <p className="text-sm text-gray-500">11개 자율운영 에이전트 현황</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {lastRefresh.toLocaleTimeString('ko-KR')}
          </span>
          <button
            onClick={fetchDashboard}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert, i) => (
            <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 flex-1">
                <strong>{alert.agentName}</strong>: {alert.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Status Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <span className="text-sm text-gray-600">활성 <strong className="text-green-600">{statusCounts.active}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Pause size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">비활성 <strong className="text-gray-500">{statusCounts.inactive}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-red-500" />
            <span className="text-sm text-gray-600">오류 <strong className="text-red-600">{statusCounts.error}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-yellow-500" />
            <span className="text-sm text-gray-600">유지보수 <strong className="text-yellow-600">{statusCounts.maintenance}</strong></span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${statusCounts.active > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-xs text-gray-400">
              {statusCounts.active > 0 ? '시스템 가동 중' : '모든 에이전트 비활성'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className={`text-xs mt-1 ${card.detailColor}`}>{card.detail}</p>
            </div>
          )
        })}
      </div>

      {/* Layer Sections */}
      <div className="space-y-3">
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
