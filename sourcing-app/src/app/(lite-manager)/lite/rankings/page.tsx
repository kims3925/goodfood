/**
 * Lite Rankings — 랭킹 보드 (D5)
 * - 익명화된 매출 순위 (Lite 셀러 비교)
 * - 본인 위치 강조 + 상위 N% 백분위
 */
'use client'

import { useEffect, useState } from 'react'

interface RankRow {
  rank: number
  nickname: string
  revenue: number
  orders: number
  isMe: boolean
}

interface Rankings {
  period: 'today' | 'week' | 'month'
  total: number
  top10: RankRow[]
  nearMe: RankRow[]
  my: { rank: number | null; percentile: number | null; revenue: number; orders: number }
}

const PERIODS: { value: Rankings['period']; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
]

function formatPrice(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

export default function LiteRankingsPage() {
  const [period, setPeriod] = useState<Rankings['period']>('today')
  const [data, setData] = useState<Rankings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/lite/rankings?period=${period}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return
        if (res.success) setData(res.data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [period])

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">랭킹</h1>
        <p className="text-sm text-gray-600 mt-1">
          다른 셀러들과 매출을 비교해보세요. 닉네임은 익명화 — 누구도 당신의 정체를 모릅니다.
        </p>
      </header>

      <div className="mb-4 flex items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              period === p.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && !data && (
        <div className="text-center text-sm text-gray-500 py-12">랭킹 집계 중...</div>
      )}

      {data && (
        <>
          {/* 내 위치 강조 카드 */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-5 mb-6">
            <div className="text-sm opacity-90">내 위치</div>
            {data.my.rank ? (
              <>
                <div className="text-3xl font-bold mt-1">
                  {data.my.rank}위 / {data.total}명
                </div>
                <div className="text-xs opacity-80 mt-1">
                  ₩{formatPrice(data.my.revenue)} · 주문 {data.my.orders}건
                  {data.my.percentile != null && data.my.percentile <= 10 && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded-full text-[10px] font-bold">
                      🏆 상위 {data.my.percentile}%
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold mt-1">아직 순위 없음</div>
                <div className="text-xs opacity-80 mt-1">
                  첫 판매가 발생하면 즉시 랭킹에 진입합니다
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">🏆 TOP 10</h2>
            </div>
            {data.top10.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-500">
                아직 이 기간 매출 발생 셀러가 없습니다
              </div>
            ) : (
              <ul>
                {data.top10.map((r) => (
                  <RankItem key={r.rank} row={r} />
                ))}
              </ul>
            )}
          </div>

          {data.nearMe.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-900">📍 내 주변 순위</h2>
              </div>
              <ul>
                {data.nearMe.map((r) => (
                  <RankItem key={r.rank} row={r} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <div className="text-sm font-semibold text-blue-900">💡 랭킹의 의미</div>
        <div className="text-xs text-blue-700 mt-1 leading-relaxed">
          상위 10% 안에 들면 자동화 (Pro) 의 가치가 극대화됩니다 — 자동화는 매출이 일정 이상일 때
          시간당 효율이 진짜 승부처가 되거든요. 지금 위치에서 충분히 학습한 후 Pro 로 확장해보세요.
        </div>
      </div>
    </div>
  )
}

function RankItem({ row }: { row: RankRow }) {
  const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null
  return (
    <li
      className={`px-5 py-3 flex items-center gap-3 border-b border-gray-100 last:border-b-0 ${
        row.isMe ? 'bg-purple-50' : 'hover:bg-gray-50'
      }`}
    >
      <div
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
          row.rank === 1
            ? 'bg-yellow-100 text-yellow-700'
            : row.rank === 2
              ? 'bg-gray-100 text-gray-700'
              : row.rank === 3
                ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-50 text-blue-700'
        }`}
      >
        {medal || `#${row.rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">
          {row.isMe ? '🌟 나' : row.nickname}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">주문 {row.orders}건</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-gray-900">₩{formatPrice(row.revenue)}</div>
      </div>
    </li>
  )
}
