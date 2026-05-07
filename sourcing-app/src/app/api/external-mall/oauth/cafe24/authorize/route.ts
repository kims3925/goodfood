/**
 * GET /api/external-mall/oauth/cafe24/authorize?mallId=XXX
 * 카페24 OAuth 인증 페이지로 리다이렉트.
 *
 * state 에 userId+mallId 인코딩 → 콜백에서 본인 확인.
 * 환경변수 CAFE24_CLIENT_ID/SECRET 미설정 시 안내 페이지.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { Cafe24AuthService } from '@/modules/external-mall/connectors/cafe24-auth'

export async function GET(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const mallId = request.nextUrl.searchParams.get('mallId')
  if (!mallId || !/^[a-z0-9-]{2,20}$/i.test(mallId)) {
    return NextResponse.json(
      { success: false, error: 'mallId 쿼리 파라미터가 필요합니다 (영소문자/숫자/하이픈).' },
      { status: 400 }
    )
  }

  const auth = new Cafe24AuthService()
  if (!auth.isConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          'CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET 환경변수 미설정. 운영 .env 에 등록 후 컨테이너 재시작 필요.',
        code: 'CAFE24_OAUTH_NOT_CONFIGURED',
      },
      { status: 500 }
    )
  }

  const origin = request.nextUrl.origin
  const redirectUri = `${origin}/api/external-mall/oauth/cafe24/callback`
  const state = Buffer.from(
    JSON.stringify({ userId: me.userId, mallId, ts: Date.now() })
  ).toString('base64url')

  const authUrl = auth.getAuthorizationUrl(mallId, redirectUri, state)
  return NextResponse.redirect(authUrl)
}
