import { NextRequest, NextResponse } from 'next/server'

/**
 * 여러 밴드의 게시물 접근 권한 테스트
 * GET /api/test/band/test-posts-access
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 여러 밴드 게시물 접근 권한 테스트 시작...')
    
    const accessToken = process.env.BAND_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'BAND_ACCESS_TOKEN이 설정되지 않았습니다.'
      }, { status: 500 })
    }

    // 테스트할 밴드들 (멤버 수가 적은 것부터)
    const testBands = [
      { name: '킹도매방', band_key: 'AAAtu_SZ1y6xCFvn6LHJhzVm', members: 2 },
      { name: '굿푸드도매방', band_key: 'AAB0_b5hK7S8FT-OB0qmWOHV', members: 2 },
      { name: '친구상품공급방', band_key: 'AABr0BHBLLCCoVo4t0MaOldA', members: 8 },
      { name: '좋은친구도매방', band_key: 'AABzNMxfbXDVvbSjfDD_2CFc', members: 13 },
      { name: '나은 상품 공급방', band_key: 'AAAMvZteE5OjyYnjS64rQuH3', members: 472 }
    ]

    const testResults = []

    for (const band of testBands) {
      console.log(`🔍 ${band.name} (${band.members}명) 게시물 접근 테스트...`)
      
      const testResult = {
        band_name: band.name,
        band_key: band.band_key,
        member_count: band.members,
        tests: []
      }

      // 테스트 1: 기본 게시물 목록 조회
      try {
        const postsResponse = await fetch(`https://openapi.band.us/v2.1/bands/${band.band_key}/posts?limit=5`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'BandAuto/1.0.0'
          }
        })

        const responseText = await postsResponse.text()
        
        testResult.tests.push({
          test: 'posts_list',
          status: postsResponse.status,
          success: postsResponse.ok,
          response_preview: responseText.substring(0, 200) + '...',
          error_details: !postsResponse.ok ? responseText : null
        })

        // 성공한 경우 JSON 파싱 시도
        if (postsResponse.ok) {
          try {
            const postsData = JSON.parse(responseText)
            testResult.tests[testResult.tests.length - 1].posts_count = postsData.result_data?.posts?.length || 0
            testResult.tests[testResult.tests.length - 1].result_code = postsData.result_code
            
            console.log(`✅ ${band.name}: ${postsData.result_data?.posts?.length || 0}개 게시물`)
            
            // 첫 번째 게시물이 있으면 상세 조회도 테스트
            if (postsData.result_data?.posts?.length > 0) {
              const firstPost = postsData.result_data.posts[0]
              
              const detailResponse = await fetch(`https://openapi.band.us/v2.1/bands/${band.band_key}/posts/${firstPost.post_key}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'User-Agent': 'BandAuto/1.0.0'
                }
              })

              const detailText = await detailResponse.text()
              
              testResult.tests.push({
                test: 'post_detail',
                post_key: firstPost.post_key,
                status: detailResponse.status,
                success: detailResponse.ok,
                response_preview: detailText.substring(0, 150) + '...',
                error_details: !detailResponse.ok ? detailText : null
              })

              console.log(`${detailResponse.ok ? '✅' : '❌'} ${band.name} 게시물 상세 조회: ${detailResponse.status}`)
            }
            
          } catch (jsonError) {
            testResult.tests[testResult.tests.length - 1].json_parse_error = 'JSON 파싱 실패'
            console.log(`⚠️ ${band.name}: JSON 파싱 실패`)
          }
        } else {
          console.log(`❌ ${band.name}: ${postsResponse.status} 오류`)
        }

      } catch (error) {
        testResult.tests.push({
          test: 'posts_list',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
        console.log(`❌ ${band.name}: 네트워크 오류`)
      }

      testResults.push(testResult)
      
      // Rate limiting 방지
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // 결과 분석
    const successfulBands = testResults.filter(result => 
      result.tests.some(test => test.test === 'posts_list' && test.success)
    )

    const failedBands = testResults.filter(result => 
      !result.tests.some(test => test.test === 'posts_list' && test.success)
    )

    // 오류 패턴 분석
    const errorPatterns = {}
    failedBands.forEach(band => {
      const postTest = band.tests.find(test => test.test === 'posts_list')
      if (postTest?.status) {
        const statusKey = `HTTP_${postTest.status}`
        errorPatterns[statusKey] = (errorPatterns[statusKey] || 0) + 1
      }
    })

    return NextResponse.json({
      success: successfulBands.length > 0,
      message: `${testResults.length}개 밴드 테스트 완료: ${successfulBands.length}개 성공, ${failedBands.length}개 실패`,
      
      summary: {
        total_tested: testResults.length,
        successful_bands: successfulBands.length,
        failed_bands: failedBands.length,
        error_patterns: errorPatterns
      },

      results: testResults,

      analysis: {
        working_bands: successfulBands.map(band => ({
          name: band.band_name,
          key: band.band_key,
          members: band.member_count,
          posts_found: band.tests.find(t => t.test === 'posts_list')?.posts_count || 0
        })),
        
        failed_bands: failedBands.map(band => ({
          name: band.band_name, 
          key: band.band_key,
          members: band.member_count,
          error_status: band.tests.find(t => t.test === 'posts_list')?.status || 'unknown'
        }))
      },

      recommendations: successfulBands.length > 0 ? [
        '✅ 일부 밴드에서는 게시물 접근이 가능합니다.',
        '🔍 성공한 밴드의 패턴을 분석하여 "나은 상품 공급방" 문제를 해결할 수 있습니다.',
        '⚙️ 특정 밴드만의 권한 설정이나 API 제약사항이 있을 수 있습니다.'
      ] : [
        '❌ 모든 테스트 밴드에서 게시물 접근이 실패했습니다.',
        '🔐 토큰의 권한 스코프나 API 설정에 문제가 있을 수 있습니다.',
        '📞 네이버 개발자센터에서 API 권한을 다시 확인해주세요.'
      ],

      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 게시물 접근 테스트 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}