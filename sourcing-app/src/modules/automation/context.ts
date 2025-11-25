/**
 * Batch Context
 * 배치 작업에서 사용자 컨텍스트 관리
 *
 * 일반 API 요청은 쿠키 기반 인증을 사용하지만,
 * 배치 작업은 스케줄러에서 실행되므로 쿠키가 없음.
 * BatchContext를 통해 사용자 정보를 주입하여 처리.
 */

import { PrismaClient } from '@prisma/client'
import { BatchContext } from './types'

const prisma = new PrismaClient()

// =============================================
// BATCH CONTEXT STORAGE (AsyncLocalStorage alternative)
// =============================================

let currentContext: BatchContext | null = null

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
        select: { id: true }
      }
    }
  })

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  return {
    userId: user.id,
    email: user.email,
    automationConfigId: user.automationConfig?.id
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

  return configs.map(config => ({
    userId: config.user.id,
    email: config.user.email,
    automationConfigId: config.id
  }))
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
