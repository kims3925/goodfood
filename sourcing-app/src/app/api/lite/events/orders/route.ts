/**
 * GET /api/lite/events/orders
 * Server-Sent Events (SSE) — Lite 셀러 실시간 주문 알림 채널
 *
 * F1 (실시간 판매 발생 알림) 백엔드.
 * 클라이언트는 EventSource('/api/lite/events/orders') 로 구독.
 *
 * 메시지 형식:
 *  - 'order:created' — 새 주문 발생
 *  - 'order:status'  — 주문 상태 변경 (Phase 2)
 *  - 'ping'          — 30초 keepalive
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // Edge runtime 은 장시간 connection 부적합

import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { liteEventBus, type LiteOrderCreatedPayload } from '@/lib/lite-events'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = user.userId

  // SSE 응답 stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      const safeEnqueue = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }

      // 초기 connect 메시지
      safeEnqueue(`: connected userId=${userId}\n\n`)
      safeEnqueue(`event: ready\ndata: {"userId":${userId}}\n\n`)

      // user-specific 채널 listen
      const orderChannel = `order:created:user:${userId}`
      const missionChannel = `mission:completed:user:${userId}`

      const onOrder = (payload: LiteOrderCreatedPayload) => {
        const json = JSON.stringify(payload)
        safeEnqueue(`event: order:created\ndata: ${json}\n\n`)
      }

      const onMission = (payload: any) => {
        safeEnqueue(`event: mission:completed\ndata: ${JSON.stringify(payload)}\n\n`)
      }

      liteEventBus.on(orderChannel, onOrder)
      liteEventBus.on(missionChannel, onMission)

      // 30초 keepalive (proxy idle timeout 회피)
      const pingInterval = setInterval(() => {
        safeEnqueue(`event: ping\ndata: ${Date.now()}\n\n`)
      }, 30_000)

      // 클라이언트 disconnect 처리
      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(pingInterval)
        liteEventBus.off(orderChannel, onOrder)
        liteEventBus.off(missionChannel, onMission)
        try {
          controller.close()
        } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx — buffering 비활성화
    },
  })
}
