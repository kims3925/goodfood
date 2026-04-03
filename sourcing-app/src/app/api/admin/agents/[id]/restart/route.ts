export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const agent = await prisma.agentDefinition.findFirst({
      where: { id, deletedAt: null },
    })

    if (!agent) {
      return NextResponse.json(
        { success: false, error: '에이전트를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const previousStatus = agent.status

    // 먼저 MAINTENANCE 상태로 전환
    await prisma.agentDefinition.update({
      where: { id },
      data: { status: 'MAINTENANCE' },
    })

    await prisma.agentLog.create({
      data: {
        agentId: id,
        level: 'INFO',
        message: `에이전트 재시작 중 - MAINTENANCE 모드 진입 (이전 상태: ${previousStatus})`,
        metadata: {
          action: 'RESTART_MAINTENANCE',
          previousStatus,
          triggeredBy: (session.user as any)?.id,
        },
      },
    })

    // ACTIVE 상태로 전환
    const updated = await prisma.agentDefinition.update({
      where: { id },
      data: { status: 'ACTIVE' },
    })

    await prisma.agentLog.create({
      data: {
        agentId: id,
        level: 'INFO',
        message: `에이전트 재시작 완료 - ACTIVE 상태 복원`,
        metadata: {
          action: 'RESTART_ACTIVE',
          previousStatus,
          triggeredBy: (session.user as any)?.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Failed to restart agent:', error)
    return NextResponse.json(
      { success: false, error: '에이전트 재시작에 실패했습니다' },
      { status: 500 }
    )
  }
}
