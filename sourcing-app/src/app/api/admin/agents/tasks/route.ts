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
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const where: any = {}

    if (agentId) {
      where.agentId = agentId
    }

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    const [tasks, total] = await Promise.all([
      prisma.agentTask.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              displayName: true,
              layer: true,
              icon: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
        skip: offset,
        take: limit,
      }),
      prisma.agentTask.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('Failed to fetch agent tasks:', error)
    return NextResponse.json(
      { success: false, error: '태스크 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
