import { NextRequest, NextResponse } from 'next/server'

/**
 * 밴드 OAuth 종합 문제 진단 및 해결 테스트
 * GET /api/test/band/comprehensive
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🕵️ 밴드 OAuth 종합 진단 시작...')
    
    const results = {
      timestamp: new Date().toISOString(),
      hypotheses: [] as any[],
      solutions: [] as any[],
      recommendations: [] as string[]
    }

    // === 가설 1: 토큰 만료 또는 형식 문제 ===
    console.log('🔍 가설 1: 토큰 관련 문제 검증...')
    const tokenHypothesis = {
      name: '토큰 관련 문제',
      tests: [] as any[]
    }

    // 1-1. 토큰 기본 정보 확인
    const accessToken = process.env.BAND_ACCESS_TOKEN || ''
    tokenHypothesis.tests.push({
      test: '토큰 존재 여부',
      result: accessToken.length > 0 ? 'PASS' : 'FAIL',
      details: {
        exists: accessToken.length > 0,
        length: accessToken.length,
        prefix: accessToken.substring(0, 10) + '...'
      }
    })

    // 1-2. 토큰 디코딩 시도 (Base64 등)
    try {
      const tokenParts = accessToken.split('.')
      tokenHypothesis.tests.push({
        test: '토큰 구조 분석',
        result: 'INFO',
        details: {
          parts: tokenParts.length,
          isJWT: tokenParts.length === 3,
          firstPart: tokenParts[0]?.substring(0, 20) + '...'
        }
      })
    } catch (error) {
      tokenHypothesis.tests.push({
        test: '토큰 구조 분석',
        result: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      })
    }

    results.hypotheses.push(tokenHypothesis)

    // === 가설 2: Redirect URI 문제 ===
    console.log('🔍 가설 2: Redirect URI 문제 검증...')
    const redirectHypothesis = {
      name: 'Redirect URI 관련 문제',
      tests: [] as any[]
    }

    const currentRedirectUri = process.env.BAND_REDIRECT_URI || ''
    const expectedRedirectUri = 'http://localhost:3000/api/auth/band/callback'
    
    redirectHypothesis.tests.push({
      test: 'Redirect URI 일치성',
      result: currentRedirectUri === expectedRedirectUri ? 'PASS' : 'FAIL',
      details: {
        current: currentRedirectUri,
        expected: expectedRedirectUri,
        matches: currentRedirectUri === expectedRedirectUri
      }
    })

    // Redirect URI 엔드포인트 존재 확인
    try {
      const callbackResponse = await fetch(`http://localhost:3000/api/auth/band/callback?code=test&state=test`, {
        method: 'GET'
      })
      
      redirectHypothesis.tests.push({
        test: '콜백 엔드포인트 존재',
        result: callbackResponse.status !== 404 ? 'PASS' : 'FAIL',
        details: {
          status: callbackResponse.status,
          statusText: callbackResponse.statusText
        }
      })
    } catch (error) {
      redirectHypothesis.tests.push({
        test: '콜백 엔드포인트 존재',
        result: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      })
    }

    results.hypotheses.push(redirectHypothesis)

    // === 가설 3: API 엔드포인트 및 인증 방식 문제 ===
    console.log('🔍 가설 3: API 엔드포인트 및 인증 방식 검증...')
    const apiHypothesis = {
      name: 'API 엔드포인트 및 인증 방식 문제',
      tests: [] as any[]
    }

    // 3-1. 다양한 인증 방식 테스트
    const authMethods = [
      {
        name: 'Bearer Token (Header)',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      },
      {
        name: 'Query Parameter',
        url: `?access_token=${accessToken}`
      },
      {
        name: 'Bearer Token + User-Agent',
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'BandAuto/1.0.0'
        }
      },
      {
        name: 'X-Access-Token Header',
        headers: { 'X-Access-Token': accessToken }
      }
    ]

    for (const method of authMethods) {
      try {
        const testUrl = `https://openapi.band.us/v2.1/bands${method.url || ''}`
        const testHeaders = method.headers || {}

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: testHeaders
        })

        const responseData = await response.text()
        
        apiHypothesis.tests.push({
          test: `인증 방식: ${method.name}`,
          result: response.ok ? 'PASS' : 'FAIL',
          details: {
            status: response.status,
            statusText: response.statusText,
            url: testUrl,
            responsePreview: responseData.substring(0, 200) + '...'
          }
        })

        // 성공하면 중단
        if (response.ok) {
          results.solutions.push({
            type: '인증 방식 해결책',
            method: method.name,
            implementation: {
              url: testUrl,
              headers: testHeaders
            }
          })
        }

      } catch (error) {
        apiHypothesis.tests.push({
          test: `인증 방식: ${method.name}`,
          result: 'ERROR',
          error: error instanceof Error ? error.message : String(error)
        })
      }

      // Rate limiting 방지
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    results.hypotheses.push(apiHypothesis)

    // === 가설 4: 개발자센터 설정 문제 ===
    console.log('🔍 가설 4: 개발자센터 설정 문제 분석...')
    const devCenterHypothesis = {
      name: '네이버 개발자센터 설정 문제',
      tests: [
        {
          test: '설정 체크리스트',
          result: 'INFO',
          checklist: [
            '✅ 애플리케이션이 "서비스 적용" 상태인가?',
            '✅ API 사용 권한에 "밴드 API" 체크되어 있는가?',
            '✅ 서비스 URL이 http://localhost:3000 으로 설정되어 있는가?',
            '✅ Callback URL이 정확히 설정되어 있는가?',
            '✅ 도메인 검증이 완료되었는가?',
            '⚠️ 개발 단계에서는 localhost 도메인 허용 설정이 있는가?'
          ]
        }
      ]
    }

    results.hypotheses.push(devCenterHypothesis)

    // === 가설 5: OAuth 플로우 재시도 필요 ===
    console.log('🔍 가설 5: OAuth 재인증 필요성 검증...')
    const reauthHypothesis = {
      name: 'OAuth 재인증 필요성',
      tests: [] as any[]
    }

    // 새로운 인증 URL 생성
    try {
      const clientId = process.env.BAND_CLIENT_ID
      const redirectUri = process.env.BAND_REDIRECT_URI
      
      if (clientId && redirectUri) {
        const newAuthUrl = new URL('https://auth.band.us/oauth2/authorize')
        newAuthUrl.searchParams.append('response_type', 'code')
        newAuthUrl.searchParams.append('client_id', clientId)
        newAuthUrl.searchParams.append('redirect_uri', redirectUri)
        
        reauthHypothesis.tests.push({
          test: '새 인증 URL 생성',
          result: 'PASS',
          details: {
            authUrl: newAuthUrl.toString(),
            suggestion: '현재 토큰이 무효할 수 있으므로 재인증을 시도해보세요.'
          }
        })

        results.solutions.push({
          type: '재인증 해결책',
          authUrl: newAuthUrl.toString(),
          steps: [
            '1. 위 인증 URL로 이동',
            '2. 네이버 계정으로 로그인',
            '3. 밴드 앱 권한 허가',
            '4. 새로운 access_token 획득',
            '5. .env.local 파일의 BAND_ACCESS_TOKEN 업데이트'
          ]
        })
      }
    } catch (error) {
      reauthHypothesis.tests.push({
        test: '새 인증 URL 생성',
        result: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      })
    }

    results.hypotheses.push(reauthHypothesis)

    // === 최종 권장사항 ===
    results.recommendations = [
      '1. 🔄 **즉시 시도**: OAuth 재인증을 통해 새로운 토큰 획득',
      '2. 🏗️ **설정 확인**: 네이버 개발자센터 애플리케이션 상태 점검',
      '3. 🌐 **도메인 문제**: localhost 대신 127.0.0.1 또는 실제 도메인 사용 고려',
      '4. 📝 **API 문서**: 최신 밴드 API 문서에서 변경사항 확인',
      '5. 🛠️ **대안 방법**: API 제약이 계속될 경우 웹 크롤링 방식 고려'
    ]

    // 성공한 해결책이 있는지 확인
    const hasSuccessfulSolution = results.solutions.length > 0
    
    return NextResponse.json({
      success: hasSuccessfulSolution,
      message: hasSuccessfulSolution 
        ? `${results.solutions.length}개의 해결책을 찾았습니다!` 
        : '모든 가설을 검증했지만 즉시 해결책을 찾지 못했습니다.',
      
      ...results,
      
      summary: {
        totalHypotheses: results.hypotheses.length,
        totalTests: results.hypotheses.reduce((sum, h) => sum + h.tests.length, 0),
        solutionsFound: results.solutions.length,
        criticalIssues: results.hypotheses.filter(h => 
          h.tests.some(t => t.result === 'FAIL')
        ).map(h => h.name)
      }
    })

  } catch (error) {
    console.error('❌ 종합 진단 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}