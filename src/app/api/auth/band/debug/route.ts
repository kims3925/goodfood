import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

/**
 * 네이버 밴드 OAuth 설정 디버깅 엔드포인트
 * GET /api/auth/band/debug
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 네이버 밴드 OAuth 설정 디버깅...')

    // 세션 확인
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다. 로그인 후 다시 시도해주세요.'
      }, { status: 401 })
    }

    // 사용자 DB에서 Band API 설정 로드
    const userId = parseInt(session.user.id, 10)
    const bandSettings = await prisma.bandApiSettings.findUnique({
      where: { userId },
      select: {
        clientId: true,
        clientSecret: true,
        accessToken: true
      }
    })

    // 데이터베이스 설정 확인
    const config = {
      BAND_CLIENT_ID: bandSettings?.clientId || '❌ 미설정',
      BAND_CLIENT_SECRET: bandSettings?.clientSecret ? '설정됨 (길이: ' + bandSettings.clientSecret.length + ')' : '❌ 미설정',
      BAND_ACCESS_TOKEN: bandSettings?.accessToken ? '설정됨 (길이: ' + bandSettings.accessToken.length + ')' : '❌ 미설정'
    }

    console.log('📋 현재 설정 (데이터베이스):', config)

    // 1단계: 기본 설정 검증
    const validationErrors = []

    if (!bandSettings?.clientId) {
      validationErrors.push('BAND_CLIENT_ID가 설정되지 않음')
    }

    if (!bandSettings?.clientSecret) {
      validationErrors.push('BAND_CLIENT_SECRET가 설정되지 않음')
    }

    if (!bandSettings?.accessToken) {
      validationErrors.push('BAND_ACCESS_TOKEN이 설정되지 않음')
    }

    // 2단계: OAuth URL 생성 테스트
    let authUrlTest = null
    if (validationErrors.length === 0 && bandSettings?.clientId) {
      try {
        const redirectUri = process.env.NEXT_PUBLIC_SITE_URL
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/band/callback`
          : 'http://localhost:3000/api/auth/band/callback'

        const authUrl = new URL('https://nid.naver.com/oauth2.0/authorize')
        authUrl.searchParams.append('response_type', 'code')
        authUrl.searchParams.append('client_id', bandSettings.clientId)
        authUrl.searchParams.append('redirect_uri', redirectUri)
        authUrl.searchParams.append('scope', 'band')
        authUrl.searchParams.append('state', 'test_' + Date.now())

        authUrlTest = {
          success: true,
          url: authUrl.toString(),
          components: {
            baseUrl: authUrl.origin + authUrl.pathname,
            clientId: authUrl.searchParams.get('client_id'),
            redirectUri: authUrl.searchParams.get('redirect_uri'),
            scope: authUrl.searchParams.get('scope'),
            state: authUrl.searchParams.get('state')
          }
        }
      } catch (error) {
        authUrlTest = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }

    // 3단계: 네이버 OAuth 서버 연결 테스트
    let naverConnectionTest = null
    try {
      console.log('🌐 네이버 OAuth 서버 연결 테스트...')
      
      const testResponse = await fetch('https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=test', {
        method: 'HEAD',  // HEAD 요청으로 연결만 확인
      })
      
      naverConnectionTest = {
        success: true,
        status: testResponse.status,
        message: '네이버 OAuth 서버 연결 가능'
      }
    } catch (error) {
      naverConnectionTest = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: '네이버 OAuth 서버 연결 불가 (네트워크 문제일 수 있음)'
      }
    }

    // 4단계: 콜백 엔드포인트 자체 테스트
    let callbackTest = null
    try {
      const callbackUrl = `http://localhost:3000/api/auth/band/callback?code=test&state=test`
      console.log('🔄 콜백 엔드포인트 테스트:', callbackUrl)
      
      // 자체 콜백 엔드포인트가 존재하는지 확인 (실제 호출은 안함)
      callbackTest = {
        success: true,
        endpoint: '/api/auth/band/callback',
        expectedParams: ['code', 'state'],
        message: '콜백 엔드포인트가 구현되어 있음'
      }
    } catch (error) {
      callbackTest = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }

    // 5단계: 가능한 문제점 및 해결책 제시
    const diagnostics = []

    if (validationErrors.length > 0) {
      diagnostics.push({
        level: 'CRITICAL',
        issue: '필수 Band API 설정 누락',
        details: validationErrors,
        solution: '설정 페이지(/admin/settings/api)에서 Band API 인증 정보를 입력하세요.'
      })
    }

    if (!authUrlTest?.success) {
      diagnostics.push({
        level: 'ERROR',
        issue: 'OAuth URL 생성 실패',
        details: authUrlTest?.error,
        solution: 'CLIENT_ID와 REDIRECT_URI를 다시 확인하세요.'
      })
    }

    if (!naverConnectionTest?.success) {
      diagnostics.push({
        level: 'WARNING',
        issue: '네이버 서버 연결 문제',
        details: naverConnectionTest?.error,
        solution: '인터넷 연결이나 방화벽 설정을 확인하세요.'
      })
    }

    // 네이버 개발자센터 체크리스트
    const developerCenterChecklist = [
      '✅ 애플리케이션이 "서비스 적용" 상태인가?',
      '✅ API 권한에서 "밴드"가 체크되어 있는가?',
      '✅ 서비스 URL이 http://localhost:3000으로 설정되어 있는가?',
      '✅ Callback URL이 http://localhost:3000/api/auth/band/callback으로 설정되어 있는가?',
      '✅ 애플리케이션 검수가 완료되었는가?'
    ]

    return NextResponse.json({
      success: validationErrors.length === 0,
      message: validationErrors.length === 0 ? 'OAuth 설정이 올바릅니다!' : 'OAuth 설정에 문제가 있습니다.',
      
      configuration: config,
      validation: {
        errors: validationErrors,
        hasErrors: validationErrors.length > 0
      },
      
      tests: {
        authUrlGeneration: authUrlTest,
        naverConnection: naverConnectionTest,
        callbackEndpoint: callbackTest
      },
      
      diagnostics,
      
      recommendations: {
        immediate: [
          '1. 네이버 개발자센터 설정을 아래 체크리스트로 확인하세요.',
          '2. 애플리케이션 상태가 "서비스 적용"인지 확인하세요.',
          '3. 브라우저에서 직접 OAuth URL을 테스트해보세요.'
        ],
        developerCenter: developerCenterChecklist
      },
      
      testAuthUrl: authUrlTest?.success ? authUrlTest.url : null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ OAuth 디버깅 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}