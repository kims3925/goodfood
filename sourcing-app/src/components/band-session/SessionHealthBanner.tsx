'use client'

/**
 * SessionHealthBanner — 매니저 대시보드 최상단에 표시되는 세션 헬스 알림.
 *
 * SaaS-grade 예방책 Phase 1.
 *
 * 동작:
 *  - 30초 주기 폴링 (실행중일 때만)
 *  - overallSeverity 가 HEALTHY 면 렌더 안 함 (자리 차지 X)
 *  - WARNING: 노란 배너 + "세션 재저장" 가이드 링크
 *  - CRITICAL: 빨간 배너 + 채널 목록 펼침 + 가이드 링크 (큰 버튼)
 *  - 펼침 시 채널별 상태 (cookie 길이, 만료 시각, 메시지) 표시
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, XCircle, ChevronDown, ChevronUp, RefreshCw, ExternalLink, ShieldAlert, Wifi, Clock,
} from 'lucide-react'

type Severity = 'HEALTHY' | 'WARNING' | 'CRITICAL'

interface ChannelHealth {
  channelId: number
  channelName: string
  severity: Severity
  cookieLen: number | null
  sessionExpiresAt: string | null
  hoursUntilExpiry: number | null
  recentSuccessCount: number
  recentFailedCount: number
  message: string
  reasonCode: string
}

interface HealthSummary {
  overallSeverity: Severity
  totalChannels: number
  healthyCount: number
  warningCount: number
  criticalCount: number
  channels: ChannelHealth[]
  recommendation: string | null
  guideUrl: string
}

export default function SessionHealthBanner() {
  const [data, setData] = useState<HealthSummary | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null) // 사용자 임시 닫기 (1시간)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/band-session/health', { cache: 'no-store', credentials: 'include' })
      const json = await res.json()
      if (json?.success && json.data) {
        setData(json.data)
      }
    } catch (e) {
      console.warn('[SessionHealthBanner] 헬스 조회 실패', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30_000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  // 사용자 임시 닫기 동안은 숨김
  if (dismissedUntil && Date.now() < dismissedUntil) return null

  // HEALTHY 또는 데이터 없음 → 렌더 안 함
  if (!data || data.overallSeverity === 'HEALTHY' || data.totalChannels === 0) {
    return null
  }

  const isCritical = data.overallSeverity === 'CRITICAL'
  const severityChannels = data.channels.filter((c) => c.severity !== 'HEALTHY')

  const colors = isCritical
    ? {
        bg: 'bg-red-50',
        border: 'border-red-300',
        text: 'text-red-900',
        accent: 'text-red-600',
        button: 'bg-red-600 hover:bg-red-700 text-white',
        icon: XCircle,
      }
    : {
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        text: 'text-amber-900',
        accent: 'text-amber-600',
        button: 'bg-amber-600 hover:bg-amber-700 text-white',
        icon: AlertTriangle,
      }
  const Icon = colors.icon

  const dismissOneHour = () => {
    setDismissedUntil(Date.now() + 60 * 60 * 1000)
  }

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-4 mb-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 mt-0.5 ${colors.accent}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <h3 className={`font-bold ${colors.text} text-base flex items-center gap-2`}>
              <ShieldAlert className="w-4 h-4" />
              {isCritical ? '🔴 발행이 중단될 수 있습니다 — Band 세션 점검 필요' : '⚠ Band 세션 점검 권장'}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={fetchHealth}
                disabled={loading}
                className="p-1 rounded text-xs hover:bg-white/50 transition-colors"
                title="새로고침"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${colors.accent} ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={dismissOneHour}
                className={`text-xs px-2 py-0.5 rounded hover:bg-white/60 ${colors.accent}`}
                title="1시간 동안 숨김"
              >
                1시간 숨김
              </button>
            </div>
          </div>

          {data.recommendation && (
            <p className={`text-sm ${colors.text} mb-3 leading-relaxed`}>
              {data.recommendation}
            </p>
          )}

          {/* 채널 요약 카운트 */}
          <div className={`flex items-center gap-3 text-xs ${colors.text} mb-3 flex-wrap`}>
            <span>전체 {data.totalChannels}</span>
            <span>•</span>
            <span className="text-green-700">정상 {data.healthyCount}</span>
            {data.warningCount > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-700">주의 {data.warningCount}</span>
              </>
            )}
            {data.criticalCount > 0 && (
              <>
                <span>•</span>
                <span className="text-red-700 font-bold">위험 {data.criticalCount}</span>
              </>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Link
              href={data.guideUrl}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold ${colors.button} transition-colors`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              세션 재저장 가이드 열기
            </Link>
            {severityChannels.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-white/70 hover:bg-white ${colors.text} border ${colors.border}`}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                채널 상세 ({severityChannels.length})
              </button>
            )}
          </div>

          {/* 채널 상세 펼침 */}
          {expanded && severityChannels.length > 0 && (
            <div className="mt-3 space-y-2">
              {severityChannels.map((ch) => {
                const chCritical = ch.severity === 'CRITICAL'
                return (
                  <div
                    key={ch.channelId}
                    className={`p-2.5 rounded-lg border ${
                      chCritical ? 'bg-red-100 border-red-200' : 'bg-amber-100 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-medium text-sm text-gray-900 truncate">{ch.channelName}</div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          chCritical ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                        }`}
                      >
                        {ch.severity}
                      </span>
                    </div>
                    <div className="text-xs text-gray-700 mb-1.5">{ch.message}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                      <span className="flex items-center gap-0.5">
                        <Wifi className="w-3 h-3" />
                        쿠키: {ch.cookieLen != null ? `${ch.cookieLen}자` : '없음'}
                      </span>
                      {ch.sessionExpiresAt && ch.hoursUntilExpiry !== null && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {ch.hoursUntilExpiry > 0
                            ? `${ch.hoursUntilExpiry}시간 후 만료`
                            : `${-ch.hoursUntilExpiry}시간 전 만료됨`}
                        </span>
                      )}
                      <span>최근 24h 발행 {ch.recentSuccessCount}건</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
