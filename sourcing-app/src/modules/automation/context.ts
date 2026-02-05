/**
 * Batch Context
 * 배치 작업에서 사용자 컨텍스트 관리
 *
 * 일반 API 요청은 쿠키 기반 인증을 사용하지만,
 * 배치 작업은 스케줄러에서 실행되므로 쿠키가 없음.
 * BatchContext를 통해 사용자 정보를 주입하여 처리.
 */

import prisma, { WorkflowStatus } from '@bandauto/db'
import { BatchContext } from './types'

// =============================================
// BATCH CONTEXT STORAGE (AsyncLocalStorage alternative)
// =============================================

let currentContext: BatchContext | null = null

// =============================================
// CANCELLATION CHECK
// =============================================

/**
 * 현재 워크플로우가 취소되었는지 확인
 * 각 파이프라인 단계에서 주기적으로 호출하여 취소 시 즉시 중단
 */
export async function checkCancellation(): Promise<boolean> {
  const context = getBatchContext()
  if (!context?.workflowLogId) {
    return false
  }

  const workflow = await prisma.workflowLog.findUnique({
    where: { id: context.workflowLogId },
    select: { status: true },
  })

  // workflow가 없으면 취소로 처리하지 않음
  if (!workflow) {
    return false
  }

  // 명시적으로 FAILED 상태인 경우만 취소로 간주
  // (사용자가 취소 버튼을 누르면 FAILED로 변경됨)
  return workflow.status === WorkflowStatus.FAILED
}

/**
 * 취소 체크 후 취소되었으면 에러 throw
 * 파이프라인에서 간단히 호출 가능
 */
export async function throwIfCancelled(): Promise<void> {
  if (await checkCancellation()) {
    throw new CancellationError('워크플로우가 사용자에 의해 취소되었습니다')
  }
}

/**
 * 취소 에러 클래스
 */
export class CancellationError extends Error {
  constructor(message: string = '워크플로우가 취소되었습니다') {
    super(message)
    this.name = 'CancellationError'
  }
}

/**
 * 배치 컨텍스트 설정
 * 배치 작업 시작 전에 호출
 */
export function setBatchContext(context: BatchContext): void {
  currentContext = context
}

/**
 * 배치 컨텍스트 가져오기
 */
export function getBatchContext(): BatchContext | null {
  return currentContext
}

/**
 * 배치 컨텍스트 클리어
 * 배치 작업 완료 후 호출
 */
export function clearBatchContext(): void {
  currentContext = null
}

// =============================================
// CONTEXT HELPERS
// =============================================

/**
 * 사용자 ID로 배치 컨텍스트 생성
 */
export async function createBatchContextFromUserId(userId: number): Promise<BatchContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      automationConfig: {
        select: { id: true, shopIds: true }
      }
    }
  })

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // Parse shopIds from JSON string
  let shopIds: number[] = []
  try {
    shopIds = user.automationConfig?.shopIds
      ? JSON.parse(user.automationConfig.shopIds)
      : []
  } catch { shopIds = [] }

  return {
    userId: user.id,
    email: user.email,
    automationConfigId: user.automationConfig?.id,
    shopIds
  }
}

/**
 * 자동화 설정이 활성화된 모든 사용자 컨텍스트 가져오기
 */
export async function getActiveAutomationContexts(): Promise<BatchContext[]> {
  const configs = await prisma.automationConfig.findMany({
    where: {
      isEnabled: true
    },
    include: {
      user: {
        select: {
          id: true,
          email: true
        }
      }
    }
  })

  return configs.map(config => {
    // Parse shopIds from JSON string
    let shopIds: number[] = []
    try {
      shopIds = config.shopIds ? JSON.parse(config.shopIds) : []
    } catch { shopIds = [] }

    return {
      userId: config.user.id,
      email: config.user.email,
      automationConfigId: config.id,
      shopIds
    }
  })
}

// =============================================
// EXECUTION WRAPPER
// =============================================

/**
 * 배치 컨텍스트 내에서 작업 실행
 * 자동으로 컨텍스트 설정 및 정리
 */
export async function withBatchContext<T>(
  context: BatchContext,
  fn: () => Promise<T>
): Promise<T> {
  try {
    setBatchContext(context)
    return await fn()
  } finally {
    clearBatchContext()
  }
}

/**
 * 사용자 ID로 배치 컨텍스트 생성 후 작업 실행
 */
export async function withUserContext<T>(
  userId: number,
  fn: () => Promise<T>
): Promise<T> {
  const context = await createBatchContextFromUserId(userId)
  return withBatchContext(context, fn)
}
