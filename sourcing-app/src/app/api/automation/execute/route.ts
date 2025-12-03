/**
 * Automation Execute API
 * 자동화 파이프라인 수동 실행
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { WorkflowType } from '@bandauto/db'
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

/**
 * 자동화 설정 검증 결과
 */
interface ConfigValidationResult {
  isValid: boolean
  error?: string
  missingItems: string[]
}

/**
 * 파이프라인 실행 전 설정 검증
 */
async function validateAutomationConfig(
  userId: number,
  type: 'collect' | 'transform' | 'register' | 'publish' | 'full'
): Promise<ConfigValidationResult> {
  const automationConfig = await prisma.automationConfig.findUnique({
    where: { userId },
    include: { pricingPolicy: true },
  })

  const missingItems: string[] = []

  // 자동화 설정 자체가 없는 경우
  if (!automationConfig) {
    return {
      isValid: false,
      error: '자동화 설정이 없습니다. 먼저 설정 페이지에서 기본 설정을 완료해주세요.',
      missingItems: ['자동화 설정'],
    }
  }

  // 수집(collect) 검증
  if (type === 'collect' || type === 'full') {
    let channelIds: number[] = []
    if (automationConfig.channelIds) {
      try {
        channelIds = JSON.parse(automationConfig.channelIds)
      } catch {
        channelIds = []
      }
    }
    if (channelIds.length === 0) {
      missingItems.push('수집할 도매채널')
    }
  }

  // 변환(transform) 및 상품등록(register) 검증
  if (type === 'transform' || type === 'register' || type === 'full') {
    if (!automationConfig.aiProvider) {
      missingItems.push('AI 제공자')
    }
  }

  // 발행(publish) 검증
  if (type === 'publish' || type === 'full') {
    let retailChannelIds: number[] = []
    if (automationConfig.retailChannelIds) {
      try {
        retailChannelIds = JSON.parse(automationConfig.retailChannelIds)
      } catch {
        retailChannelIds = []
      }
    }
    if (retailChannelIds.length === 0) {
      missingItems.push('발행할 소매채널')
    }
  }

  if (missingItems.length > 0) {
    const typeNames: Record<string, string> = {
      collect: '게시물 수집',
      transform: 'AI 변환',
      register: '상품 등록',
      publish: '발행',
      full: '전체 실행',
    }
    return {
      isValid: false,
      error: `${typeNames[type]}을 실행하려면 다음 설정이 필요합니다: ${missingItems.join(', ')}. 설정 페이지에서 먼저 설정해주세요.`,
      missingItems,
    }
  }

  return { isValid: true, missingItems: [] }
}

/**
 * POST /api/automation/execute
 * 파이프라인 수동 실행
 *
 * Request Body:
 * - type: 'collect' | 'transform' | 'register' | 'publish' | 'full'
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
          error: '이미 실행 중인 워크플로우가 있습니다. 완료될 때까지 기다려주세요.',
          runningWorkflow: {
            id: running.id,
            type: running.workflowType,
            startedAt: running.startedAt,
          },
        },
        { status: 409 }
      )
    }

    // 설정 검증 (config가 명시적으로 제공된 경우는 검증 스킵)
    const hasExplicitConfig = type === 'collect' ? config?.channelIds?.length > 0 :
                             type === 'publish' ? config?.channelIds?.length > 0 :
                             false

    if (!hasExplicitConfig) {
      const validation = await validateAutomationConfig(currentUser.userId, type)
      if (!validation.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: validation.error,
            missingItems: validation.missingItems,
          },
          { status: 400 }
        )
      }
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

      case 'register':
        // register는 transform과 동일한 파이프라인 (AI 변환 + 상품 등록)
        console.log(`[Execute] Register (transform) for user ${currentUser.userId}`)
        result = await executeTransformPipeline(currentUser.userId, config)
        break

      case 'publish':
        console.log(`[Execute] Publish for user ${currentUser.userId}`)
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
