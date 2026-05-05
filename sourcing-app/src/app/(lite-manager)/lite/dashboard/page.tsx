/**
 * Lite Dashboard — 수익 대시보드 (F3) 실구현
 * D1 매출 카드 / D3 시간대별 / D4 TOP3 / D2 마진 통합
 */
'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import CoachingPanel from '../_components/CoachingPanel'

interface RevenueWindow {
  totalAmount: number
  orderCount: number
  avgOrder: number
  marginPct: number | null
  net: number | null
}

interface TopProduct {
  productId: number
  name: string
  qty: number
  revenue: number
}

interface Summary {
  revenue: {
    today: RevenueWindow
    thisWeek: RevenueWindow
    thisMonth: RevenueWindow
  }
  hourlyChart: { hour: number; revenue: number; orderCount: number }[]
  topProducts: TopProduct[]
  estimatedMargin: {
    gross: number
    fee: number
    net: number | null
    marginPct: number | null
  }
  message?: string
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('ko-KR')
}

export default function LiteDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch('/api/lite/dashboard/summary', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          if (data.success) {
            setSummary(data.data)
            setError(null)
          } else {
            setError(data.error || '조회 실패')
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err?.message || '네트워크 오류')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    load()
    // 1분 주기로 갱신 (서버 캐시 60초와 동기)
    const interval = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-600 mt-1">오늘 무엇을 팔았는지 한눈에 확인하세요</p>
      </header>

      {/* 코칭 가이드 카드 (E3) — 미응답 팁 표시 */}
      <CoachingPanel />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !summary && (
        <div className="text-center text-sm text-gray-500 py-12">대시보드를 불러오는 중...</div>
      )}

      {summary && (
        <>
          {summary.message && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-700">
              {summary.message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard
              label="오늘 매출"
              amount={summary.revenue.today.totalAmount}
              orderCount={summary.revenue.today.orderCount}
              marginPct={summary.revenue.today.marginPct}
              accent="blue"
            />
            <StatCard
              label="이번 주 매출"
              amount={summary.revenue.thisWeek.totalAmount}
              orderCount={summary.revenue.thisWeek.orderCount}
              marginPct={summary.revenue.thisWeek.marginPct}
              accent="purple"
            />
            <StatCard
              label="이번 달 매출"
              amount={summary.revenue.thisMonth.totalAmount}
              orderCount={summary.revenue.thisMonth.orderCount}
              marginPct={summary.revenue.thisMonth.marginPct}
              accent="green"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                📈 오늘 시간대별 판매
              </h2>
              {summary.revenue.today.orderCount === 0 ? (
                <div className="text-sm text-gray-500 py-12 text-center">
                  오늘 첫 판매를 기다리고 있어요
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={summary.hourlyChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(h) => `${h}시`}
                      tick={{ fontSize: 11 }}
                      stroke="#94a3b8"
                    />
                    <YAxis
                      tickFormatter={(v) => v >= 10000 ? `${Math.round(v / 1000)}k` : `${v}`}
                      tick={{ fontSize: 11 }}
                      stroke="#94a3b8"
                    />
                    <Tooltip
                      formatter={(v: any) => `₩${formatPrice(Number(v))}` as any}
                      labelFormatter={(h: any) => `${h}시 매출`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">🏆 이번 달 TOP 3</h2>
              {summary.topProducts.length === 0 ? (
                <div className="text-sm text-gray-500 py-8 text-center">
                  첫 판매 후 TOP3가 표시됩니다
                </div>
              ) : (
                <ol className="space-y-3">
                  {summary.topProducts.map((p, i) => (
                    <li key={p.productId} className="flex items-start gap-3">
                      <span
                        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0
                            ? 'bg-yellow-100 text-yellow-700'
                            : i === 1
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {p.qty}개 · ₩{formatPrice(p.revenue)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              💰 이번 달 추정 마진
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MarginCell label="총 매출" value={`₩${formatPrice(summary.revenue.thisMonth.totalAmount)}`} />
              <MarginCell
                label="결제 수수료 (3%)"
                value={`-₩${formatPrice(summary.estimatedMargin.fee)}`}
                tone="warn"
              />
              <MarginCell
                label="추정 순이익"
                value={summary.estimatedMargin.net != null ? `₩${formatPrice(summary.estimatedMargin.net)}` : '도매가 미입력'}
                tone={summary.estimatedMargin.net != null && summary.estimatedMargin.net > 0 ? 'good' : 'muted'}
              />
              <MarginCell
                label="마진율"
                value={summary.estimatedMargin.marginPct != null ? `${summary.estimatedMargin.marginPct}%` : '–'}
                tone={summary.estimatedMargin.marginPct != null && summary.estimatedMargin.marginPct >= 20 ? 'good' : 'muted'}
              />
            </div>
            <div className="mt-3 text-[11px] text-gray-500 leading-relaxed">
              ※ 마진은 (판매가 − 도매가 − 결제수수료) 추정. 정확한 배송비/부가세는 Pro 정산에서 확인됩니다.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  amount,
  orderCount,
  marginPct,
  accent,
}: {
  label: string
  amount: number
  orderCount: number
  marginPct: number | null
  accent: 'blue' | 'purple' | 'green'
}) {
  const accentClass =
    accent === 'blue' ? 'from-blue-50 to-blue-100/30 border-blue-200' : accent === 'purple' ? 'from-purple-50 to-purple-100/30 border-purple-200' : 'from-green-50 to-green-100/30 border-green-200'
  return (
    <div className={`rounded-lg border p-4 bg-gradient-to-br ${accentClass}`}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">₩{formatPrice(amount)}</div>
      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
        <span>주문 {orderCount}건</span>
        {marginPct != null && (
          <>
            <span>·</span>
            <span className={marginPct >= 20 ? 'text-green-700 font-medium' : 'text-gray-500'}>
              마진 {marginPct}%
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function MarginCell({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'good' | 'warn' | 'muted'
}) {
  const colorClass =
    tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-orange-700' : tone === 'muted' ? 'text-gray-400' : 'text-gray-900'
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`text-base font-semibold mt-0.5 ${colorClass}`}>{value}</div>
    </div>
  )
}
