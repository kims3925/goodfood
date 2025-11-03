import { NextRequest, NextResponse } from 'next/server'

/**
 * 수동 토큰 교환 API
 * POST /api/test/band/manual-token
 * Body: { code: "authorization_code" }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 수동 토큰 교환 시작...')
    
    const { code } = await request.json()
    
    if (!code) {
      return NextResponse.json({
        success: false,
        error: 'Authorization code가 필요합니다.',
        usage: 'POST /api/test/band/manual-token with { "code": "your_authorization_code" }'
      }, { status: 400 })
    }
    
    const clientId = process.env.BAND_CLIENT_ID
    const clientSecret = process.env.BAND_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        success: false,
        error: 'Client credentials가 설정되지 않았습니다.'
      }, { status: 500 })
    }
    
    console.log('🔑 토큰 교환 요청 중...')
    console.log('Authorization Code:', code.substring(0, 20) + '...')
    
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
    
    console.log('📡 토큰 서버 응답 상태:', tokenResponse.status)
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ 토큰 교환 HTTP 에러:', tokenResponse.status, errorText)
      
      return NextResponse.json({
        success: false,
        error: `토큰 교환 실패: HTTP ${tokenResponse.status}`,
        details: errorText
      }, { status: tokenResponse.status })
    }
    
    const tokenData = await tokenResponse.json()
    console.log('✅ 토큰 데이터 수신:', {
      access_token: tokenData.access_token?.substring(0, 20) + '...',
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope
    })
    
    if (tokenData.error) {
      return NextResponse.json({
        success: false,
        error: `토큰 교환 실패: ${tokenData.error}`,
        description: tokenData.error_description
      }, { status: 400 })
    }
    
    // 새로운 토큰으로 밴드 API 테스트
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
        message: '새로운 토큰으로 밴드 API 접근 성공!'
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
    
    return NextResponse.json({
      success: true,
      message: '토큰 교환 성공!',
      data: {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope
      },
      bandApiTest: bandTestResult,
      instructions: [
        '1. 이 access_token을 .env.local의 BAND_ACCESS_TOKEN에 업데이트하세요.',
        '2. 개발 서버를 재시작하세요.',
        '3. 새로운 토큰으로 게시물 수집을 테스트하세요.'
      ],
      envUpdate: `BAND_ACCESS_TOKEN="${tokenData.access_token}"`,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ 수동 토큰 교환 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}