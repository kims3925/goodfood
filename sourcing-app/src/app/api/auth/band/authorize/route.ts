export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * Band OAuth 인증 시작
 * 사용자를 Band 로그인 페이지로 리다이렉트
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

    const clientId = process.env.BAND_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'BAND_CLIENT_ID 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // 콜백 URL 결정 (환경에 따라)
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
    const redirectUri = `${baseUrl}/api/auth/band/callback`

    // state 파라미터에 userId 포함 (CSRF 방지 및 사용자 식별)
    const state = Buffer.from(JSON.stringify({
      userId: currentUser.userId,
      timestamp: Date.now(),
    })).toString('base64')

    // Band OAuth 인증 URL 생성
    const authUrl = new URL('https://auth.band.us/oauth2/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)

    console.log('[Band OAuth] Redirecting to:', authUrl.toString())

    return NextResponse.redirect(authUrl.toString())
  } catch (error: any) {
    console.error('[Band OAuth] 인증 시작 실패:', error)
    return NextResponse.json(
      { success: false, error: '인증 시작에 실패했습니다.' },
      { status: 500 }
    )
  }
}
