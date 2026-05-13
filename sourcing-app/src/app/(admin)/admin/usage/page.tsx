/**
 * 어드민 — 사용량/비용 대시보드
 *
 * 매니저별 월간 AI 호출/수집/발행/API 호출 + 한도 vs 실사용.
 * 매니저 선택 시 일별 추이 차트 표시 (recharts).
 */
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { BarChart3, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'

interface UsageRow {
  id: number
  email: string
  name: string | null
  companyName: string | null
  planSlug: string | null
  planName: string | null
  subscriptionStatus: string | null
  usage: {
    aiCalls: number
    collections: number
    publishes: number
    apiCalls: number
  }
  limits: { aiCallsPerMonth: number | null }
  overLimit: boolean
}

interface DailyRow {
  date: string
  aiCalls: number
  collections: number
  publishes: number
  apiCalls: number
}

// Claude/Gemini 1k 토큰당 단가 추정 — AI 호출 1회 ≒ 2k 토큰 가정 (대략적)
const EST_COST_PER_AI_CALL_KRW = 8 // 약 0.005 USD * 1,400원 * 1.1 — 대략

function defaultMonth(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function AdminUsagePage() {
  const [month, setMonth] = useState<string>(defaultMonth())
  const [managers, setManagers] = useState<UsageRow[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/admin/usage', window.location.origin)
      url.searchParams.set('month', month)
      const res = await fetch(url.toString(), { credentials: 'include' }).then((r) => r.json())
      if (!res.success) throw new Error(res.error || '조회 실패')
      setManagers(res.data?.managers || [])
    } catch (e: any) {
      setError(e?.message || '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [month])

  const loadDaily = useCallback(async () => {
    if (!selected) {
      setDaily([])
      return
    }
    try {
      const url = new URL('/api/admin/usage', window.location.origin)
      url.searchParams.set('month', month)
      url.searchParams.set('managerId', String(selected))
      const res = await fetch(url.toString(), { credentials: 'include' }).then((r) => r.json())
      if (res.success) setDaily(res.data?.daily || [])
    } catch {
      /* noop */
    }
  }, [selected, month])

  useEffect(() => {
    loadList()
  }, [loadList])
  useEffect(() => {
    loadDaily()
  }, [loadDaily])

  const totals = useMemo(() => {
    return managers.reduce(
      (acc, m) => {
        acc.aiCalls += m.usage.aiCalls
        acc.collections += m.usage.collections
        acc.publishes += m.usage.publishes
        acc.apiCalls += m.usage.apiCalls
        if (m.overLimit) acc.overLimitCount += 1
        return acc
      },
      { aiCalls: 0, collections: 0, publishes: 0, apiCalls: 0, overLimitCount: 0 }
    )
  }, [managers])

  const estCostKRW = totals.aiCalls * EST_COST_PER_AI_CALL_KRW

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            사용량 모니터링
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            매니저별 AI 호출/수집/발행/API 호출 사용량과 요금제 한도 초과 여부를 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button
            onClick={loadList}
            disabled={loading}
            className="px-3 py-2 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Top summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <SummaryCard label="AI 호출" value={totals.aiCalls} suffix="회" />
        <SummaryCard label="수집" value={totals.collections} suffix="건" />
        <SummaryCard label="발행" value={totals.publishes} suffix="건" />
        <SummaryCard label="API 호출" value={totals.apiCalls} suffix="회" />
        <SummaryCard
          label="추정 AI 비용"
          value={Math.round(estCostKRW)}
          suffix="원"
          variant="primary"
        />
      </div>

      {totals.overLimitCount > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          한도 초과 매니저: {totals.overLimitCount} 명
        </div>
      )}

      {/* Daily chart */}
      {selected && daily.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              일별 사용량 추이 (매니저 #{selected})
            </h2>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-500 hover:underline">
              선택 해제
            </button>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="aiCalls" stroke="#6366f1" name="AI" dot={false} />
                <Line type="monotone" dataKey="collections" stroke="#10b981" name="수집" dot={false} />
                <Line type="monotone" dataKey="publishes" stroke="#f59e0b" name="발행" dot={false} />
                <Line type="monotone" dataKey="apiCalls" stroke="#ef4444" name="API" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">매니저</th>
              <th className="px-4 py-3 text-left">플랜</th>
              <th className="px-4 py-3 text-right">AI 호출</th>
              <th className="px-4 py-3 text-right">한도</th>
              <th className="px-4 py-3 text-right">수집</th>
              <th className="px-4 py-3 text-right">발행</th>
              <th className="px-4 py-3 text-right">API</th>
              <th className="px-4 py-3 text-center">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            )}
            {!loading && managers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  매니저가 없습니다.
                </td>
              </tr>
            )}
            {!loading &&
              managers.map((m) => {
                const quota = m.limits.aiCallsPerMonth
                const pct = quota && quota > 0 ? Math.min(100, Math.round((m.usage.aiCalls / quota) * 100)) : null
                const isSelected = selected === m.id
                return (
                  <tr
                    key={m.id}
                    onClick={() => setSelected(isSelected ? null : m.id)}
                    className={`cursor-pointer ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'} ${
                      m.overLimit ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{m.name || m.email}</div>
                      <div className="text-xs text-gray-500">{m.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{m.planName ?? '(없음)'}</td>
                    <td className="px-4 py-3 text-right font-medium">{m.usage.aiCalls.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs">
                      {quota === null ? (
                        <span className="text-gray-400">무제한</span>
                      ) : (
                        <div>
                          <div>{quota.toLocaleString()}</div>
                          {pct !== null && (
                            <div className="h-1 w-16 bg-gray-200 rounded-full mt-1 inline-block">
                              <div
                                className={`h-full rounded-full ${
                                  m.overLimit ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{m.usage.collections.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{m.usage.publishes.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{m.usage.apiCalls.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      {m.overLimit ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">초과</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">정상</span>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  suffix,
  variant,
}: {
  label: string
  value: number
  suffix?: string
  variant?: 'primary'
}) {
  return (
    <div
      className={`rounded-lg p-4 border ${
        variant === 'primary' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'
      }`}
    >
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">
        {value.toLocaleString()}
        {suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
      </div>
    </div>
  )
}
