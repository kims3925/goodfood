export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'

export async function GET(
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

    // 최근 태스크 10개
    const recentTasks = await prisma.agentTask.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // 최근 로그 20개
    const recentLogs = await prisma.agentLog.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // KPI 요약 (최근 30일)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const kpiRecords = await prisma.agentKpiRecord.findMany({
      where: {
        agentId: id,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'desc' },
    })

    // 메트릭별 KPI 요약 계산
    const kpiByMetric: Record<string, { values: number[]; targets: number[] }> = {}
    for (const record of kpiRecords) {
      if (!kpiByMetric[record.metric]) {
        kpiByMetric[record.metric] = { values: [], targets: [] }
      }
      kpiByMetric[record.metric].values.push(record.value)
      kpiByMetric[record.metric].targets.push(record.target)
    }

    const kpiSummary = Object.entries(kpiByMetric).map(([metric, data]) => {
      const avgValue = data.values.reduce((a, b) => a + b, 0) / data.values.length
      const avgTarget = data.targets.reduce((a, b) => a + b, 0) / data.targets.length
      const achievement = avgTarget > 0 ? (avgValue / avgTarget) * 100 : 0

      return {
        metric,
        avgValue: Math.round(avgValue * 100) / 100,
        avgTarget: Math.round(avgTarget * 100) / 100,
        achievement: Math.round(achievement * 100) / 100,
        dataPoints: data.values.length,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        agent,
        recentTasks,
        recentLogs,
        kpiSummary,
      },
    })
  } catch (error) {
    console.error('Failed to fetch agent detail:', error)
    return NextResponse.json(
      { success: false, error: '에이전트 상세 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const body = await request.json()

    const agent = await prisma.agentDefinition.findFirst({
      where: { id, deletedAt: null },
    })

    if (!agent) {
      return NextResponse.json(
        { success: false, error: '에이전트를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 허용된 필드만 업데이트
    const allowedFields = ['config', 'priority', 'maxConcurrent', 'retryPolicy', 'schedule']
    const updateData: any = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '업데이트할 필드가 없습니다' },
        { status: 400 }
      )
    }

    const updated = await prisma.agentDefinition.update({
      where: { id },
      data: updateData,
    })

    // 변경 로그 기록
    await prisma.agentLog.create({
      data: {
        agentId: id,
        level: 'INFO',
        message: `에이전트 설정 업데이트: ${Object.keys(updateData).join(', ')}`,
        metadata: {
          updatedFields: Object.keys(updateData),
          updatedBy: (session.user as any)?.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Failed to update agent:', error)
    return NextResponse.json(
      { success: false, error: '에이전트 업데이트에 실패했습니다' },
      { status: 500 }
    )
  }
}
