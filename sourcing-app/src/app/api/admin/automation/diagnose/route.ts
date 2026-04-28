export const dynamic = 'force-dynamic'

/**
 * GET  /api/admin/automation/diagnose
 *   - 현재 사용자의 AutomationConfig 상태 + 메모리에 등록된 cron 스케줄러 목록 반환
 *   - "10시 설정한 cron 이 안 도는데?" 같은 상황 진단용
 *
 * POST /api/admin/automation/diagnose
 *   - body: { action: 'reregister' | 'trigger' }
 *     - reregister: updateScheduler(userId) 재호출 → 메모리 cron 재등록
 *     - trigger:    즉시 한 번 실행 (executeFullPipelineWithLock, type=MANUAL)
 *
 * 의도:
 *   - 컨테이너 재시작/스키마 드리프트/멀티 워커 등으로 cron 이 메모리에서 사라진
 *     상황을 사용자가 직접 확인·복구할 수 있도록.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import * as cron from 'node-cron'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { getActiveSchedulers, updateScheduler } from '@/modules/automation/scheduler'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 명시적 select — 신규 컬럼 미적용 환경 대응
    const config = await prisma.automationConfig.findUnique({
      where: { userId: currentUser.userId },
      select: {
        id: true,
        userId: true,
        isEnabled: true,
        cronExpression: true,
        pipelineSteps: true,
        lastRunAt: true,
        nextRunAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const activeUserIds = getActiveSchedulers()
    const isRegisteredInMemory = activeUserIds.includes(currentUser.userId)

    // node-cron 라이브러리 자체의 task registry 조회 — 어떤 cron 이 살아있는지 확인
    let nodeCronTasks: Array<{ id: string; name: string; status: string; nextRun: string | null }> = []
    try {
      const tasks = (cron as any).getTasks?.() as Map<string, any> | undefined
      if (tasks && typeof tasks.forEach === 'function') {
        tasks.forEach((task: any, key: string) => {
          let nextRun: string | null = null
          try {
            const d = task?.getNextRun?.()
            if (d) nextRun = d instanceof Date ? d.toISOString() : String(d)
          } catch {}
          nodeCronTasks.push({
            id: task?.id || key,
            name: task?.name || '',
            status: typeof task?.getStatus === 'function' ? task.getStatus() : 'unknown',
            nextRun,
          })
        })
      }
    } catch (e) {
      // node-cron v4 API 가 변경되면 여기 catch
    }

    // 최근 워크플로우 실행 이력 (최대 10건) — 단계별 상세 포함
    const recentRuns = await prisma.workflowLog.findMany({
      where: { userId: currentUser.userId },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        workflowType: true,
        triggerType: true,
        status: true,
        currentStep: true,
        startedAt: true,
        completedAt: true,
        totalItems: true,
        successCount: true,
        failedCount: true,
        errorMessage: true,
        steps: {
          select: {
            stepType: true,
            stepOrder: true,
            status: true,
            startedAt: true,
            completedAt: true,
            totalItems: true,
            processedItems: true,
            successCount: true,
            failedCount: true,
            errorMessage: true,
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
    }).catch(() => [])

    // 현재 RUNNING 상태 워크플로우만 별도 추출 (멈춰있는 것 진단용)
    const runningWorkflows = recentRuns.filter((r) => r.status === 'RUNNING')

    // 최근 1시간 내 발행된 ChannelProduct / ShopProduct 카운트 (실제 발행됐는지 검증)
    const recentCutoff = new Date(Date.now() - 60 * 60 * 1000)
    const recentChannelPublishes = await prisma.channelProduct.count({
      where: {
        userId: currentUser.userId,
        publishedAt: { gte: recentCutoff },
      },
    }).catch(() => 0)
    const recentShopPublishes = await prisma.shopProduct.count({
      where: {
        userId: currentUser.userId,
        publishedAt: { gte: recentCutoff },
      },
    }).catch(() => 0)

    return NextResponse.json({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        serverTz: process.env.TZ || 'system default',
        cronTimezone: 'Asia/Seoul', // scheduler.ts 에 하드코딩됨
        config: config
          ? {
              id: config.id,
              userId: config.userId,
              isEnabled: config.isEnabled,
              cronExpression: config.cronExpression,
              pipelineSteps: config.pipelineSteps,
              lastRunAt: config.lastRunAt,
              nextRunAt: config.nextRunAt,
              updatedAt: config.updatedAt,
            }
          : null,
        scheduler: {
          isRegisteredInMemory,
          activeUserIds, // 이 프로세스 activeSchedulers Map 에 등록된 모든 userId
          nodeCronTasks, // node-cron 라이브러리 내부 registry 에 살아있는 task 전체
        },
        runningWorkflows,
        recentRuns,
        recentPublishes: {
          since: recentCutoff.toISOString(),
          channelProducts: recentChannelPublishes,
          shopProducts: recentShopPublishes,
        },
        diagnosis: buildDiagnosis(config, isRegisteredInMemory, runningWorkflows.length),
      },
    })
  } catch (error: any) {
    console.error('[Diagnose] 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '진단 실패' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body?.action

    if (action === 'reregister') {
      // 자동 파이프라인 실행은 하지 않음 — cron 메모리 재등록만.
      // 다음 cron 시각이 도래하면 정상 실행됨.
      await updateScheduler(currentUser.userId)
      const isRegistered = getActiveSchedulers().includes(currentUser.userId)
      return NextResponse.json({
        success: true,
        action,
        message: isRegistered
          ? 'cron 재등록 완료 (메모리에 등록됨, 다음 일정에 자동 실행)'
          : 'cron 등록되지 않음 — isEnabled=false 또는 cronExpression 누락',
        isRegisteredInMemory: isRegistered,
      })
    }

    return NextResponse.json(
      { success: false, error: 'action 은 reregister 만 지원합니다 (트리거는 사용자 요청에 따라 비활성).' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[Diagnose POST] 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '실행 실패' },
      { status: 500 }
    )
  }
}

function buildDiagnosis(
  config: { isEnabled: boolean; cronExpression: string | null } | null,
  isRegisteredInMemory: boolean,
  runningCount: number
): { ok: boolean; reasons: string[]; recommendation: string | null } {
  const reasons: string[] = []
  let recommendation: string | null = null

  if (!config) {
    reasons.push('AutomationConfig 자체가 DB 에 없습니다.')
    recommendation = '자동화 설정 페이지에서 한 번 저장해 주세요.'
    return { ok: false, reasons, recommendation }
  }
  if (!config.isEnabled) {
    reasons.push('자동화가 비활성화 상태입니다 (isEnabled=false).')
    recommendation = '자동화 설정 페이지에서 활성화 토글을 켜주세요.'
  }
  if (!config.cronExpression) {
    reasons.push('cronExpression 이 비어 있습니다.')
    if (!recommendation) recommendation = '자동화 설정에서 시간을 다시 선택하고 저장해주세요.'
  }
  if (config.isEnabled && config.cronExpression && !isRegisteredInMemory) {
    reasons.push(
      'DB 설정은 정상이나 이 프로세스 메모리에는 cron 이 등록돼 있지 않습니다 ' +
        '(컨테이너 재시작 후 초기화 실패, 스키마 드리프트, 또는 다른 워커 프로세스에 등록됨)'
    )
    recommendation = 'POST /api/admin/automation/diagnose body={"action":"reregister"} 로 재등록을 시도하세요.'
  }
  if (config.isEnabled && config.cronExpression && isRegisteredInMemory) {
    reasons.push('정상 — DB 설정 활성 & 메모리 cron 등록 완료. 이미 등록된 cron 이 다음 일정에 실행됩니다.')
  }
  if (runningCount > 0) {
    reasons.push(
      `⚠️ 현재 RUNNING 상태 워크플로우 ${runningCount}건. 정상 진행 중이거나 멈춰있을 수 있음 — runningWorkflows.steps 에서 어느 단계가 stuck 인지 확인하세요.`
    )
    recommendation =
      'DELETE /api/automation/execute?workflowId={id} 로 멈춘 워크플로우를 취소하거나, ' +
      '?cleanup=true 로 30분 이상 stuck 인 워크플로우 일괄 정리.'
  }

  return { ok: reasons.length === 1 && isRegisteredInMemory && runningCount === 0, reasons, recommendation }
}
