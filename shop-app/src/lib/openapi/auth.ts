/**
 * 오픈 API v1 공통 인증/제한 (B2B 공급몰 전환 STEP 4-2, 카페24 호환 패턴)
 *
 * 모든 /api/v1/** 엔드포인트에서 사용:
 * 1. Authorization: Bearer {accessToken} 검증 (2시간 만료, DB ApiToken)
 * 2. scope 검사 ("products:read,orders:write,orders:read")
 * 3. rate limit — Redis 고정 윈도(분당 client.rateLimit, 기본 60).
 *    Redis 불가 시 인메모리 폴백 (단일 인스턴스 한정).
 * 4. ApiCallLog 기록은 logApiCall() — 응답 직전 비차단 호출.
 *
 * 응답 규격: 에러 { error: { code, message } } — 카페24 스타일.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getRedisClient } from '@/lib/redis'

export interface ApiAuthContext {
  clientId: number      // ApiClient.id (내부 PK)
  clientKey: string     // ApiClient.clientId (외부 노출 키)
  userId: number        // 소유 B2B 판매자 userId
  scopes: string[]
  rateLimit: number
  startedAt: number
}

export type ApiScope = 'products:read' | 'orders:read' | 'orders:write'

export function apiError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status })
}

// Redis 불가 시 인메모리 폴백 (프로세스 로컬)
const memoryWindow = new Map<string, { count: number; windowStart: number }>()

async function checkRateLimit(clientPk: number, limit: number): Promise<boolean> {
  const windowKey = `openapi:rl:${clientPk}:${Math.floor(Date.now() / 60000)}`
  const redis = await getRedisClient()
  if (redis) {
    try {
      const count = await redis.incr(windowKey)
      if (count === 1) await redis.expire(windowKey, 70)
      return count <= limit
    } catch {
      // Redis 오류 시 인메모리 폴백으로 계속
    }
  }
  const now = Date.now()
  const entry = memoryWindow.get(String(clientPk))
  if (!entry || now - entry.windowStart >= 60000) {
    memoryWindow.set(String(clientPk), { count: 1, windowStart: now })
    return true
  }
  entry.count++
  return entry.count <= limit
}

/**
 * Bearer 토큰 인증 + scope + rate limit.
 * 실패 시 NextResponse(에러), 성공 시 ApiAuthContext 반환.
 */
export async function authenticateApiRequest(
  req: NextRequest,
  requiredScope: ApiScope
): Promise<ApiAuthContext | NextResponse> {
  const startedAt = Date.now()

  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+([A-Za-z0-9_-]{16,64})$/i)
  if (!match) {
    return apiError(401, 'UNAUTHORIZED', 'Authorization: Bearer {access_token} 헤더가 필요합니다.')
  }
  const accessToken = match[1]

  const token = await prisma.apiToken.findUnique({
    where: { accessToken },
    include: {
      client: {
        select: {
          id: true,
          clientId: true,
          userId: true,
          scopes: true,
          rateLimit: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  })

  if (!token || !token.client || token.client.deletedAt || !token.client.isActive) {
    return apiError(401, 'INVALID_TOKEN', '유효하지 않은 토큰입니다.')
  }
  if (token.expiresAt < new Date()) {
    return apiError(401, 'TOKEN_EXPIRED', '토큰이 만료되었습니다. /api/v1/oauth/token 으로 재발급하세요.')
  }

  const scopes = token.client.scopes.split(',').map((s) => s.trim()).filter(Boolean)
  if (!scopes.includes(requiredScope)) {
    return apiError(403, 'INSUFFICIENT_SCOPE', `이 작업에는 '${requiredScope}' scope 가 필요합니다.`)
  }

  const allowed = await checkRateLimit(token.client.id, token.client.rateLimit)
  if (!allowed) {
    return apiError(429, 'RATE_LIMIT_EXCEEDED', `분당 요청 한도(${token.client.rateLimit})를 초과했습니다.`)
  }

  return {
    clientId: token.client.id,
    clientKey: token.client.clientId,
    userId: token.client.userId,
    scopes,
    rateLimit: token.client.rateLimit,
    startedAt,
  }
}

/** 호출 로그 기록 (비차단 — 실패해도 응답에 영향 없음) */
export function logApiCall(
  ctx: ApiAuthContext,
  req: NextRequest,
  statusCode: number
): void {
  const durationMs = Date.now() - ctx.startedAt
  const path = new URL(req.url).pathname.slice(0, 255)
  prisma.apiCallLog
    .create({
      data: { clientId: ctx.clientId, method: req.method, path, statusCode, durationMs },
    })
    .catch(() => {})
}

/** 페이지네이션 파라미터 파싱 (limit 1~100 기본 20, offset ≥0) */
export function parsePagination(req: NextRequest): { limit: number; offset: number } {
  const sp = new URL(req.url).searchParams
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20', 10) || 20))
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0)
  return { limit, offset }
}
