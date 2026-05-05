/**
 * Lite Missions — 게이미피케이션 (G3, F1+F2) 실구현
 * - 5종 미션 진행도 표시 (진행바 + 완료 배지)
 * - Pro 7일 체험권 unlock 시 별도 강조 + 업그레이드 CTA
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface MissionStatus {
  code: string
  title: string
  description: string
  emoji: string
  rewardType: 'badge' | 'pro_trial'
  rewardValue: string
  targetValue: number
  progress: number
  completed: boolean
  completedAt: string | null
  sortOrder: number
}

interface Summary {
  completed: number
  total: number
  proUnlocked: boolean
}

function formatProgress(code: string, progress: number, target: number): string {
  // 매출 미션은 천 단위 콤마
  if (code === '10man_revenue') {
    return `₩${progress.toLocaleString('ko-KR')} / ₩${target.toLocaleString('ko-KR')}`
  }
  return `${progress} / ${target}`
}

export default function LiteMissionsPage() {
  const [missions, setMissions] = useState<MissionStatus[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reevaluating, setReevaluating] = useState(false)

  const load = async () => {
    try {
      const res = await fetch('/api/lite/missions', { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setMissions(data.data.missions || [])
        setSummary(data.data.summary)
        setError(null)
      } else {
        setError(data.error || '조회 실패')
      }
    } catch (err: any) {
      setError(err?.message || '네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const evaluateNow = async () => {
    setReevaluating(true)
    try {
      await fetch('/api/lite/missions', { method: 'POST', credentials: 'include' })
      await load()
    } finally {
      setReevaluating(false)
    }
  }

  const proMission = missions.find((m) => m.code === 'pro_unlock')
  const baseMissions = missions.filter((m) => m.code !== 'pro_unlock')

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">미션</h1>
          <p className="text-sm text-gray-600 mt-1">
            미션을 달성하며 판매 감각을 키우고, Pro 체험권까지 받아보세요
          </p>
        </div>
        <button
          onClick={evaluateNow}
          disabled={reevaluating}
          className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          {reevaluating ? '평가 중...' : '🔄 진행도 새로고침'}
        </button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && missions.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-12">불러오는 중...</div>
      ) : (
        <>
          {summary && (
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-5 mb-6">
              <div className="text-sm opacity-90">진행 상황</div>
              <div className="text-3xl font-bold mt-1">
                {summary.completed} / {summary.total} 달성
              </div>
              <div className="text-xs opacity-75 mt-2">
                {summary.proUnlocked
                  ? '🎉 Pro 7일 체험권이 발급되었어요!'
                  : `${summary.total}개 모두 달성 시 Pro 7일 체험권 자동 발급`}
              </div>
              {summary.proUnlocked && (
                <Link
                  href="/lite/upgrade"
                  className="inline-block mt-3 px-4 py-2 bg-white text-purple-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
                >
                  Pro 체험 시작하기 →
                </Link>
              )}
            </div>
          )}

          <div className="space-y-3 mb-6">
            {baseMissions.map((m, i) => (
              <MissionCard key={m.code} index={i} mission={m} />
            ))}
          </div>

          {proMission && (
            <div
              className={`rounded-lg p-5 border-2 ${
                proMission.completed
                  ? 'bg-purple-50 border-purple-300'
                  : 'bg-gray-50 border-dashed border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">{proMission.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-gray-900">{proMission.title}</span>
                    {proMission.completed && (
                      <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded">
                        ✓ 발급됨
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{proMission.description}</div>
                  <div className="mt-3">
                    <ProgressBar
                      value={proMission.progress}
                      max={proMission.targetValue}
                      tone={proMission.completed ? 'success' : 'purple'}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      미션 {proMission.progress} / {proMission.targetValue} 달성
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MissionCard({ index, mission }: { index: number; mission: MissionStatus }) {
  const completed = mission.completed
  return (
    <article
      className={`rounded-lg border p-4 transition-colors ${
        completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg ${
            completed ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {completed ? '✓' : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {mission.emoji} {mission.title}
            </span>
            {completed && (
              <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded">완료</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{mission.description}</div>
          <div className="mt-2">
            <ProgressBar
              value={mission.progress}
              max={mission.targetValue}
              tone={completed ? 'success' : 'blue'}
            />
            <div className="text-xs text-gray-500 mt-1">
              {formatProgress(mission.code, mission.progress, mission.targetValue)}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-gray-500">보상</div>
          <div className="text-sm font-medium text-gray-900">{mission.rewardValue}</div>
        </div>
      </div>
    </article>
  )
}

function ProgressBar({
  value,
  max,
  tone,
}: {
  value: number
  max: number
  tone: 'blue' | 'purple' | 'success'
}) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  const color =
    tone === 'success' ? 'bg-green-500' : tone === 'purple' ? 'bg-purple-600' : 'bg-blue-500'
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}
