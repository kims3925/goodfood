/**
 * Lite Upgrade — Pro 전환 업셀 페이지 (F5)
 * - 자격 트리거 표시 (체크리스트)
 * - Lite vs Pro 비교 매트릭스
 * - 7일 무료 체험 활성화 버튼
 */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UpgradeStatus {
  userMode: 'lite' | 'pro'
  liteStartAt: string | null
  proStartAt: string | null
  eligible: boolean
  triggers: Record<string, { label: string; met: boolean; value: string }>
  stats: {
    totalRevenue: number
    totalOrders: number
    completedMissions: number
    totalMissions: number
  }
}

const COMPARISON: { feature: string; lite: string; pro: string }[] = [
  { feature: '상품 업로드', lite: '직접 5~10개 선택', pro: '자동 풀 업로드 + AI 추천' },
  { feature: '발주', lite: '버튼 클릭 (텍스트 복사)', pro: '도매처 자동 fan-out' },
  { feature: '카톡/밴드 공유', lite: '텍스트 복사 → 직접 붙여넣기', pro: '카톡 채널 + 밴드 자동 게시' },
  { feature: '광고 카피', lite: '직접 작성 + 가이드', pro: 'AI 자동 생성' },
  { feature: '대시보드', lite: '오늘/주/월 요약', pro: '전체 분석 + 코호트 + 예측' },
  { feature: '주문 처리', lite: '읽기 + 발주 트리거', pro: '자동 결제 확인 + 자동 취소' },
  { feature: '고객 응대', lite: '직접 답변', pro: 'AI 자동 분류 + 답변 추천' },
  { feature: '소매 밴드', lite: '없음', pro: '소매 밴드 1+ 운영' },
  { feature: '자동화 에이전트', lite: '없음', pro: '11종 (수집/발행/주문/배송/정산/분석)' },
]

function formatPrice(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

export default function LiteUpgradePage() {
  const router = useRouter()
  const [status, setStatus] = useState<UpgradeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/lite/upgrade/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStatus(data.data)
        else setError(data.error || '조회 실패')
      })
      .catch((err) => setError(err?.message || '네트워크 오류'))
      .finally(() => setLoading(false))
  }, [])

  const activate = async () => {
    setActivating(true)
    setError(null)
    try {
      const res = await fetch('/api/lite/upgrade/activate', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        // Pro 패널로 이동
        const redirect = data.data?.redirectTo || '/sourcing/dashboard'
        window.location.href = redirect
      } else {
        setError(data.error || '활성화 실패')
      }
    } catch (err: any) {
      setError(err?.message || '네트워크 오류')
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return <div className="text-center text-sm text-gray-500 py-12">불러오는 중...</div>
  }

  if (!status) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error || '불러오기 실패'}
      </div>
    )
  }

  const isAlreadyPro = status.userMode === 'pro'

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">⚡ Pro 전환</h1>
        <p className="text-sm text-gray-600 mt-1">
          {isAlreadyPro
            ? 'Pro 매니저 패널에서 자동화를 활용해보세요.'
            : '체험 셀러에서 Pro 매니저로 — 자동화의 영역을 확장하세요'}
        </p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {isAlreadyPro && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-5 mb-6">
          <div className="text-sm font-semibold text-purple-900">✅ 이미 Pro 사용 중</div>
          <div className="text-xs text-purple-700 mt-1">
            Pro 시작일: {status.proStartAt ? new Date(status.proStartAt).toLocaleDateString('ko-KR') : '-'}
          </div>
          <Link
            href="/sourcing/dashboard"
            className="inline-block mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
          >
            Pro 매니저 패널로 →
          </Link>
        </div>
      )}

      {!isAlreadyPro && (
        <>
          <div
            className={`rounded-lg p-5 mb-6 border-2 ${
              status.eligible
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-transparent'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            {status.eligible ? (
              <>
                <div className="text-sm opacity-90">🎉 Pro 7일 무료 체험 자격 확보!</div>
                <div className="text-2xl font-bold mt-2">지금 바로 시작하세요</div>
                <div className="text-xs opacity-75 mt-1">7일 후 자동 종료. 결제 정보 입력 없음.</div>
                <button
                  onClick={activate}
                  disabled={activating}
                  className="mt-4 px-6 py-2 bg-white text-purple-700 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  {activating ? '활성화 중...' : '🚀 Pro 7일 무료 체험 시작'}
                </button>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-gray-900">
                  Pro 체험 자격까지 한 걸음 더!
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  아래 4가지 트리거 중 하나만 충족하면 Pro 7일 체험이 가능합니다.
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {Object.entries(status.triggers).map(([key, t]) => (
              <div
                key={key}
                className={`rounded-lg p-4 border ${
                  t.met ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      t.met ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {t.met ? '✓' : '·'}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{t.label}</span>
                </div>
                <div className={`text-xs mt-1 ml-7 ${t.met ? 'text-green-700' : 'text-gray-500'}`}>
                  {t.value}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Lite vs Pro 비교</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-xs">
              <th className="text-left px-5 py-2 font-semibold text-gray-700">기능</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Lite (체험)</th>
              <th className="text-left px-3 py-2 font-semibold text-purple-700">⚡ Pro</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row, idx) => (
              <tr
                key={row.feature}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
              >
                <td className="px-5 py-2.5 font-medium text-gray-900 text-xs">{row.feature}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600">{row.lite}</td>
                <td className="px-3 py-2.5 text-xs text-purple-700 font-medium">{row.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="text-sm font-semibold text-blue-900">💡 Lite 의 의미</div>
          <div className="text-xs text-blue-700 mt-1 leading-relaxed">
            손으로 클릭하며 판매 구조를 학습. 첫 1주는 가능한 한 천천히, 직접.
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
          <div className="text-sm font-semibold text-purple-900">⚡ Pro 의 의미</div>
          <div className="text-xs text-purple-700 mt-1 leading-relaxed">
            반복 작업 자동화. 셀러는 전략·확장에 집중. 시간이 곧 돈.
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
          <div className="text-sm font-semibold text-yellow-900">📦 데이터 호환</div>
          <div className="text-xs text-yellow-700 mt-1 leading-relaxed">
            Lite 에서 만든 모든 상품·주문은 Pro 에서 그대로 사용. 다시 입력할 필요 없어요.
          </div>
        </div>
      </div>
    </div>
  )
}
