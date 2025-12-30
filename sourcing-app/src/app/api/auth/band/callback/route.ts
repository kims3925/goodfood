export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { settingsService } from '@/modules/config/domain/src/settings'

/**
 * Band OAuth 콜백
 * 인증 코드를 받아 Access Token으로 교환하고 저장
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // 에러 처리
    if (error) {
      console.error('[Band OAuth Callback] 인증 거부:', error)
      return redirectWithMessage('error', '사용자가 Band 연동을 거부했습니다.')
    }

    if (!code) {
      return redirectWithMessage('error', '인증 코드가 없습니다.')
    }

    if (!state) {
      return redirectWithMessage('error', 'state 파라미터가 없습니다.')
    }

    // state에서 userId 추출
    let userId: number
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      userId = stateData.userId

      // 타임스탬프 검증 (10분 이내)
      const elapsed = Date.now() - stateData.timestamp
      if (elapsed > 10 * 60 * 1000) {
        return redirectWithMessage('error', '인증 세션이 만료되었습니다. 다시 시도해주세요.')
      }
    } catch {
      return redirectWithMessage('error', '잘못된 state 파라미터입니다.')
    }

    // 환경변수 확인
    const clientId = process.env.BAND_CLIENT_ID
    const clientSecret = process.env.BAND_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return redirectWithMessage('error', 'Band API 환경변수가 설정되지 않았습니다.')
    }

    // 콜백 URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
    const redirectUri = `${baseUrl}/api/auth/band/callback`

    // Access Token 교환
    console.log('[Band OAuth Callback] 토큰 교환 시작...')

    const tokenUrl = new URL('https://auth.band.us/oauth2/token')
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    })

    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    })

    const tokenData = await tokenResponse.json()
    console.log('[Band OAuth Callback] 토큰 응답:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    })

    if (!tokenData.access_token) {
      console.error('[Band OAuth Callback] 토큰 발급 실패:', tokenData)
      return redirectWithMessage('error', `토큰 발급 실패: ${tokenData.error_description || tokenData.error || '알 수 없는 오류'}`)
    }

    // Access Token 저장
    await settingsService.saveApiSettings(userId, 'band', {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresIn: tokenData.expires_in || null,
      tokenType: tokenData.token_type || 'Bearer',
    })

    console.log('[Band OAuth Callback] 토큰 저장 완료, userId:', userId)

    return redirectWithMessage('success', 'Band 연동이 완료되었습니다!')
  } catch (error: any) {
    console.error('[Band OAuth Callback] 처리 실패:', error)
    return redirectWithMessage('error', '토큰 처리 중 오류가 발생했습니다.')
  }
}

/**
 * 설정 페이지로 리다이렉트하며 메시지 전달
 */
function redirectWithMessage(status: 'success' | 'error', message: string) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const redirectUrl = new URL(`${baseUrl}/sourcing/settings/api`)
  redirectUrl.searchParams.set('band_oauth', status)
  redirectUrl.searchParams.set('message', message)

  return NextResponse.redirect(redirectUrl.toString())
}
