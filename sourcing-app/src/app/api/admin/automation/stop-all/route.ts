export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/automation/stop-all
 *
 * 사용자의 모든 진행 중인 발행/자동화 작업을 즉시 중단.
 *
 * 처리 항목:
 *  1. RUNNING 상태 workflow_log 행 모두 FAILED 로 마킹 (executor 가 다음 체크 시 종료)
 *  2. 메모리 cron 스케줄러 unregister — 다음 일정 발화 차단
 *  3. (선택) AutomationConfig.isEnabled=false 로 영구 비활성화 (body.disable=true 일 때만)
 *
 * 한계:
 *  - 클라이언트 측 setTimeout 으로 예약된 1분/N분 후 발행 (delayed-publish.ts) 은 브라우저
 *    안에서 도는 타이머라 서버에서 직접 못 멈춤. 사용자가 페이지에서 "예약 취소" 버튼을
 *    누르거나 탭을 닫으면 됨.
 *  - 이미 Playwright 가 Band 페이지를 열어 발행 중인 게시글은 해당 한 건은 끝까지 진행
 *    (Playwright 자체 인터럽트는 미지원). 다음 게시글부터 멈춤.
 *
 * 다시 켜기:
 *  - body.disable=true 로 호출했다면 자동화 설정 페이지에서 토글 다시 켜야 함
 *  - 끄지 않았다면 다음 컨테이너 재시작 시 initializeScheduler 가 다시 등록
 *  - 또는 POST /api/admin/automation/diagnose body={"action":"reregister"} 로 즉시 재등록
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { WorkflowStatus } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { unregisterScheduler, getActiveSchedulers } from '@/modules/automation/scheduler'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const disable = !!body?.disable // true 면 AutomationConfig.isEnabled 도 false 로

    // 1) RUNNING 상태 워크플로우 모두 FAILED 처리
    // executor 의 checkCancellation() 이 다음 단계에서 이 상태를 보고 중단함.
    const runningWorkflows = await prisma.workflowLog.findMany({
      where: {
        userId: currentUser.userId,
        status: WorkflowStatus.RUNNING,
      },
      select: { id: true, workflowType: true, currentStep: true, startedAt: true },
    })

    let cancelledCount = 0
    if (runningWorkflows.length > 0) {
      const result = await prisma.workflowLog.updateMany({
        where: {
          userId: currentUser.userId,
          status: WorkflowStatus.RUNNING,
        },
        data: {
          status: WorkflowStatus.FAILED,
          completedAt: new Date(),
          errorMessage: '사용자 stop-all 요청으로 취소됨',
        },
      })
      cancelledCount = result.count

      // 진행 중이던 step 도 모두 FAILED 로 (워크플로우만 취소하고 step 은 RUNNING 으로 남으면 통계 깨짐)
      await prisma.workflowStepLog.updateMany({
        where: {
          workflowId: { in: runningWorkflows.map((w) => w.id) },
          status: { in: ['RUNNING', 'PENDING'] as any },
        },
        data: {
          status: 'FAILED' as any,
          completedAt: new Date(),
          errorMessage: 'stop-all 로 취소됨',
        },
      }).catch(() => null)
    }

    // 2) cron 스케줄러 메모리 해제 — 다음 일정 발화 차단
    const wasRegistered = getActiveSchedulers().includes(currentUser.userId)
    unregisterScheduler(currentUser.userId)

    // 3) 선택: AutomationConfig 비활성화
    let disabled = false
    if (disable) {
      try {
        await prisma.automationConfig.update({
          where: { userId: currentUser.userId },
          data: { isEnabled: false },
        })
        disabled = true
      } catch (e) {
        console.warn('[stop-all] AutomationConfig 비활성화 실패 (config 없음 가능):', e)
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        cancelledWorkflows: cancelledCount,
        cronUnregistered: wasRegistered,
        configDisabled: disabled,
      },
      cancelledWorkflowDetails: runningWorkflows,
      note:
        '⚠️ 클라이언트 측 setTimeout(예약발행)은 브라우저 안 타이머라 서버에서 직접 멈출 수 없습니다. ' +
        '해당 페이지의 "예약 취소" 버튼을 누르거나 탭을 닫으면 됩니다. ' +
        (disable
          ? '자동화 isEnabled=false 로 비활성화됐으므로 다음 컨테이너 재시작 후에도 cron 미등록.'
          : 'isEnabled 는 그대로라 컨테이너 재시작 시 cron 이 다시 등록될 수 있음. ' +
            '영구 중단하려면 body={"disable":true} 로 호출.'),
    })
  } catch (error: any) {
    console.error('[stop-all] 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '중단 실패' },
      { status: 500 }
    )
  }
}
