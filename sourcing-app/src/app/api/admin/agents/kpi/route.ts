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

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const metric = searchParams.get('metric')
    const period = searchParams.get('period')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}

    if (agentId) {
      where.agentId = agentId
    }

    if (metric) {
      where.metric = metric
    }

    if (period) {
      where.period = period
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.date.lte = end
      }
    }

    const records = await prisma.agentKpiRecord.findMany({
      where,
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
      orderBy: { date: 'desc' },
    })

    // 메트릭별 요약 계산
    const metricGroups: Record<string, { values: number[]; targets: number[]; dates: Date[] }> = {}
    for (const record of records) {
      const key = `${record.agentId}:${record.metric}`
      if (!metricGroups[key]) {
        metricGroups[key] = { values: [], targets: [], dates: [] }
      }
      metricGroups[key].values.push(record.value)
      metricGroups[key].targets.push(record.target)
      metricGroups[key].dates.push(record.date)
    }

    const summary = Object.entries(metricGroups).map(([key, data]) => {
      const [groupAgentId, groupMetric] = key.split(':')
      const avg = data.values.reduce((a, b) => a + b, 0) / data.values.length
      const avgTarget = data.targets.reduce((a, b) => a + b, 0) / data.targets.length

      // 트렌드 계산: 최근 값과 이전 값 비교
      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (data.values.length >= 2) {
        const recent = data.values.slice(0, Math.ceil(data.values.length / 2))
        const older = data.values.slice(Math.ceil(data.values.length / 2))
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
        const diff = recentAvg - olderAvg

        if (Math.abs(diff) < olderAvg * 0.05) {
          trend = 'stable'
        } else if (diff > 0) {
          trend = 'up'
        } else {
          trend = 'down'
        }
      }

      return {
        agentId: groupAgentId,
        metric: groupMetric,
        avg: Math.round(avg * 100) / 100,
        avgTarget: Math.round(avgTarget * 100) / 100,
        achievement: avgTarget > 0 ? Math.round((avg / avgTarget) * 10000) / 100 : 0,
        trend,
        dataPoints: data.values.length,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        records,
        summary,
      },
    })
  } catch (error) {
    console.error('Failed to fetch KPI records:', error)
    return NextResponse.json(
      { success: false, error: 'KPI 데이터를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
