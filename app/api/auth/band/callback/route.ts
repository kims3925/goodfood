import { NextRequest, NextResponse } from 'next/server'

/**
 * 네이버 밴드 OAuth 콜백 처리 엔드포인트
 * GET /api/auth/band/callback?code=xxx&state=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    console.log('🔄 네이버 밴드 OAuth 콜백 처리 시작...')
    console.log('📝 받은 파라미터:', { code: code?.slice(0, 10) + '...', state, error })

    // 에러 처리
    if (error) {
      console.error('❌ OAuth 인증 에러:', error, errorDescription)
      
      return NextResponse.json({
        success: false,
        error: `OAuth 인증 실패: ${error}`,
        description: errorDescription,
        suggestions: [
          '사용자가 권한을 거부했을 수 있습니다.',
          '다시 인증을 시도해주세요.'
        ]
      }, { status: 400 })
    }

    if (!code) {
      return NextResponse.json({
        success: false,
        error: '인증 코드가 없습니다.',
        received_params: Object.fromEntries(searchParams.entries())
      }, { status: 400 })
    }

    // 환경 변수 확인
    const clientId = process.env.BAND_CLIENT_ID
    const clientSecret = process.env.BAND_CLIENT_SECRET
    const redirectUri = process.env.BAND_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({
        success: false,
        error: '네이버 밴드 OAuth 설정이 완료되지 않았습니다.',
        missing: {
          clientId: !clientId,
          clientSecret: !clientSecret, 
          redirectUri: !redirectUri
        }
      }, { status: 500 })
    }

    // 액세스 토큰 교환 (밴드 API 공식 방식)
    console.log('🔄 인증 코드를 액세스 토큰으로 교환 중...')
    
    // Basic Authentication 헤더 생성
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    const tokenResponse = await fetch('https://auth.band.us/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ 토큰 교환 HTTP 에러:', tokenResponse.status, errorText)
      
      return NextResponse.json({
        success: false,
        error: `토큰 교환 실패: HTTP ${tokenResponse.status}`,
        details: errorText
      }, { status: 500 })
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ 토큰 교환 성공:', {
      access_token: tokenData.access_token?.slice(0, 20) + '...',
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in
    })

    if (tokenData.error) {
      return NextResponse.json({
        success: false,
        error: `토큰 교환 실패: ${tokenData.error}`,
        description: tokenData.error_description
      }, { status: 400 })
    }

    // 새로운 액세스 토큰으로 밴드 목록 테스트
    console.log('🧪 새로운 토큰으로 밴드 API 테스트...')
    
    const testResponse = await fetch('https://openapi.band.us/v2.1/bands', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    })

    let bandTestResult = null
    if (testResponse.ok) {
      const testData = await testResponse.json()
      bandTestResult = {
        success: true,
        bandsCount: testData.result_data?.bands?.length || 0,
        message: 'OAuth 토큰으로 밴드 API 접근 성공!'
      }
      console.log('✅ 밴드 API 테스트 성공:', bandTestResult)
    } else {
      const errorText = await testResponse.text()
      bandTestResult = {
        success: false,
        error: `HTTP ${testResponse.status}`,
        details: errorText
      }
      console.warn('⚠️ 밴드 API 테스트 실패:', bandTestResult)
    }

    // 성공 페이지로 리다이렉트 (토큰 정보 포함)
    const successUrl = new URL('/auth/band/success', request.url)
    successUrl.searchParams.append('token', tokenData.access_token)
    successUrl.searchParams.append('expires', tokenData.expires_in.toString())

    return NextResponse.json({
      success: true,
      message: '네이버 밴드 OAuth 인증 성공!',
      data: {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope
      },
      bandApiTest: bandTestResult,
      next_steps: [
        '1. 이 access_token을 .env.local의 BAND_ACCESS_TOKEN에 업데이트하세요.',
        '2. 새로운 토큰으로 게시물 수집 테스트를 시도하세요.',
        '3. refresh_token을 안전한 곳에 저장하여 토큰 갱신에 사용하세요.'
      ],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ OAuth 콜백 처리 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}