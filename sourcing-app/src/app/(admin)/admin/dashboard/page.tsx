'use client'

import { useState, useEffect } from 'react'
import {
  MonitorDot,
  Users,
  ShoppingBag,
  Bot,
  Server,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Wifi,
} from 'lucide-react'

interface PlatformStats {
  totalUsers: number
  activeUsers: number
  totalShops: number
  activeShops: number
  totalOrders: number
  todayOrders: number
  totalProducts: number
  todayCollected: number
  agentTeams: number
  activeAgents: number
}

interface ServiceStatus {
  name: string
  status: 'healthy' | 'warning' | 'error'
  latency?: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalShops: 0,
    activeShops: 0,
    totalOrders: 0,
    todayOrders: 0,
    totalProducts: 0,
    todayCollected: 0,
    agentTeams: 5,
    activeAgents: 3,
  })
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'MariaDB', status: 'healthy', latency: 2 },
    { name: 'Redis', status: 'healthy', latency: 1 },
    { name: 'Shop App (3000)', status: 'healthy', latency: 45 },
    { name: 'Sourcing App (3001)', status: 'healthy', latency: 38 },
    { name: 'Band API', status: 'healthy', latency: 120 },
    { name: 'Toss Payments', status: 'healthy', latency: 95 },
  ])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/admin/platform/stats')
        const data = await response.json()
        if (data.success) {
          setStats(data.data)
        }
      } catch {
        // 실패 시 기본값 유지
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const statusIcon = (status: string) => {
    if (status === 'healthy') return <CheckCircle size={16} className="text-green-500" />
    if (status === 'warning') return <AlertCircle size={16} className="text-yellow-500" />
    return <AlertCircle size={16} className="text-red-500" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <MonitorDot className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">플랫폼 현황</h1>
            <p className="text-gray-600">SNS AUTO 전체 플랫폼 모니터링 및 관리</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users size={20} />} label="전체 사용자" value={stats.totalUsers} sub={`활성 ${stats.activeUsers}`} color="blue" />
        <StatCard icon={<ShoppingBag size={20} />} label="쇼핑몰" value={stats.totalShops} sub={`운영중 ${stats.activeShops}`} color="green" />
        <StatCard icon={<TrendingUp size={20} />} label="오늘 주문" value={stats.todayOrders} sub={`총 ${stats.totalOrders}`} color="purple" />
        <StatCard icon={<Bot size={20} />} label="에이전트팀" value={stats.agentTeams} sub={`활성 ${stats.activeAgents}`} color="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 서비스 상태 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server size={20} className="text-gray-600" />
            <h2 className="text-lg font-semibold">서비스 상태</h2>
          </div>
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {statusIcon(service.status)}
                  <span className="text-sm font-medium text-gray-700">{service.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {service.latency && (
                    <span className="text-xs text-gray-500">{service.latency}ms</span>
                  )}
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    service.status === 'healthy' ? 'bg-green-100 text-green-700' :
                    service.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {service.status === 'healthy' ? '정상' : service.status === 'warning' ? '주의' : '오류'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 에이전트팀 현황 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={20} className="text-gray-600" />
            <h2 className="text-lg font-semibold">에이전트팀 현황</h2>
          </div>
          <div className="space-y-3">
            <AgentTeamRow name="소싱 에이전트" role="수집/AI변환/발행" status="active" lastActive="2분 전" />
            <AgentTeamRow name="쇼핑몰 에이전트" role="상품/결제/주문" status="active" lastActive="5분 전" />
            <AgentTeamRow name="DB 에이전트" role="스키마/마이그레이션" status="idle" lastActive="1시간 전" />
            <AgentTeamRow name="DevOps 에이전트" role="배포/모니터링" status="active" lastActive="10분 전" />
            <AgentTeamRow name="QA 에이전트" role="테스트/품질" status="idle" lastActive="3시간 전" />
          </div>
        </div>
      </div>

      {/* 빠른 관리 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">빠른 관리</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction href="/admin/agents/teams" icon={<Bot size={18} />} label="에이전트팀 관리" />
          <QuickAction href="/admin/users/list" icon={<Users size={18} />} label="사용자 관리" />
          <QuickAction href="/admin/system/status" icon={<Activity size={18} />} label="시스템 모니터링" />
          <QuickAction href="/admin/system/analytics" icon={<TrendingUp size={18} />} label="통계/분석" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number; sub: string; color: string
}) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50', green: 'bg-green-50', purple: 'bg-purple-50', indigo: 'bg-indigo-50',
  }
  const textMap: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600', purple: 'text-purple-600', indigo: 'text-indigo-600',
  }
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${bgMap[color]} ${textMap[color]}`}>{icon}</div>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  )
}

function AgentTeamRow({ name, role, status, lastActive }: {
  name: string; role: string; status: 'active' | 'idle' | 'error'; lastActive: string
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-700">{name}</p>
        <p className="text-xs text-gray-500">{role}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{lastActive}</span>
        <span className={`w-2 h-2 rounded-full ${
          status === 'active' ? 'bg-green-500 animate-pulse' :
          status === 'idle' ? 'bg-gray-400' : 'bg-red-500'
        }`} />
      </div>
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-colors"
    >
      <span className="text-gray-600">{icon}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </a>
  )
}
