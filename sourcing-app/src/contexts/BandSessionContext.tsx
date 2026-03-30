'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'

interface ChannelSessionStatus {
  id: number
  name: string
  hasSession: boolean
  isValid: boolean
  expiresAt: string | null
  remainingMinutes: number | null
}

interface SessionSummary {
  total: number
  valid: number
  expired: number
  none: number
  allValid: boolean
}

interface BandSessionState {
  isLoading: boolean
  error: string | null
  summary: SessionSummary | null
  channels: ChannelSessionStatus[]
  lastChecked: Date | null
}

interface BandSessionContextType extends BandSessionState {
  checkSession: () => Promise<void>
  isSessionHealthy: boolean
}

const BandSessionContext = createContext<BandSessionContextType | null>(null)

// 체크 주기: 30분 (밀리초)
const CHECK_INTERVAL = 30 * 60 * 1000

export function BandSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BandSessionState>({
    isLoading: true,
    error: null,
    summary: null,
    channels: [],
    lastChecked: null,
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const checkSession = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      // DB 기반 세션 상태 확인 (Playwright 검증 제거 - 자동 실행 시 세션 삭제 방지)
      const response = await fetch('/api/band-session/status')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '세션 상태 조회 실패')
      }

      setState({
        isLoading: false,
        error: null,
        summary: data.summary,
        channels: data.channels,
        lastChecked: new Date(data.checkedAt),
      })

      // 세션 만료된 채널이 있으면 콘솔에 경고
      const expiredChannels = data.channels.filter(
        (c: ChannelSessionStatus) => c.hasSession && !c.isValid
      )
      if (expiredChannels.length > 0) {
        console.warn(
          `[BandSession] ${expiredChannels.length}개 채널 세션 만료:`,
          expiredChannels.map((c: ChannelSessionStatus) => c.name).join(', ')
        )
      }
    } catch (error: any) {
      console.error('[BandSession] Check failed:', error)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }))
    }
  }, [])

  // 초기 로드 및 30분 주기 체크
  useEffect(() => {
    // 초기 체크
    checkSession()

    // 30분마다 체크
    intervalRef.current = setInterval(checkSession, CHECK_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [checkSession])

  // 세션이 정상인지 여부
  const isSessionHealthy = state.summary?.allValid ?? false

  const contextValue = useMemo(
    () => ({
      ...state,
      checkSession,
      isSessionHealthy,
    }),
    [state, checkSession, isSessionHealthy]
  )

  return (
    <BandSessionContext.Provider value={contextValue}>
      {children}
    </BandSessionContext.Provider>
  )
}

export function useBandSession() {
  const context = useContext(BandSessionContext)
  if (!context) {
    throw new Error('useBandSession must be used within BandSessionProvider')
  }
  return context
}
