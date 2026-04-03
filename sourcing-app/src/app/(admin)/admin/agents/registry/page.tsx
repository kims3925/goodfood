'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BookOpen,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  Bot,
} from 'lucide-react'
import AgentCard, { type Agent } from '@/components/admin/agents/AgentCard'

type AgentLayer = 'CORE' | 'BUSINESS' | 'INTELLIGENCE'
type LayerFilter = 'ALL' | AgentLayer

const LAYER_TABS: { value: LayerFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'CORE', label: 'Core' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'INTELLIGENCE', label: 'Intelligence' },
]

const sampleAgents: Agent[] = [
  {
    id: 'orchestrator',
    name: 'orchestrator',
    displayName: '오케스트레이터',
    layer: 'CORE',
    icon: 'Workflow',
    status: 'ACTIVE',
    description: '에이전트 간 작업 조율 및 워크플로우 실행을 관리합니다.',
    config: { kpiTargets: [{ label: '워크플로우 성공률', current: 95, target: 100 }] },
  },
  {
    id: 'scheduler',
    name: 'scheduler',
    displayName: '스케줄러',
    layer: 'CORE',
    icon: 'Clock',
    status: 'ACTIVE',
    description: '크론 기반 작업 스케줄링 및 큐 관리를 담당합니다.',
    config: { kpiTargets: [{ label: '스케줄 정시율', current: 98, target: 100 }] },
  },
  {
    id: 'health-monitor',
    name: 'health-monitor',
    displayName: '헬스 모니터',
    layer: 'CORE',
    icon: 'HeartPulse',
    status: 'ACTIVE',
    description: '전체 시스템 상태 모니터링 및 장애 알림을 처리합니다.',
    config: {},
  },
  {
    id: 'event-bus',
    name: 'event-bus',
    displayName: '이벤트 버스',
    layer: 'CORE',
    icon: 'Radio',
    status: 'ACTIVE',
    description: '에이전트 간 이벤트 발행 및 구독을 관리합니다.',
    config: {},
  },
  {
    id: 'sourcing-agent',
    name: 'sourcing-agent',
    displayName: '소싱 에이전트',
    layer: 'BUSINESS',
    icon: 'Package',
    status: 'ACTIVE',
    description: '도매밴드 상품 수집, AI 가공, 소매밴드 발행 파이프라인을 자동화합니다.',
    config: { kpiTargets: [{ label: '수집 목표 달성률', current: 85, target: 100 }] },
  },
  {
    id: 'order-agent',
    name: 'order-agent',
    displayName: '주문 에이전트',
    layer: 'BUSINESS',
    icon: 'ShoppingCart',
    status: 'ACTIVE',
    description: '주문 접수, 상태 변경, 배송 추적 연동을 담당합니다.',
    config: { kpiTargets: [{ label: '주문 처리율', current: 92, target: 100 }] },
  },
  {
    id: 'cs-agent',
    name: 'cs-agent',
    displayName: 'CS 에이전트',
    layer: 'BUSINESS',
    icon: 'MessageSquare',
    status: 'INACTIVE',
    description: '고객 문의를 자동 분류하고 템플릿 기반 응답을 생성합니다.',
    config: {},
  },
  {
    id: 'settlement-agent',
    name: 'settlement-agent',
    displayName: '정산 에이전트',
    layer: 'BUSINESS',
    icon: 'Calculator',
    status: 'ACTIVE',
    description: '판매자 정산 데이터 집계 및 자동 처리를 수행합니다.',
    config: {},
  },
  {
    id: 'price-optimizer',
    name: 'price-optimizer',
    displayName: '가격 최적화',
    layer: 'INTELLIGENCE',
    icon: 'TrendingUp',
    status: 'ACTIVE',
    description: '경쟁사 가격 분석을 기반으로 최적 가격을 자동 설정합니다.',
    config: { kpiTargets: [{ label: '마진 목표 달성률', current: 78, target: 100 }] },
  },
  {
    id: 'demand-predictor',
    name: 'demand-predictor',
    displayName: '수요 예측',
    layer: 'INTELLIGENCE',
    icon: 'BarChart3',
    status: 'ACTIVE',
    description: 'AI 기반 수요 예측 모델로 재고 수준을 권장합니다.',
    config: { kpiTargets: [{ label: '예측 정확도', current: 82, target: 90 }] },
  },
  {
    id: 'content-generator',
    name: 'content-generator',
    displayName: '콘텐츠 생성',
    layer: 'INTELLIGENCE',
    icon: 'Sparkles',
    status: 'ERROR',
    description: 'Gemini AI로 상품 설명, 제목, 태그를 자동 생성합니다.',
    config: {},
  },
  {
    id: 'trend-analyzer',
    name: 'trend-analyzer',
    displayName: '트렌드 분석',
    layer: 'INTELLIGENCE',
    icon: 'TrendingUp',
    status: 'INACTIVE',
    description: 'SNS 트렌드를 분석하여 인기 상품 카테고리를 추천합니다.',
    config: {},
  },
]

export default function AgentRegistryPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchAgents = useCallback(async (layer?: AgentLayer) => {
    try {
      setLoading(true)
      const params = layer ? `?layer=${layer}` : ''
      const res = await fetch(`/api/admin/agents${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setAgents(json)
      setError(null)
    } catch {
      setAgents(sampleAgents)
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const layer = layerFilter === 'ALL' ? undefined : layerFilter
    fetchAgents(layer)
  }, [fetchAgents, layerFilter])

  const handleToggle = useCallback(async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId)
    if (!agent) return

    setTogglingId(agentId)
    const endpoint = agent.status === 'ACTIVE'
      ? `/api/admin/agents/${agentId}/stop`
      : `/api/admin/agents/${agentId}/start`

    try {
      await fetch(endpoint, { method: 'POST' })
    } catch {
      // Continue with optimistic update
    }

    setAgents(prev => prev.map(a =>
      a.id === agentId
        ? { ...a, status: a.status === 'ACTIVE' ? 'INACTIVE' as const : 'ACTIVE' as const }
        : a
    ))
    setTogglingId(null)
  }, [agents])

  const filteredAgents = useMemo(() => {
    let result = agents
    if (layerFilter !== 'ALL') {
      result = result.filter(a => a.layer === layerFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(a =>
        a.displayName.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      )
    }
    return result
  }, [agents, layerFilter, searchQuery])

  const layerCounts = useMemo(() => {
    const counts: Record<LayerFilter, number> = { ALL: agents.length, CORE: 0, BUSINESS: 0, INTELLIGENCE: 0 }
    agents.forEach(a => { counts[a.layer]++ })
    return counts
  }, [agents])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">에이전트 레지스트리</h1>
              <p className="text-gray-600">등록된 에이전트를 조회하고 상태를 관리합니다</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {agents.filter(a => a.status === 'ACTIVE').length}/{agents.length} 활성
            </span>
            <button
              onClick={() => fetchAgents(layerFilter === 'ALL' ? undefined : layerFilter)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Layer Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {LAYER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setLayerFilter(tab.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  layerFilter === tab.value
                    ? 'bg-white text-gray-900 font-medium shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs text-gray-400">
                  {layerCounts[tab.value]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="에이전트 이름으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {searchQuery ? '검색 결과가 없습니다' : '등록된 에이전트가 없습니다'}
          </p>
        </div>
      ) : (
        /* Agent Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
