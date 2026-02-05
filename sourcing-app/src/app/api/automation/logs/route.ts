export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/automation/logs
 *
 * 자동화 실행 로그 조회
 *
 * Query Parameters:
 * - limit: 조회 개수 (기본값: 10, 최대: 100)
 * - workflowType: 워크플로우 유형 필터 (COLLECTION, TRANSFORM, PRODUCT_CREATE, PUBLISH, FULL)
 * - status: 상태 필터 (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 100)
    const workflowType = searchParams.get('workflowType')
    const status = searchParams.get('status')

    // 필터 조건 구성
    const where: any = {
      userId: currentUser.userId,
    }

    if (workflowType) {
      where.workflowType = workflowType
    }

    if (status) {
      where.status = status
    }

    // 전체 개수 조회
    const totalCount = await prisma.workflowLog.count({ where })
    const totalPages = Math.ceil(totalCount / limit)

    // 로그 조회 (pagination 적용)
    const logs = await prisma.workflowLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
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
        errorMessage: true,
        currentStep: true,
        steps: {
          orderBy: { stepOrder: 'asc' },
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
            details: true,
          },
        },
      },
    })

    // 응답 포맷팅
    const formattedLogs = logs.map(log => {
      // steps의 details를 파싱
      const steps = log.steps.map(step => {
        let parsedDetails = null
        if (step.details) {
          try {
            parsedDetails = typeof step.details === 'string'
              ? JSON.parse(step.details)
              : step.details
          } catch {
            parsedDetails = null
          }
        }

        return {
          stepType: step.stepType,
          stepOrder: step.stepOrder,
          status: step.status,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          duration: step.completedAt && step.startedAt
            ? new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()
            : null,
          totalItems: step.totalItems,
          processedItems: step.processedItems,
          successCount: step.successCount,
          failedCount: step.failedCount,
          progress: step.totalItems > 0
            ? Math.round((step.processedItems / step.totalItems) * 100)
            : 0,
          errorMessage: step.errorMessage,
          details: parsedDetails,
        }
      })

      // steps에서 details 병합하여 기존 형식 유지
      const details: Record<string, any> = {}
      for (const step of steps) {
        const keyMap: Record<string, string> = {
          COLLECTION: 'collection',
          TRANSFORM: 'transform',
          PRODUCT_CREATE: 'productCreate',
          PUBLISH: 'publish',
        }
        const key = keyMap[step.stepType]
        if (key && step.details) {
          details[key] = step.details
        }
      }

      return {
        id: log.id,
        workflowType: log.workflowType,
        workflowTypeLabel: getWorkflowTypeLabel(log.workflowType),
        triggerType: log.triggerType,
        triggerTypeLabel: log.triggerType === 'MANUAL' ? '수동 실행' : '스케줄 실행',
        status: log.status,
        statusLabel: getStatusLabel(log.status),
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        duration: log.completedAt
          ? Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)
          : null,
        totalItems: log.totalItems,
        successCount: log.successCount,
        failedCount: log.failedCount,
        errorMessage: log.errorMessage,
        currentStep: log.currentStep,
        steps,
        details,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        logs: formattedLogs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
        },
      },
    })
  } catch (error: any) {
    console.error('[Automation Logs] 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '로그 조회에 실패했습니다.', detail: error.message },
      { status: 500 }
    )
  }
}

// =============================================
// Helper Functions
// =============================================

function getWorkflowTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    COLLECTION: '게시물 수집',
    TRANSFORM: 'AI 변환',
    PRODUCT_CREATE: '상품 생성',
    PUBLISH: '상품 발행',
    FULL: '전체 파이프라인',
  }
  return labels[type] || type
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: '대기 중',
    RUNNING: '실행 중',
    COMPLETED: '완료',
    FAILED: '실패',
    CANCELLED: '취소됨',
  }
  return labels[status] || status
}
