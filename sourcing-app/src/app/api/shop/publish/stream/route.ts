export const dynamic = 'force-dynamic'

/**
 * SSE Endpoint for Publish Streaming
 * 실시간 발행 진행 상태를 SSE로 스트리밍
 */

import { NextRequest } from 'next/server'
import prisma, { ChannelKind } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { publishService } from '@/modules/publish'

/**
 * POST /api/shop/publish/stream
 *
 * SSE로 발행 진행 상태 스트리밍
 * productIds, channelId를 받아서 실시간으로 각 상품 발행 진행 상태 전송
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return new Response(
        JSON.stringify({ success: false, error: '로그인이 필요합니다.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    const userId = currentUser.userId

    const body = await request.json()
    const { productIds, channelId } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: '발행할 상품을 선택해주세요.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!channelId) {
      return new Response(
        JSON.stringify({ success: false, error: '발행할 채널을 선택해주세요.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 채널 권한 확인
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId,
        kind: ChannelKind.RETAIL,
        isActive: true,
      },
      select: { id: true, name: true, platform: true },
    })

    if (!channel) {
      return new Response(
        JSON.stringify({ success: false, error: '선택한 채널을 찾을 수 없거나 발행 권한이 없습니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // AbortController 생성 (취소 신호 관리)
    const abortController = new AbortController()
    const signal = abortController.signal

    // SSE 스트림 생성
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let isClosed = false

        // SSE 이벤트 전송 헬퍼 (컨트롤러 상태 체크)
        const sendEvent = (data: any) => {
          if (isClosed) return
          try {
            const eventData = `data: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(eventData))
          } catch (e) {
            // Controller가 이미 닫힌 경우 무시
            console.log('[SSE] Controller already closed, skipping event')
            isClosed = true
          }
        }

        // 안전한 스트림 종료 헬퍼
        const safeClose = () => {
          if (isClosed) return
          try {
            controller.close()
            isClosed = true
          } catch (e) {
            // 이미 닫힌 경우 무시
          }
        }

        try {
          // Generator를 사용하여 이벤트 스트리밍
          const eventGenerator = publishService.publishBatchWithStream({
            userId,
            productIds,
            channelId: channel.id,
            signal, // 취소 신호 전달
          })

          for await (const event of eventGenerator) {
            // 취소 신호 확인
            if (signal.aborted) {
              console.log('[SSE] 발행 취소됨 (for await 루프)')
              sendEvent({
                type: 'cancelled',
                timestamp: Date.now(),
                data: { message: '발행이 취소되었습니다.' },
              })
              break
            }
            sendEvent(event)
          }

          // 스트림 종료
          safeClose()
        } catch (error: any) {
          console.error('[SSE] Stream error:', error)
          sendEvent({
            type: 'error',
            timestamp: Date.now(),
            data: {
              error: error.message || '발행 중 오류가 발생했습니다.',
            },
          })
          safeClose()
        }
      },

      // 클라이언트가 연결을 끊을 때 호출
      cancel() {
        console.log('[SSE] 클라이언트 연결 끊김 - 발행 취소')
        abortController.abort()
      },
    })

    // SSE 응답 반환
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // nginx 버퍼링 비활성화
      },
    })
  } catch (error) {
    console.error('[SSE] Publish stream error:', error)
    return new Response(
      JSON.stringify({ success: false, error: '발행 스트림 생성에 실패했습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
