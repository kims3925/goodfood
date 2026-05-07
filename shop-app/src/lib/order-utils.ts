/**
 * 주문 관련 공통 유틸 (Phase 7 — 작업지침서)
 * 5개 route 파일에 중복되던 generateOrderNumber/getCurrentUserId/getSessionId 통합.
 *
 * 주의: payments/retry/route.ts 의 generateOrderNumber 는 다른 포맷(YY/MM/DD/HH 기반)이라
 *      운영 데이터 호환성을 위해 별도 유지. 본 모듈은 prepare/bank-transfer 계열 통일.
 */

import { NextRequest } from 'next/server'

/** 회원 주문번호 — `ORD-YYYYMMDD-XXXXXX` */
export function generateOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ORD-${dateStr}-${random}`
}

/** 비회원 주문번호 — `GORD-YYYYMMDD-XXXXXX` */
export function generateGuestOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `GORD-${dateStr}-${random}`
}

/**
 * 현재 로그인 사용자 ID (NextAuth 세션 기반).
 * @returns userId 또는 null (비로그인)
 */
export async function getCurrentUserId(): Promise<number | null> {
  try {
    const { getServerSession } = await import('next-auth')
    const { authOptions } = await import('@/modules/auth/auth.config')
    const session = await getServerSession(authOptions)
    const id = (session as any)?.user?.id
    if (!id) return null
    return typeof id === 'string' ? parseInt(id) : id
  } catch {
    return null
  }
}

/** 장바구니 세션 ID 쿠키 추출 */
export function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
}
