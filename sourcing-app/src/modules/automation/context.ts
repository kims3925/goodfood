/**
 * Batch Context
 * 배치 작업에서 사용자 컨텍스트 관리
 *
 * 일반 API 요청은 쿠키 기반 인증을 사용하지만,
 * 배치 작업은 스케줄러에서 실행되므로 쿠키가 없음.
 * BatchContext를 통해 사용자 정보를 주입하여 처리.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import prisma, { WorkflowStatus } from '@bandauto/db'
import { BatchContext } from './types'

// =============================================
// BATCH CONTEXT STORAGE (AsyncLocalStorage)
// =============================================
// Phase 2: Node.js AsyncLocalStorage 로 요청별 격리.
// 다중 사용자가 동시에 자동화 실행 시 컨텍스트 덮어씌움 방지.

const contextStorage = new AsyncLocalStorage<BatchContext>()

// 레거시 setBatchContext 호출 시에만 사용되는 globalThis 폴백 (제거 예정)
function getLegacyContext(): BatchContext | null {
  return ((globalThis as any).__legacyBatchContext as BatchContext | undefined) ?? null
}

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
 * @deprecated Phase 2: withBatchContext 사용. 동시성 안전 X.
 * 호출자가 남아있어 BC 를 위해 globalThis 에 임시 저장.
 */
export function setBatchContext(context: BatchContext): void {
  ;(globalThis as any).__legacyBatchContext = context
}

/**
 * 배치 컨텍스트 가져오기 — AsyncLocalStorage 우선, 폴백으로 legacy globalThis.
 * 새 호출 경로(withBatchContext)는 격리된 store, 옛 setBatchContext 경로는 글로벌 공유.
 */
export function getBatchContext(): BatchContext | null {
  return contextStorage.getStore() ?? getLegacyContext()
}

/**
 * @deprecated Phase 2: withBatchContext 사용 시 자동으로 정리됨.
 */
export function clearBatchContext(): void {
  ;(globalThis as any).__legacyBatchContext = null
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
 * 배치 컨텍스트 내에서 작업 실행 (Phase 2: AsyncLocalStorage)
 * 다중 사용자가 동시에 호출해도 각자의 fn 콜백 내에서 자기 context 만 접근.
 */
export async function withBatchContext<T>(
  context: BatchContext,
  fn: () => Promise<T>
): Promise<T> {
  return contextStorage.run(context, fn)
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
