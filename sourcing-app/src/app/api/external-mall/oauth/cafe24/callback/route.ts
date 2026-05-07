/**
 * GET /api/external-mall/oauth/cafe24/callback?code=...&state=...
 * 카페24 OAuth 콜백 — 인증 코드를 access_token 으로 교환 후 ExternalMallConnection 생성.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { Cafe24AuthService } from '@/modules/external-mall/connectors/cafe24-auth'

interface StatePayload {
  userId: number
  mallId: string
  ts: number
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const stateRaw = request.nextUrl.searchParams.get('state')
  const errorParam = request.nextUrl.searchParams.get('error')

  if (errorParam) {
    return redirectToConnections(request, `error=${encodeURIComponent(errorParam)}`)
  }
  if (!code || !stateRaw) {
    return redirectToConnections(request, 'error=missing_code_or_state')
  }

  let state: StatePayload
  try {
    state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf-8'))
  } catch {
    return redirectToConnections(request, 'error=invalid_state')
  }

  // state TTL (10분)
  if (Date.now() - state.ts > 10 * 60 * 1000) {
    return redirectToConnections(request, 'error=state_expired')
  }

  // 사용자 검증
  const user = await prisma.user.findUnique({
    where: { id: state.userId },
    select: { id: true, deletedAt: true },
  })
  if (!user || user.deletedAt) {
    return redirectToConnections(request, 'error=invalid_user')
  }

  const origin = request.nextUrl.origin
  const redirectUri = `${origin}/api/external-mall/oauth/cafe24/callback`

  const auth = new Cafe24AuthService()
  let token
  try {
    token = await auth.exchangeToken(state.mallId, code, redirectUri)
  } catch (err: any) {
    console.error('[cafe24/callback] 토큰 교환 실패:', err)
    return redirectToConnections(request, `error=${encodeURIComponent(err.message || 'token_exchange_failed')}`)
  }

  // 기존 연결 있으면 업데이트, 없으면 생성
  const existing = await prisma.externalMallConnection.findFirst({
    where: {
      userId: state.userId,
      platform: 'CAFE24',
      mallId: state.mallId,
      deletedAt: null,
    },
  })

  if (existing) {
    await prisma.externalMallConnection.update({
      where: { id: existing.id },
      data: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt: token.expiresAt,
        isActive: true,
        lastError: null,
      },
    })
    return redirectToConnections(request, `connected=${existing.id}`)
  }

  const created = await prisma.externalMallConnection.create({
    data: {
      userId: state.userId,
      name: `카페24 (${state.mallId})`,
      platform: 'CAFE24',
      purpose: 'both',
      mallId: state.mallId,
      shopUrl: `https://${state.mallId}.cafe24.com`,
      apiBaseUrl: `https://${state.mallId}.cafe24api.com/api/v2`,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenExpiresAt: token.expiresAt,
      isActive: true,
    },
    select: { id: true },
  })

  return redirectToConnections(request, `connected=${created.id}`)
}

function redirectToConnections(request: NextRequest, query: string) {
  return NextResponse.redirect(
    new URL(`/sourcing/external-mall?${query}`, request.url)
  )
}
