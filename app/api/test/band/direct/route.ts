import { NextRequest, NextResponse } from 'next/server'

/**
 * 직접 밴드 API 호출 테스트 (다양한 엔드포인트 시도)
 * GET /api/test/band/direct?bandKey=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bandKey = searchParams.get('bandKey') || 'AAAMvZteE5OjyYnjS64rQuH3'
    
    console.log('🧪 직접 밴드 API 호출 테스트 시작...')
    
    const accessToken = process.env.BAND_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'BAND_ACCESS_TOKEN이 설정되지 않았습니다.'
      }, { status: 500 })
    }

    const testResults = []

    // 테스트할 다양한 API 엔드포인트들
    const apiEndpoints = [
      {
        name: '밴드 목록 조회',
        url: 'https://openapi.band.us/v2.1/bands',
        method: 'GET'
      },
      {
        name: '특정 밴드 정보',
        url: `https://openapi.band.us/v2.1/bands/${bandKey}`,
        method: 'GET'
      },
      {
        name: '밴드 게시물 목록 (v1)',
        url: `https://openapi.band.us/v2.1/bands/${bandKey}/posts`,
        method: 'GET'
      },
      {
        name: '밴드 게시물 목록 (v2 - 다른 형식)',
        url: `https://openapi.band.us/v2.1/band/posts`,
        method: 'GET',
        params: { band_key: bandKey }
      },
      {
        name: '나의 밴드 게시물',
        url: `https://openapi.band.us/v2.1/posts`,
        method: 'GET',
        params: { band_key: bandKey }
      }
    ]

    for (const endpoint of apiEndpoints) {
      try {
        console.log(`🔄 테스트 중: ${endpoint.name}`)
        
        let url = endpoint.url
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'BandAuto/1.0.0',
        }

        // URL 파라미터 추가
        if (endpoint.params) {
          const urlObj = new URL(url)
          Object.entries(endpoint.params).forEach(([key, value]) => {
            urlObj.searchParams.append(key, String(value))
          })
          url = urlObj.toString()
        }

        console.log(`📍 요청 URL: ${url}`)
        
        const response = await fetch(url, {
          method: endpoint.method,
          headers
        })

        let responseData = null
        let responseText = ''
        
        try {
          responseText = await response.text()
          responseData = JSON.parse(responseText)
        } catch (parseError) {
          responseData = { raw: responseText }
        }

        const result = {
          name: endpoint.name,
          url,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData,
          timestamp: new Date().toISOString()
        }

        testResults.push(result)
        
        console.log(`${response.ok ? '✅' : '❌'} ${endpoint.name}: ${response.status}`)
        
        // Rate limiting 방지
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (error) {
        console.error(`❌ ${endpoint.name} 테스트 실패:`, error)
        
        testResults.push({
          name: endpoint.name,
          url: endpoint.url,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        })
      }
    }

    // 결과 분석
    const successfulTests = testResults.filter(test => test.success)
    const failedTests = testResults.filter(test => !test.success)

    return NextResponse.json({
      success: successfulTests.length > 0,
      message: `${successfulTests.length}/${testResults.length} API 테스트 성공`,
      
      summary: {
        total: testResults.length,
        successful: successfulTests.length,
        failed: failedTests.length,
        bandKey,
        accessTokenLength: accessToken.length
      },
      
      successfulEndpoints: successfulTests.map(test => ({
        name: test.name,
        url: test.url,
        status: test.status,
        dataPreview: test.data ? Object.keys(test.data) : null
      })),
      
      failedEndpoints: failedTests.map(test => ({
        name: test.name,
        url: test.url,
        status: test.status || 'ERROR',
        error: test.error || test.statusText
      })),
      
      detailedResults: testResults,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 직접 API 테스트 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}