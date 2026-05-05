/**
 * Lite Coaching Panel — 가이드 카드 UI (E3)
 *
 * 대시보드 상단에 미응답 코칭 팁 표시.
 * 셀러는 메시지 읽고 CTA 버튼 클릭 → 다음 행동 페이지로 이동.
 * "확인" 버튼 → shown=true 로 마킹 (다시 안 보임).
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface CoachingTip {
  id: string
  ruleKey: string
  message: string
  ctaUrl: string | null
  createdAt: string
}

export default function CoachingPanel() {
  const [tips, setTips] = useState<CoachingTip[]>([])
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)

  const load = async () => {
    try {
      const res = await fetch('/api/lite/coaching', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setTips(data.data.tips || [])
    } catch {
      // ignore — 코칭은 보조 기능
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // 5분 주기 새로고침
    const interval = setInterval(load, 5 * 60_000)
    return () => clearInterval(interval)
  }, [])

  const dismiss = async (tipId: string) => {
    setTips((prev) => prev.filter((t) => t.id !== tipId))
    try {
      await fetch('/api/lite/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'dismiss', tipId }),
      })
    } catch {
      // 실패해도 UI 는 이미 사라짐 — 다음 새로고침에 다시 표시될 수 있음
    }
  }

  const triggerEvaluate = async () => {
    setEvaluating(true)
    try {
      await fetch('/api/lite/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'evaluate' }),
      })
      await load()
    } finally {
      setEvaluating(false)
    }
  }

  if (loading || tips.length === 0) {
    // 로딩 중이거나 팁 없으면 — 베타 단계엔 "수동 평가 트리거" 버튼만 살짝 노출
    return (
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={triggerEvaluate}
          disabled={evaluating}
          className="text-[10px] text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
          title="룰 엔진을 즉시 평가해 새 팁을 가져옵니다 (Phase 3 cron 으로 대체)"
        >
          {evaluating ? '평가 중...' : '🔄 코칭 가이드 새로고침'}
        </button>
      </div>
    )
  }

  return (
    <div className="mb-6 space-y-2">
      {tips.map((tip) => (
        <article
          key={tip.id}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3"
          role="status"
        >
          <div className="text-2xl shrink-0">💡</div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 leading-relaxed">{tip.message}</div>
            {tip.ctaUrl && (
              <Link
                href={tip.ctaUrl}
                onClick={() => dismiss(tip.id)}
                className="inline-block mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                지금 하기 →
              </Link>
            )}
          </div>
          <button
            onClick={() => dismiss(tip.id)}
            aria-label="dismiss"
            className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1 shrink-0"
            title="확인"
          >
            ×
          </button>
        </article>
      ))}
      <div className="flex items-center justify-end">
        <button
          onClick={triggerEvaluate}
          disabled={evaluating}
          className="text-[10px] text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
        >
          {evaluating ? '평가 중...' : '🔄 새로고침'}
        </button>
      </div>
    </div>
  )
}
