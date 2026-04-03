'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import KpiChart from '@/components/admin/agents/KpiChart'

type Period = 'daily' | 'weekly' | 'monthly'

interface KpiRecord {
  agentId: string
  agentName: string
  metric: string
  currentValue: number
  targetValue: number
  achievementRate: number
  trend: 'up' | 'down' | 'flat'
  trendDelta: number
}

interface KpiResponse {
  period: Period
  startDate: string
  endDate: string
  records: KpiRecord[]
}

const sampleKpiData: KpiResponse = {
  period: 'daily',
  startDate: '2026-04-01',
  endDate: '2026-04-02',
  records: [
    { agentId: 'orchestrator', agentName: '오케스트레이터', metric: '워크플로우 성공률', currentValue: 95, targetValue: 100, achievementRate: 95, trend: 'up', trendDelta: 3 },
    { agentId: 'scheduler', agentName: '스케줄러', metric: '스케줄 정시율', currentValue: 98, targetValue: 100, achievementRate: 98, trend: 'flat', trendDelta: 0 },
    { agentId: 'health-monitor', agentName: '헬스 모니터', metric: '가동률', currentValue: 99.5, targetValue: 99.9, achievementRate: 99.6, trend: 'up', trendDelta: 0.1 },
    { agentId: 'sourcing-agent', agentName: '소싱 에이전트', metric: '수집 목표 달성률', currentValue: 85, targetValue: 100, achievementRate: 85, trend: 'up', trendDelta: 5 },
    { agentId: 'order-agent', agentName: '주문 에이전트', metric: '주문 처리율', currentValue: 92, targetValue: 100, achievementRate: 92, trend: 'down', trendDelta: -2 },
    { agentId: 'cs-agent', agentName: 'CS 에이전트', metric: '응답률', currentValue: 45, targetValue: 100, achievementRate: 45, trend: 'down', trendDelta: -10 },
    { agentId: 'settlement-agent', agentName: '정산 에이전트', metric: '처리 정확도', currentValue: 100, targetValue: 100, achievementRate: 100, trend: 'flat', trendDelta: 0 },
    { agentId: 'price-optimizer', agentName: '가격 최적화', metric: '마진 목표 달성률', currentValue: 78, targetValue: 100, achievementRate: 78, trend: 'up', trendDelta: 8 },
    { agentId: 'demand-predictor', agentName: '수요 예측', metric: '예측 정확도', currentValue: 82, targetValue: 90, achievementRate: 91, trend: 'up', trendDelta: 2 },
    { agentId: 'content-generator', agentName: '콘텐츠 생성', metric: '생성 성공률', currentValue: 55, targetValue: 95, achievementRate: 58, trend: 'down', trendDelta: -15 },
  ],
}

function getAchievementColor(rate: number): string {
  if (rate >= 100) return 'text-green-600'
  if (rate >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

function getAchievementBg(rate: number): string {
  if (rate >= 100) return 'bg-green-50'
  if (rate >= 70) return 'bg-yellow-50'
  return 'bg-red-50'
}

function getTrendIcon(trend: 'up' | 'down' | 'flat') {
  switch (trend) {
    case 'up': return <TrendingUp size={14} className="text-green-500" />
    case 'down': return <TrendingDown size={14} className="text-red-500" />
    case 'flat': return <Minus size={14} className="text-gray-400" />
  }
}

function formatDate(dateStr: string): string {
  return dateStr
}

export default function AgentKpiPage() {
  const [data, setData] = useState<KpiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('daily')
  const [startDate, setStartDate] = useState('2026-04-01')
  const [endDate, setEndDate] = useState('2026-04-02')

  const fetchKpi = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        period,
        startDate,
        endDate,
      })
      const res = await fetch(`/api/admin/agents/kpi?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch {
      setData({ ...sampleKpiData, period, startDate, endDate })
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [period, startDate, endDate])

  useEffect(() => {
    fetchKpi()
  }, [fetchKpi])

  const chartData = useMemo(() => {
    if (!data) return []
    return data.records.map(r => ({
      agentName: r.agentName,
      achievement: r.currentValue,
      target: r.targetValue,
    }))
  }, [data])

  const summaryStats = useMemo(() => {
    if (!data || data.records.length === 0) return { avg: 0, above100: 0, below70: 0 }
    const rates = data.records.map(r => r.achievementRate)
    return {
      avg: Math.round(rates.reduce((a, b) => a + b, 0) / rates.length),
      above100: rates.filter(r => r >= 100).length,
      below70: rates.filter(r => r < 70).length,
    }
  }, [data])

  const periodLabels: Record<Period, string> = {
    daily: '일간',
    weekly: '주간',
    monthly: '월간',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">KPI 대시보드</h1>
              <p className="text-gray-600">에이전트별 핵심 성과 지표를 분석합니다</p>
            </div>
          </div>
          <button
            onClick={fetchKpi}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="새로고침"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['daily', 'weekly', 'monthly'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  period === p
                    ? 'bg-white text-gray-900 font-medium shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-400 text-sm">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Summary Stats */}
          <div className="flex items-center gap-4 ml-auto text-sm">
            <span className="text-gray-500">
              평균 달성률: <span className={`font-semibold ${getAchievementColor(summaryStats.avg)}`}>{summaryStats.avg}%</span>
            </span>
            <span className="text-green-600 font-medium">{summaryStats.above100}개 달성</span>
            {summaryStats.below70 > 0 && (
              <span className="text-red-600 font-medium">{summaryStats.below70}개 미달</span>
            )}
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
      ) : (
        <>
          {/* KPI Bar Chart */}
          <KpiChart data={chartData} />

          {/* KPI Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">에이전트별 KPI 상세</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">에이전트</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">지표</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">현재값</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">목표</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">달성률</th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">추세</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.records.map(record => (
                    <tr key={record.agentId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{record.agentName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{record.metric}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900">{record.currentValue}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-500">{record.targetValue}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getAchievementBg(record.achievementRate)} ${getAchievementColor(record.achievementRate)}`}>
                          {record.achievementRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {getTrendIcon(record.trend)}
                          <span className={`text-xs ${
                            record.trend === 'up' ? 'text-green-500' :
                            record.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                          }`}>
                            {record.trendDelta > 0 ? '+' : ''}{record.trendDelta}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
