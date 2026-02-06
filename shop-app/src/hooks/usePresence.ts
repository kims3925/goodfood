'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useShopUrl } from './useShopUrl'

const HEARTBEAT_INTERVAL = 30000 // 30초마다 heartbeat

interface UsePresenceOptions {
  productId?: number
  productName?: string
}

function getScreenSize(): string {
  if (typeof window === 'undefined') return '0x0'
  return `${window.screen.width}x${window.screen.height}`
}

/**
 * 실시간 접속자 추적 훅
 *
 * 페이지 진입 시 접속 정보를 서버에 전송하고,
 * 주기적으로 heartbeat를 보내 활성 상태 유지
 */
export function usePresence(options: UsePresenceOptions = {}) {
  const pathname = usePathname()
  const { slug: shopSlug, getApiPath } = useShopUrl()

  const sessionIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 디바이스 타입 감지
  const getDevice = useCallback((): 'mobile' | 'desktop' => {
    if (typeof window === 'undefined') return 'desktop'
    return window.innerWidth < 768 ? 'mobile' : 'desktop'
  }, [])

  // 세션 ID 생성/조회
  const getSessionId = useCallback(() => {
    if (sessionIdRef.current) return sessionIdRef.current

    // 브라우저 세션 스토리지에서 조회
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('presence_session_id')
      if (!sessionId) {
        sessionId = crypto.randomUUID()
        sessionStorage.setItem('presence_session_id', sessionId)
      }
      sessionIdRef.current = sessionId
      return sessionId
    }

    return null
  }, [])

  // Presence 전송
  const sendPresence = useCallback(async () => {
    const sessionId = getSessionId()
    if (!sessionId || !shopSlug) return

    if (!startedAtRef.current) {
      startedAtRef.current = new Date().toISOString()
    }

    try {
      await fetch(getApiPath('/api/presence'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          shopSlug,
          currentPage: pathname,
          productId: options.productId,
          productName: options.productName,
          device: getDevice(),
          screenSize: getScreenSize(),
          referrer: typeof document !== 'undefined' ? document.referrer : undefined,
          startedAt: startedAtRef.current,
        }),
      })
    } catch (error) {
      // 실패해도 사용자 경험에 영향 없음
      console.debug('Presence 전송 실패:', error)
    }
  }, [getSessionId, shopSlug, pathname, options.productId, options.productName, getDevice, getApiPath])

  // 이탈 처리
  const sendLeave = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId || !shopSlug) return

    try {
      // navigator.sendBeacon은 페이지 언로드 시에도 안정적으로 전송
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(getApiPath(`/api/presence?sessionId=${sessionId}`))
      } else {
        await fetch(getApiPath(`/api/presence?sessionId=${sessionId}`), { method: 'DELETE' })
      }
    } catch {
      // 무시
    }
  }, [shopSlug, getApiPath])

  useEffect(() => {
    if (!shopSlug) return

    // 초기 전송
    sendPresence()

    // 주기적 heartbeat
    intervalRef.current = setInterval(sendPresence, HEARTBEAT_INTERVAL)

    // 페이지 언로드 시 이탈 처리
    const handleBeforeUnload = () => {
      sendLeave()
    }

    // visibility 변경 시 처리
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendPresence()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [shopSlug, sendPresence, sendLeave])

  // 페이지 변경 시 즉시 전송
  useEffect(() => {
    if (shopSlug) {
      sendPresence()
    }
  }, [pathname, options.productId, sendPresence, shopSlug])
}
