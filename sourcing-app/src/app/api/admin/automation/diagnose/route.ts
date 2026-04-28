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
import prisma, { TriggerType } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { getActiveSchedulers, updateScheduler } from '@/modules/automation/scheduler'
import { executeFullPipelineWithLock } from '@/modules/automation/executor'

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

    // 최근 워크플로우 실행 이력 (최대 10건)
    const recentRuns = await prisma.workflowLog.findMany({
      where: { userId: currentUser.userId },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        workflowType: true,
        triggerType: true,
        status: true,
        startedAt: true,
        completedAt: true,
        totalItems: true,
        successCount: true,
        failedCount: true,
      },
    }).catch(() => [])

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
          activeUserIds, // 이 프로세스에 등록된 모든 userId
        },
        recentRuns,
        diagnosis: buildDiagnosis(config, isRegisteredInMemory),
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
      await updateScheduler(currentUser.userId)
      const isRegistered = getActiveSchedulers().includes(currentUser.userId)
      return NextResponse.json({
        success: true,
        action,
        message: isRegistered
          ? 'cron 재등록 완료 (메모리에 등록됨)'
          : 'cron 등록되지 않음 — isEnabled=false 또는 cronExpression 누락',
        isRegisteredInMemory: isRegistered,
      })
    }

    if (action === 'trigger') {
      console.log(`[Diagnose] 수동 트리거 시작 (user: ${currentUser.userId})`)
      const result = await executeFullPipelineWithLock(
        currentUser.userId,
        undefined,
        TriggerType.MANUAL
      )
      return NextResponse.json({
        success: true,
        action,
        message: result ? '실행 완료' : 'Lock 획득 실패 (이미 실행 중)',
        result,
      })
    }

    return NextResponse.json(
      { success: false, error: 'action 은 reregister 또는 trigger 여야 합니다.' },
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
  isRegisteredInMemory: boolean
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

  return { ok: reasons.length === 1 && isRegisteredInMemory, reasons, recommendation }
}
