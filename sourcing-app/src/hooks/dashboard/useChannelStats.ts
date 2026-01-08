'use client'

/**
 * 채널별 통계 데이터 훅
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChannelKind, ChannelStat, ChannelStatsSummary } from '@/types/dashboard'

interface ChannelStatsData {
  summary: ChannelStatsSummary
  channels: ChannelStat[]
}

type PeriodFilter = 'today' | '7days' | '30days' | 'custom' | 'all'

interface UseChannelStatsOptions {
  /** 채널 종류 필터 */
  kind?: ChannelKind | 'all'
  /** 자동 폴링 간격 (ms), 0이면 비활성화 */
  pollInterval?: number
  /** 초기 로딩 비활성화 */
  skipInitialFetch?: boolean
  /** 기간 필터 */
  period?: PeriodFilter
  /** 시작 날짜 (YYYY-MM-DD, period가 custom일 때 사용) */
  startDate?: string
  /** 종료 날짜 (YYYY-MM-DD, period가 custom일 때 사용) */
  endDate?: string
}

interface UseChannelStatsResult {
  data: ChannelStatsData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useChannelStats(options: UseChannelStatsOptions = {}): UseChannelStatsResult {
  const {
    kind = 'all',
    pollInterval = 30000,
    skipInitialFetch = false,
    period = 'all',
    startDate,
    endDate,
  } = options

  const [data, setData] = useState<ChannelStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(!skipInitialFetch)
  const [error, setError] = useState<string | null>(null)

  // AbortController 참조를 저장하여 cleanup 시 취소 가능하도록 함
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (kind !== 'all') {
        params.set('kind', kind)
      }
      if (period !== 'all') {
        params.set('period', period)
      }
      if (period === 'custom' && startDate && endDate) {
        params.set('startDate', startDate)
        params.set('endDate', endDate)
      }

      const response = await fetch(`/api/channel/stats?${params.toString()}`, {
        signal,
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || '데이터를 불러오는데 실패했습니다.')
      }
    } catch (err) {
      // AbortError는 정상적인 취소이므로 에러로 처리하지 않음
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      setError('네트워크 오류가 발생했습니다.')
      console.error('채널 통계 조회 실패:', err)
    } finally {
      setIsLoading(false)
    }
  }, [kind, period, startDate, endDate])

  // 초기 로딩 및 의존성 변경 시 fetch
  useEffect(() => {
    if (skipInitialFetch) return

    // 이전 요청 취소
    abortControllerRef.current?.abort()

    // 새 AbortController 생성
    const controller = new AbortController()
    abortControllerRef.current = controller

    fetchStats(controller.signal)

    // cleanup: 언마운트 또는 의존성 변경 시 요청 취소
    return () => {
      controller.abort()
    }
  }, [fetchStats, skipInitialFetch])

  // 폴링
  useEffect(() => {
    if (pollInterval <= 0) return

    const intervalId = setInterval(() => {
      // 폴링 요청은 별도 controller 사용 (이전 폴링 취소 불필요)
      const controller = new AbortController()
      fetchStats(controller.signal)
    }, pollInterval)

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchStats, pollInterval])

  // 수동 refetch 함수 (외부에서 호출 시 사용)
  const refetch = useCallback(async () => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    await fetchStats(controller.signal)
  }, [fetchStats])

  return {
    data,
    isLoading,
    error,
    refetch,
  }
}
