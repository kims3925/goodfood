/**
 * Lite Order Notifier — 실시간 주문 알림 (F1)
 *
 * - EventSource('/api/lite/events/orders') 로 SSE 구독
 * - 'order:created' 수신 시 토스트 + 사운드 + 잠시 깜빡임
 * - 사용자가 있는 페이지 무관하게 layout 에서 항상 mount
 *
 * 사운드: WebAudio API 로 짧은 비프음 (외부 mp3 의존 X)
 */
'use client'

import { useEffect, useRef, useState } from 'react'

interface OrderToast {
  id: number
  kind: 'order' | 'mission'
  totalAmount?: number
  itemCount?: number
  buyerName?: string
  topItemName?: string | null
  orderedAt?: string
  // mission
  missionTitle?: string
  rewardValue?: string
  rewardType?: string
}

function playBeep() {
  // 외부 mp3 없이 WebAudio 로 깔끔한 띵-동 비프
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.frequency.value = 880 // A5
    osc1.connect(gain1).connect(ctx.destination)
    gain1.gain.setValueAtTime(0.0001, now)
    gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    osc1.start(now)
    osc1.stop(now + 0.2)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.frequency.value = 1175 // D6
    osc2.connect(gain2).connect(ctx.destination)
    gain2.gain.setValueAtTime(0.0001, now + 0.22)
    gain2.gain.exponentialRampToValueAtTime(0.25, now + 0.24)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
    osc2.start(now + 0.22)
    osc2.stop(now + 0.42)

    setTimeout(() => ctx.close().catch(() => {}), 600)
  } catch {
    // ignore — 사운드 실패해도 토스트는 표시
  }
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('ko-KR')
}

export default function OrderNotifier() {
  const [toasts, setToasts] = useState<OrderToast[]>([])
  const idCounter = useRef(0)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const es = new EventSource('/api/lite/events/orders')

    es.addEventListener('ready', () => {
      setConnected(true)
    })

    es.addEventListener('order:created', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data)
        const toast: OrderToast = {
          id: ++idCounter.current,
          kind: 'order',
          totalAmount: data.totalAmount,
          itemCount: data.itemCount,
          buyerName: data.buyer?.name || '익명',
          topItemName: data.topItem?.productName || null,
          orderedAt: data.orderedAt,
        }
        setToasts((prev) => [toast, ...prev].slice(0, 5))
        playBeep()

        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id))
        }, 8000)

        // 주문 발생 → 미션 진행도 자동 재평가 (서버에 즉시 반영)
        try {
          fetch('/api/lite/missions', { method: 'POST', credentials: 'include' }).catch(() => {})
        } catch {}
      } catch (err) {
        console.error('[OrderNotifier] parse error', err)
      }
    })

    es.addEventListener('mission:completed', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data)
        const toast: OrderToast = {
          id: ++idCounter.current,
          kind: 'mission',
          missionTitle: data.missionTitle || '미션',
          rewardValue: data.rewardValue || '',
          rewardType: data.rewardType,
        }
        setToasts((prev) => [toast, ...prev].slice(0, 5))
        playBeep()
        // 12초 (조금 더 길게 노출 — 셀러가 보상 확인)
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id))
        }, 12000)
      } catch {}
    })

    es.onerror = () => {
      setConnected(false)
      // EventSource 는 자동 재연결 — 별도 처리 불필요
    }

    return () => {
      es.close()
    }
  }, [])

  return (
    <>
      {/* 연결 상태 인디케이터 — 사이드바 하단 */}
      <div className="fixed bottom-3 left-3 z-40 pointer-events-none">
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] backdrop-blur ${
            connected ? 'bg-green-100/80 text-green-700' : 'bg-gray-100/80 text-gray-500'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
          />
          {connected ? '실시간 연결됨' : '연결 대기...'}
        </div>
      </div>

      {/* 토스트 — 우측 상단 */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <article
            key={t.id}
            className={`pointer-events-auto bg-white border-2 rounded-lg shadow-lg p-4 w-80 animate-in slide-in-from-right-4 fade-in-0 ${
              t.kind === 'mission' ? 'border-purple-500' : 'border-blue-500'
            }`}
            role="status"
          >
            {t.kind === 'order' ? (
              <div className="flex items-start gap-3">
                <div className="text-2xl">🔔</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-blue-600">새 주문 발생!</div>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">
                    ₩{formatPrice(t.totalAmount || 0)}
                  </div>
                  {t.topItemName && (
                    <div className="text-xs text-gray-700 mt-1 truncate">
                      {t.topItemName}
                      {(t.itemCount || 0) > 1 && (
                        <span className="text-gray-400 ml-1">외 {(t.itemCount || 1) - 1}건</span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    👤 {t.buyerName} ·{' '}
                    {t.orderedAt &&
                      new Date(t.orderedAt).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </div>
                </div>
                <button
                  aria-label="닫기"
                  onClick={() => setToasts((prev) => prev.filter((p) => p.id !== t.id))}
                  className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-3 bg-gradient-to-r from-purple-50 to-pink-50 -m-4 p-4 rounded-lg">
                <div className="text-2xl">🏆</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-purple-600">미션 달성!</div>
                  <div className="text-base font-bold text-gray-900 mt-0.5">{t.missionTitle}</div>
                  <div className="text-sm text-purple-700 mt-1">{t.rewardValue}</div>
                  {t.rewardType === 'pro_trial' && (
                    <a
                      href="/lite/upgrade"
                      className="inline-block mt-2 px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                    >
                      Pro 체험 시작 →
                    </a>
                  )}
                </div>
                <button
                  aria-label="닫기"
                  onClick={() => setToasts((prev) => prev.filter((p) => p.id !== t.id))}
                  className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1"
                >
                  ×
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  )
}
