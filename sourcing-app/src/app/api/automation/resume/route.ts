/**
 * 파이프라인 재개 API
 * 세션 만료로 WAITING_SESSION 상태인 워크플로우를 재개
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import {
  getWaitingSessionWorkflow,
  resumeWorkflow,
  completeWorkflowLog,
  failWorkflowLog,
} from '@/modules/automation/workflow-service'
import { publishService } from '@/modules/publish'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const userId = user.userId

    // 세션 대기 중인 워크플로우 조회
    const waitingWorkflow = await getWaitingSessionWorkflow(userId)

    if (!waitingWorkflow) {
      return NextResponse.json(
        { error: '재개할 수 있는 워크플로우가 없습니다' },
        { status: 404 }
      )
    }

    console.log(`[Resume API] 워크플로우 ${waitingWorkflow.id} 재개 시작`)

    // 워크플로우 상태를 RUNNING으로 변경하고 pendingItems 조회
    const { pendingItems, currentProgress } = await resumeWorkflow(waitingWorkflow.id)

    if (!pendingItems || !pendingItems.productIds || pendingItems.productIds.length === 0) {
      await failWorkflowLog(waitingWorkflow.id, '재개할 항목이 없습니다')
      return NextResponse.json(
        { error: '재개할 항목이 없습니다' },
        { status: 400 }
      )
    }

    // 발행 재시도
    const result = await publishService.publishBatch({
      userId,
      productIds: pendingItems.productIds,
      channelId: pendingItems.channelId,
    })

    // 이전 진행 상황과 합산
    const totalSuccess = (currentProgress?.successCount || 0) + result.successCount
    const totalFailed = (currentProgress?.failedCount || 0) + result.failedCount
    const totalItems = (currentProgress?.totalItems || 0)

    // 세션 만료 에러가 또 발생했는지 확인
    const sessionExpiredError = result.errors.find(e =>
      e.includes('세션') && (e.includes('만료') || e.includes('없'))
    )

    if (sessionExpiredError) {
      // 또 세션 만료 - 다시 WAITING_SESSION 상태로
      const remainingProductIds = pendingItems.productIds.filter(
        id => !result.results.some(r => r.productId === id && r.success)
      )

      await prisma.workflowLog.update({
        where: { id: waitingWorkflow.id },
        data: {
          status: 'WAITING_SESSION',
          details: JSON.stringify({
            waitingSession: true,
            pendingItems: { productIds: remainingProductIds, channelId: pendingItems.channelId },
            currentProgress: { successCount: totalSuccess, failedCount: totalFailed, totalItems },
            waitingSince: new Date().toISOString(),
            retryCount: ((currentProgress as any)?.retryCount || 0) + 1,
          }),
        },
      })

      return NextResponse.json({
        success: false,
        waitingSession: true,
        message: '세션이 여전히 만료 상태입니다. Band에 로그인 후 다시 시도해주세요.',
        progress: { successCount: totalSuccess, failedCount: totalFailed },
      })
    }

    // 완료 처리
    await completeWorkflowLog(
      waitingWorkflow.id,
      result.failedCount === 0,
      totalItems,
      totalSuccess,
      totalFailed,
      {
        resumed: true,
        channelId: pendingItems.channelId,
        results: result.results.slice(-20),
      }
    )

    console.log(`[Resume API] 워크플로우 ${waitingWorkflow.id} 재개 완료 - 성공: ${totalSuccess}, 실패: ${totalFailed}`)

    return NextResponse.json({
      success: true,
      workflowId: waitingWorkflow.id,
      progress: {
        successCount: totalSuccess,
        failedCount: totalFailed,
        totalItems,
      },
      message: `발행 재개 완료: ${result.successCount}개 성공, ${result.failedCount}개 실패`,
    })
  } catch (error: any) {
    console.error('[Resume API] 오류:', error)
    return NextResponse.json(
      { error: error.message || '파이프라인 재개 실패' },
      { status: 500 }
    )
  }
}

/**
 * 세션 대기 중인 워크플로우 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const userId = user.userId

    const waitingWorkflow = await getWaitingSessionWorkflow(userId)

    if (!waitingWorkflow) {
      return NextResponse.json({ waiting: false })
    }

    const details = waitingWorkflow.details
      ? JSON.parse(waitingWorkflow.details as string)
      : {}

    return NextResponse.json({
      waiting: true,
      workflowId: waitingWorkflow.id,
      pendingItems: details.pendingItems,
      currentProgress: details.currentProgress,
      waitingSince: details.waitingSince,
    })
  } catch (error: any) {
    console.error('[Resume API] GET 오류:', error)
    return NextResponse.json(
      { error: error.message || '조회 실패' },
      { status: 500 }
    )
  }
}
