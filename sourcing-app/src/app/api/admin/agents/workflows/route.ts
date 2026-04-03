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

    const workflows = await prisma.agentWorkflow.findMany({
      include: {
        steps: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                displayName: true,
                icon: true,
                layer: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        workflows,
      },
    })
  } catch (error) {
    console.error('Failed to fetch workflows:', error)
    return NextResponse.json(
      { success: false, error: '워크플로우 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { name, triggerEvent, config, isActive, steps } = body

    if (!name || !triggerEvent) {
      return NextResponse.json(
        { success: false, error: '워크플로우 이름과 트리거 이벤트는 필수입니다' },
        { status: 400 }
      )
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { success: false, error: '최소 1개 이상의 스텝이 필요합니다' },
        { status: 400 }
      )
    }

    // 스텝에 포함된 에이전트 존재 확인
    const agentIds = steps.map((s: any) => s.agentId)
    const existingAgents = await prisma.agentDefinition.findMany({
      where: {
        id: { in: agentIds },
        deletedAt: null,
      },
      select: { id: true },
    })

    const existingAgentIds = new Set(existingAgents.map(a => a.id))
    const missingAgentIds = agentIds.filter((id: string) => !existingAgentIds.has(id))

    if (missingAgentIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `존재하지 않는 에이전트가 포함되어 있습니다: ${missingAgentIds.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // 트랜잭션으로 워크플로우 + 스텝 생성
    const workflow = await prisma.$transaction(async (tx) => {
      const created = await tx.agentWorkflow.create({
        data: {
          name,
          triggerEvent,
          config: config || {},
          isActive: isActive ?? true,
        },
      })

      // 스텝 일괄 생성
      const stepData = steps.map((step: any, index: number) => ({
        workflowId: created.id,
        agentId: step.agentId,
        order: step.order ?? index + 1,
        isParallel: step.isParallel ?? false,
        config: step.config ?? null,
      }))

      await tx.agentWorkflowStep.createMany({
        data: stepData,
      })

      // 스텝 포함하여 조회
      return tx.agentWorkflow.findUnique({
        where: { id: created.id },
        include: {
          steps: {
            include: {
              agent: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  icon: true,
                  layer: true,
                },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: workflow,
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create workflow:', error)
    return NextResponse.json(
      { success: false, error: '워크플로우 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}
