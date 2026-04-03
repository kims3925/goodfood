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
    const layer = searchParams.get('layer')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: any = {
      deletedAt: null,
    }

    if (layer) {
      where.layer = layer
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { displayName: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const agents = await prisma.agentDefinition.findMany({
      where,
      orderBy: [
        { priority: 'asc' },
        { name: 'asc' },
      ],
    })

    const total = await prisma.agentDefinition.count({ where })

    // Layer별 집계
    const byLayerRaw = await prisma.agentDefinition.groupBy({
      by: ['layer'],
      where: { deletedAt: null },
      _count: { id: true },
    })
    const byLayer = byLayerRaw.reduce((acc: Record<string, number>, item) => {
      acc[item.layer] = item._count.id
      return acc
    }, {})

    // Status별 집계
    const byStatusRaw = await prisma.agentDefinition.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { id: true },
    })
    const byStatus = byStatusRaw.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = item._count.id
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        agents,
        total,
        byLayer,
        byStatus,
      },
    })
  } catch (error) {
    console.error('Failed to fetch agents:', error)
    return NextResponse.json(
      { success: false, error: '에이전트 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
