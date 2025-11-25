/**
 * Automation Execute API
 * 자동화 파이프라인 수동 실행
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, WorkflowType } from '@prisma/client'
import { getCurrentUser } from '@/modules/auth/auth.service'
import {
  executeCollectionPipeline,
  executeTransformPipeline,
  executePublishPipeline,
  executeFullPipeline,
  getRunningWorkflow,
} from '@/modules/automation'

const prisma = new PrismaClient()

/**
 * POST /api/automation/execute
 * 파이프라인 수동 실행
 *
 * Request Body:
 * - type: 'collect' | 'transform' | 'publish' | 'full'
 * - config?: 파이프라인별 추가 설정
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { type, config } = body

    if (!type) {
      return NextResponse.json(
        { success: false, error: '실행 타입이 필요합니다.' },
        { status: 400 }
      )
    }

    // 이미 실행 중인 워크플로우 확인
    const running = await getRunningWorkflow(currentUser.userId)
    if (running) {
      return NextResponse.json(
        {
          success: false,
          error: '이미 실행 중인 워크플로우가 있습니다.',
          runningWorkflow: {
            id: running.id,
            type: running.workflowType,
            startedAt: running.startedAt,
          },
        },
        { status: 409 }
      )
    }

    let result

    switch (type) {
      case 'collect':
        console.log(`[Execute] Collection for user ${currentUser.userId}`)
        result = await executeCollectionPipeline(currentUser.userId, config)
        break

      case 'transform':
        console.log(`[Execute] Transform for user ${currentUser.userId}`)
        result = await executeTransformPipeline(currentUser.userId, config)
        break

      case 'publish':
        console.log(`[Execute] Publish for user ${currentUser.userId}`)
        if (!config?.retailBandIds?.length) {
          // 자동화 설정에서 retailBandIds 가져오기
          const automationConfig = await prisma.automationConfig.findUnique({
            where: { userId: currentUser.userId },
          })
          if (!automationConfig?.retailBandIds || (automationConfig.retailBandIds as number[]).length === 0) {
            return NextResponse.json(
              { success: false, error: '발행할 소매밴드가 설정되지 않았습니다.' },
              { status: 400 }
            )
          }
        }
        result = await executePublishPipeline(currentUser.userId, config)
        break

      case 'full':
        console.log(`[Execute] Full pipeline for user ${currentUser.userId}`)
        result = await executeFullPipeline(currentUser.userId, config)
        break

      default:
        return NextResponse.json(
          { success: false, error: '잘못된 실행 타입입니다.' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('파이프라인 실행 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message || '파이프라인 실행에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/automation/execute
 * 현재 실행 중인 워크플로우 상태 조회
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const running = await getRunningWorkflow(currentUser.userId)

    return NextResponse.json({
      success: true,
      data: {
        isRunning: !!running,
        workflow: running
          ? {
              id: running.id,
              type: running.workflowType,
              status: running.status,
              startedAt: running.startedAt,
              totalItems: running.totalItems,
              successCount: running.successCount,
              failedCount: running.failedCount,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('실행 상태 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '상태 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
