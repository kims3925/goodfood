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

    // 오늘 시작 시점
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // 전체 에이전트 통계
    const [totalAgents, activeAgents, errorAgents] = await Promise.all([
      prisma.agentDefinition.count({ where: { deletedAt: null } }),
      prisma.agentDefinition.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      prisma.agentDefinition.count({ where: { deletedAt: null, status: 'ERROR' } }),
    ])

    // 오늘 태스크 수
    const tasksToday = await prisma.agentTask.count({
      where: {
        createdAt: { gte: todayStart },
      },
    })

    // 오늘 완료된 태스크의 평균 레이턴시 (duration in ms)
    const avgLatencyResult = await prisma.agentTask.aggregate({
      where: {
        completedAt: { gte: todayStart },
        duration: { not: null },
        status: 'COMPLETED',
      },
      _avg: {
        duration: true,
      },
    })
    const avgLatency = avgLatencyResult._avg.duration
      ? Math.round(avgLatencyResult._avg.duration)
      : 0

    // 최근 30일 KPI 달성률 계산
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const kpiRecords = await prisma.agentKpiRecord.findMany({
      where: {
        date: { gte: thirtyDaysAgo },
      },
      select: {
        value: true,
        target: true,
      },
    })

    let kpiAchievement = 0
    if (kpiRecords.length > 0) {
      const achievements = kpiRecords.map(r =>
        r.target > 0 ? (r.value / r.target) * 100 : 100
      )
      kpiAchievement = Math.round(
        (achievements.reduce((a, b) => a + b, 0) / achievements.length) * 100
      ) / 100
    }

    // Layer별 집계
    const byLayerRaw = await prisma.agentDefinition.groupBy({
      by: ['layer'],
      where: { deletedAt: null },
      _count: { id: true },
    })

    const byLayerStatusRaw = await prisma.agentDefinition.groupBy({
      by: ['layer', 'status'],
      where: { deletedAt: null },
      _count: { id: true },
    })

    const byLayer = byLayerRaw.map(item => {
      const statuses = byLayerStatusRaw
        .filter(s => s.layer === item.layer)
        .reduce((acc: Record<string, number>, s) => {
          acc[s.status] = s._count.id
          return acc
        }, {})

      return {
        layer: item.layer,
        total: item._count.id,
        ...statuses,
      }
    })

    // 최근 이벤트 (로그에서 중요 이벤트)
    const recentEvents = await prisma.agentLog.findMany({
      where: {
        level: { in: ['WARN', 'ERROR', 'CRITICAL'] },
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            displayName: true,
            icon: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // 알림 생성: ERROR 상태 에이전트, 실패한 태스크
    const alerts: Array<{
      type: 'error' | 'warning' | 'info'
      message: string
      agentId?: string
      agentName?: string
      createdAt: Date
    }> = []

    // ERROR 상태 에이전트 알림
    const errorAgentsList = await prisma.agentDefinition.findMany({
      where: { deletedAt: null, status: 'ERROR' },
      select: { id: true, name: true, displayName: true, updatedAt: true },
    })

    for (const agent of errorAgentsList) {
      alerts.push({
        type: 'error',
        message: `${agent.displayName} 에이전트가 오류 상태입니다`,
        agentId: agent.id,
        agentName: agent.displayName,
        createdAt: agent.updatedAt,
      })
    }

    // 최근 1시간 내 실패한 태스크 알림
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)

    const recentFailedTasks = await prisma.agentTask.findMany({
      where: {
        status: 'FAILED',
        createdAt: { gte: oneHourAgo },
      },
      include: {
        agent: {
          select: { id: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    for (const task of recentFailedTasks) {
      alerts.push({
        type: 'warning',
        message: `${task.agent.displayName}의 태스크 실패: ${task.eventType}`,
        agentId: task.agentId,
        agentName: task.agent.displayName,
        createdAt: task.createdAt,
      })
    }

    // 알림을 시간순 정렬
    alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalAgents,
          activeAgents,
          errorAgents,
          tasksToday,
          avgLatency,
          kpiAchievement,
        },
        byLayer,
        recentEvents,
        alerts,
      },
    })
  } catch (error) {
    console.error('Failed to fetch dashboard:', error)
    return NextResponse.json(
      { success: false, error: '대시보드 데이터를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
