'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  Activity,
  ShoppingBag,
  Users,
  Server,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Loader2,
  Zap,
  Package,
  CreditCard,
  Clock,
} from 'lucide-react'

interface PlatformStats {
  agents: { total: number; active: number; error: number }
  tasks: { today: number; completed: number; failed: number }
  orders: { today: number; pending: number; revenue: number }
  users: { total: number; activeToday: number }
  system: { uptime: string; dbStatus: string; redisStatus: string }
}

const defaultStats: PlatformStats = {
  agents: { total: 17, active: 0, error: 0 },
  tasks: { today: 0, completed: 0, failed: 0 },
  orders: { today: 0, pending: 0, revenue: 0 },
  users: { total: 0, activeToday: 0 },
  system: { uptime: '-', dbStatus: 'unknown', redisStatus: 'unknown' },
}

export default function AdminOverviewPage() {
  const router = useRouter()
  const [stats, setStats] = useState<PlatformStats>(defaultStats)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchStats = useCallback(async () => {
    try {
      const [dashRes, healthRes] = await Promise.allSettled([
        fetch('/api/admin/agents/dashboard'),
        fetch('/api/health'),
      ])

      const newStats = { ...defaultStats }

      if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
        const dash = await dashRes.value.json()
        if (dash.overview) {
          newStats.agents = {
            total: dash.overview.totalAgents || 17,
            active: dash.overview.activeAgents || 0,
            error: dash.overview.errorAgents || 0,
          }
          newStats.tasks = {
            today: dash.overview.tasksToday || 0,
            completed: dash.overview.tasksCompleted || 0,
            failed: dash.overview.tasksFailed || 0,
          }
        }
      }

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const health = await healthRes.value.json()
        newStats.system = {
          uptime: health.uptime || '-',
          dbStatus: health.db || 'connected',
          redisStatus: health.redis || 'connected',
        }
      }

      setStats(newStats)
    } catch {
      // 기본값 유지
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const timer = setInterval(fetchStats, 60_000)
    return () => clearInterval(timer)
  }, [fetchStats])

  const quickLinks = [
    {
      label: '에이전트 대시보드',
      description: '17개 에이전트 현황 및 관리',
      href: '/admin/agents/dashboard',
      icon: Bot,
      color: 'bg-indigo-500',
    },
    {
      label: '실시간 모니터링',
      description: '이벤트 스트림 및 상태 확인',
      href: '/admin/agents/monitor',
      icon: Activity,
      color: 'bg-green-500',
    },
    {
      label: 'KPI 대시보드',
      description: '에이전트 성과 분석',
      href: '/admin/agents/kpi',
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
    {
      label: '사용자 관리',
      description: '사용자 목록 및 권한 관리',
      href: '/admin/users/list',
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      label: '시스템 상태',
      description: '서비스 헬스체크 및 리소스',
      href: '/admin/system/status',
      icon: Server,
      color: 'bg-gray-600',
    },
    {
      label: '워크플로우',
      description: '이벤트 기반 자동화 관리',
      href: '/admin/agents/workflows',
      icon: Zap,
      color: 'bg-yellow-500',
    },
  ]

  const overviewCards = [
    {
      label: '에이전트',
      value: `${stats.agents.active}/${stats.agents.total}`,
      sub: stats.agents.error > 0 ? `${stats.agents.error}개 오류` : '정상 가동',
      icon: Bot,
      color: stats.agents.error > 0 ? 'text-red-600' : 'text-green-600',
      bg: stats.agents.error > 0 ? 'bg-red-50' : 'bg-green-50',
    },
    {
      label: '오늘 태스크',
      value: `${stats.tasks.today}`,
      sub: `완료 ${stats.tasks.completed} / 실패 ${stats.tasks.failed}`,
      icon: Zap,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '주문',
      value: `${stats.orders.today}`,
      sub: `대기 ${stats.orders.pending}건`,
      icon: ShoppingBag,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: '시스템',
      value: stats.system.dbStatus === 'connected' ? '정상' : '점검필요',
      sub: `DB: ${stats.system.dbStatus === 'connected' ? '연결됨' : '끊김'}`,
      icon: Server,
      color: stats.system.dbStatus === 'connected' ? 'text-green-600' : 'text-red-600',
      bg: stats.system.dbStatus === 'connected' ? 'bg-green-50' : 'bg-red-50',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">플랫폼 현황</h1>
          <p className="text-sm text-gray-500 mt-1">BandAuto 전체 시스템 상태를 한눈에 확인합니다</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {lastRefresh.toLocaleTimeString('ko-KR')}
          </span>
          <button
            onClick={fetchStats}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewCards.map(card => {
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
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Alerts */}
      {stats.agents.error > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">
              {stats.agents.error}개 에이전트에서 오류가 발생했습니다
            </p>
            <p className="text-xs text-red-600 mt-0.5">에이전트 대시보드에서 확인하세요</p>
          </div>
          <button
            onClick={() => router.push('/admin/agents/dashboard')}
            className="ml-auto px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 transition-colors"
          >
            확인하기
          </button>
        </div>
      )}

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">빠른 이동</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map(link => {
            const Icon = link.icon
            return (
              <button
                key={link.label}
                onClick={() => router.push(link.href)}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-lg ${link.color} flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{link.label}</h3>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{link.description}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Layer Summary */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">에이전트 레이어 현황</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { layer: 'CORE', label: '코어 레이어', count: 8, color: 'border-blue-200 bg-blue-50', textColor: 'text-blue-700', desc: '인프라 및 시스템 운영' },
            { layer: 'BUSINESS', label: '비즈니스 레이어', count: 4, color: 'border-green-200 bg-green-50', textColor: 'text-green-700', desc: '상거래 및 비즈니스 운영' },
            { layer: 'INTELLIGENCE', label: '인텔리전스 레이어', count: 5, color: 'border-purple-200 bg-purple-50', textColor: 'text-purple-700', desc: 'AI 분석 및 최적화' },
          ].map(layer => (
            <div key={layer.layer} className={`rounded-xl border-2 p-5 ${layer.color}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-semibold ${layer.textColor}`}>{layer.label}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${layer.color} ${layer.textColor} font-medium`}>
                  {layer.count}개
                </span>
              </div>
              <p className="text-xs text-gray-500">{layer.desc}</p>
              <button
                onClick={() => router.push('/admin/agents/registry')}
                className={`mt-3 text-xs ${layer.textColor} hover:underline flex items-center gap-1`}
              >
                상세보기 <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
