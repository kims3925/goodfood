export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다' },
        { status: 401 }
      )
    }
    if ((session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      )
    }

    const encoder = new TextEncoder()
    let isClosed = false

    const stream = new ReadableStream({
      async start(controller) {
        // SSE 형식으로 이벤트 전송하는 헬퍼
        const sendEvent = (event: string, data: any) => {
          if (isClosed) return
          try {
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(payload))
          } catch {
            // 스트림이 닫힌 경우 무시
            isClosed = true
          }
        }

        // 초기 연결 확인 이벤트
        sendEvent('connected', {
          message: 'SSE 연결됨',
          timestamp: new Date().toISOString(),
        })

        // 마지막 확인 시점 추적
        let lastCheckTime = new Date()

        // 주기적으로 에이전트 상태 및 태스크 업데이트 전송
        const intervalId = setInterval(async () => {
          if (isClosed) {
            clearInterval(intervalId)
            return
          }

          try {
            const now = new Date()

            // 에이전트 상태 요약 전송
            const [activeCount, errorCount, totalCount] = await Promise.all([
              prisma.agentDefinition.count({
                where: { deletedAt: null, status: 'ACTIVE' },
              }),
              prisma.agentDefinition.count({
                where: { deletedAt: null, status: 'ERROR' },
              }),
              prisma.agentDefinition.count({
                where: { deletedAt: null },
              }),
            ])

            sendEvent('agent-status', {
              activeCount,
              errorCount,
              totalCount,
              timestamp: now.toISOString(),
            })

            // 마지막 확인 이후 변경된 에이전트 상태
            const changedAgents = await prisma.agentDefinition.findMany({
              where: {
                deletedAt: null,
                updatedAt: { gt: lastCheckTime },
              },
              select: {
                id: true,
                name: true,
                displayName: true,
                status: true,
                updatedAt: true,
              },
            })

            if (changedAgents.length > 0) {
              sendEvent('agent-changes', {
                agents: changedAgents,
                timestamp: now.toISOString(),
              })
            }

            // 마지막 확인 이후 생성/업데이트된 태스크
            const recentTasks = await prisma.agentTask.findMany({
              where: {
                OR: [
                  { createdAt: { gt: lastCheckTime } },
                  { completedAt: { gt: lastCheckTime } },
                ],
              },
              include: {
                agent: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 20,
            })

            if (recentTasks.length > 0) {
              sendEvent('task-updates', {
                tasks: recentTasks.map(t => ({
                  id: t.id,
                  agentId: t.agentId,
                  agentName: t.agent.displayName,
                  eventType: t.eventType,
                  status: t.status,
                  priority: t.priority,
                  duration: t.duration,
                  createdAt: t.createdAt.toISOString(),
                  completedAt: t.completedAt?.toISOString() || null,
                })),
                timestamp: now.toISOString(),
              })
            }

            // 최근 에러/크리티컬 로그
            const criticalLogs = await prisma.agentLog.findMany({
              where: {
                level: { in: ['ERROR', 'CRITICAL'] },
                createdAt: { gt: lastCheckTime },
              },
              include: {
                agent: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 10,
            })

            if (criticalLogs.length > 0) {
              sendEvent('alerts', {
                logs: criticalLogs.map(l => ({
                  id: l.id,
                  agentId: l.agentId,
                  agentName: l.agent.displayName,
                  level: l.level,
                  message: l.message,
                  createdAt: l.createdAt.toISOString(),
                })),
                timestamp: now.toISOString(),
              })
            }

            lastCheckTime = now
          } catch (error) {
            // DB 오류 시에도 스트림은 유지
            console.error('SSE polling error:', error)
            sendEvent('error', {
              message: '데이터 조회 중 오류가 발생했습니다',
              timestamp: new Date().toISOString(),
            })
          }
        }, 5000) // 5초마다 폴링

        // 클라이언트 연결 해제 감지
        request.signal.addEventListener('abort', () => {
          isClosed = true
          clearInterval(intervalId)
          try {
            controller.close()
          } catch {
            // 이미 닫힌 경우 무시
          }
        })
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('Failed to create SSE stream:', error)
    return NextResponse.json(
      { success: false, error: 'SSE 스트림 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}
