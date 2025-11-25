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
  cancelWorkflow,
  cleanupStaleWorkflows,
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

/**
 * DELETE /api/automation/execute
 * 실행 중인 워크플로우 취소
 *
 * Query Params:
 * - workflowId: 취소할 워크플로우 ID (없으면 현재 실행 중인 워크플로우 취소)
 * - cleanup: 'true'인 경우 오래된 stuck 워크플로우 정리
 */
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const workflowIdParam = searchParams.get('workflowId')
    const cleanup = searchParams.get('cleanup') === 'true'

    // 오래된 워크플로우 정리 모드
    if (cleanup) {
      const cleanedCount = await cleanupStaleWorkflows(currentUser.userId, 30)
      return NextResponse.json({
        success: true,
        data: {
          cleanedCount,
          message: cleanedCount > 0
            ? `${cleanedCount}개의 오래된 워크플로우가 정리되었습니다.`
            : '정리할 워크플로우가 없습니다.',
        },
      })
    }

    // 특정 워크플로우 취소
    let workflowId: number | null = null

    if (workflowIdParam) {
      workflowId = parseInt(workflowIdParam, 10)
      if (isNaN(workflowId)) {
        return NextResponse.json(
          { success: false, error: '잘못된 워크플로우 ID입니다.' },
          { status: 400 }
        )
      }
    } else {
      // 현재 실행 중인 워크플로우 찾기
      const running = await getRunningWorkflow(currentUser.userId)
      if (!running) {
        return NextResponse.json(
          { success: false, error: '실행 중인 워크플로우가 없습니다.' },
          { status: 404 }
        )
      }
      workflowId = running.id
    }

    const cancelled = await cancelWorkflow(workflowId, currentUser.userId)

    if (!cancelled) {
      return NextResponse.json(
        { success: false, error: '워크플로우를 취소할 수 없습니다. 이미 완료되었거나 존재하지 않습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        workflowId,
        message: '워크플로우가 취소되었습니다.',
      },
    })
  } catch (error) {
    console.error('워크플로우 취소 실패:', error)
    return NextResponse.json(
      { success: false, error: '워크플로우 취소에 실패했습니다.' },
      { status: 500 }
    )
  }
}
