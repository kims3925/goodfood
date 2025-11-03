import { NextRequest, NextResponse } from 'next/server'

/**
 * 네이버 밴드 OAuth 인증 시작 엔드포인트
 * GET /api/auth/band
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.BAND_CLIENT_ID
    const redirectUri = process.env.BAND_REDIRECT_URI
    
    if (!clientId || !redirectUri) {
      return NextResponse.json({
        success: false,
        error: '네이버 밴드 OAuth 설정이 완료되지 않았습니다.',
        required: ['BAND_CLIENT_ID', 'BAND_REDIRECT_URI']
      }, { status: 500 })
    }

    // 밴드 OAuth 인증 URL 생성 (공식 문서 기준)
    const authUrl = new URL('https://auth.band.us/oauth2/authorize')
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    // 밴드 API는 scope 파라미터가 필요 없음 (공식 문서 확인)

    console.log('🔗 네이버 밴드 OAuth 인증 URL 생성:', authUrl.toString())

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
      message: '이 URL로 이동하여 밴드 접근 권한을 허가해주세요.',
      instructions: [
        '1. authUrl로 이동',
        '2. 네이버 로그인',
        '3. 밴드 앱 접근 권한 허가',
        '4. 자동으로 콜백 URL로 리다이렉트됩니다.'
      ]
    })

  } catch (error) {
    console.error('❌ 밴드 OAuth 인증 URL 생성 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}