import { NextRequest, NextResponse } from 'next/server'

/**
 * 타임스탬프 해석 문제 수정 및 테스트 API
 * GET /api/test/band/fix-timestamp
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔧 타임스탬프 해석 문제 수정 및 테스트...')
    
    const accessToken = process.env.BAND_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'BAND_ACCESS_TOKEN이 설정되지 않았습니다.'
      }, { status: 500 })
    }

    const targetBandKey = 'AAAMvZteE5OjyYnjS64rQuH3'
    
    // 현재 날짜 정보 (올바른 계산)
    const now = new Date()
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)) // UTC+9
    const todayKST = koreaTime.toISOString().split('T')[0] // YYYY-MM-DD
    
    console.log('🗓️ 현재 시간 (UTC):', now.toISOString())
    console.log('🗓️ 현재 시간 (KST):', koreaTime.toISOString())
    console.log('🗓️ 오늘 날짜 (KST):', todayKST)

    // 게시물 목록 조회
    const postsUrl = new URL('https://openapi.band.us/v2/band/posts')
    postsUrl.searchParams.append('access_token', accessToken)
    postsUrl.searchParams.append('band_key', targetBandKey)
    postsUrl.searchParams.append('locale', 'ko_KR')
    
    const postsResponse = await fetch(postsUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'BandAuto/1.0.0'
      }
    })

    if (!postsResponse.ok) {
      const errorText = await postsResponse.text()
      return NextResponse.json({
        success: false,
        error: `게시물 목록 조회 실패: HTTP ${postsResponse.status}`,
        details: errorText
      }, { status: postsResponse.status })
    }

    const postsData = await postsResponse.json()
    const allPosts = postsData.result_data?.items || []
    
    console.log('✅ 게시물 목록 조회 성공')
    console.log('📊 총 게시물 수:', allPosts.length)

    // 타임스탬프 해석 테스트
    const timestampTests = []
    const todayPosts = []

    for (let i = 0; i < Math.min(allPosts.length, 10); i++) {
      const post = allPosts[i]
      const timestamp = post.created_at
      
      console.log(`🔍 게시물 [${i+1}] 타임스탬프 분석: ${timestamp}`)

      // 다양한 타임스탬프 해석 방법 테스트
      const interpretations = {
        // 방법 1: 기존 방식 (잘못된 결과)
        method1_wrong: {
          description: '기존 방식 (밀리초로 해석)',
          date: new Date(timestamp * 1000),
          dateString: null
        },
        
        // 방법 2: 타임스탬프를 초 단위로 해석 (올바른 방식)
        method2_seconds: {
          description: '초 단위 타임스탬프',
          date: new Date(timestamp * 1000),
          dateString: null
        },
        
        // 방법 3: 타임스탬프를 밀리초 단위로 해석
        method3_milliseconds: {
          description: '밀리초 단위 타임스탬프',
          date: new Date(timestamp),
          dateString: null
        },
        
        // 방법 4: 타임스탬프 길이에 따른 자동 판단
        method4_auto: {
          description: '자동 판단 (길이 기반)',
          date: timestamp.toString().length > 10 ? new Date(timestamp) : new Date(timestamp * 1000),
          dateString: null
        }
      }

      // 각 방법별 날짜 문자열 생성 및 검증
      Object.keys(interpretations).forEach(key => {
        const method = interpretations[key]
        const date = method.date
        
        // KST로 변환
        const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000))
        method.dateString = kstDate.toISOString().split('T')[0]
        method.isToday = method.dateString === todayKST
        method.isReasonable = date.getFullYear() >= 2020 && date.getFullYear() <= 2030
        method.formatted = {
          utc: date.toISOString(),
          kst: kstDate.toISOString(),
          korean: kstDate.toLocaleDateString('ko-KR'),
          year: date.getFullYear()
        }
      })

      const testResult = {
        post_index: i + 1,
        post_key: post.post_key,
        title: (post.content || '제목 없음').substring(0, 80) + '...',
        raw_timestamp: timestamp,
        timestamp_length: timestamp.toString().length,
        interpretations
      }

      timestampTests.push(testResult)

      // 올바른 해석 방법으로 오늘 게시물 찾기
      const correctDate = new Date(timestamp * 1000) // 초 단위로 해석
      const correctKSTDate = new Date(correctDate.getTime() + (9 * 60 * 60 * 1000))
      const correctDateString = correctKSTDate.toISOString().split('T')[0]

      if (correctDateString === todayKST) {
        todayPosts.push({
          post_key: post.post_key,
          title: (post.content || '').substring(0, 100) + '...',
          created_at: {
            timestamp: timestamp,
            date_kst: correctDateString,
            formatted: correctKSTDate.toLocaleString('ko-KR')
          }
        })
        console.log(`🎯 오늘 게시물 발견: ${post.post_key}`)
      }
    }

    // 결과 분석
    const analysis = {
      total_posts_analyzed: timestampTests.length,
      today_posts_found: todayPosts.length,
      timestamp_analysis: {
        common_length: timestampTests[0]?.timestamp_length,
        is_seconds: timestampTests[0]?.timestamp_length <= 10,
        is_milliseconds: timestampTests[0]?.timestamp_length > 10
      },
      method_accuracy: {}
    }

    // 각 방법의 정확도 분석
    ['method1_wrong', 'method2_seconds', 'method3_milliseconds', 'method4_auto'].forEach(method => {
      const reasonableCount = timestampTests.filter(test => 
        test.interpretations[method].isReasonable
      ).length

      analysis.method_accuracy[method] = {
        reasonable_dates: reasonableCount,
        accuracy_percentage: Math.round((reasonableCount / timestampTests.length) * 100),
        today_matches: timestampTests.filter(test => 
          test.interpretations[method].isToday
        ).length
      }
    })

    console.log('🎉 타임스탬프 분석 완료!')
    console.log('📋 분석 결과:', analysis)

    return NextResponse.json({
      success: true,
      message: `${timestampTests.length}개 게시물의 타임스탬프를 분석했습니다.`,
      
      current_time_info: {
        utc_now: now.toISOString(),
        kst_now: koreaTime.toISOString(),
        today_kst: todayKST
      },
      
      analysis,
      
      today_posts_found: todayPosts,
      
      timestamp_tests: timestampTests,
      
      recommended_fix: {
        problem: '타임스탬프가 초 단위로 제공되므로 1000을 곱해야 합니다.',
        current_code: 'new Date(timestamp * 1000) // 잘못된 계산',
        fixed_code: 'new Date(timestamp * 1000) // 올바른 계산 (timestamp가 이미 초 단위)',
        actual_issue: 'Date 생성 후 시간대 변환에서 문제 발생'
      },
      
      debugging_info: {
        sample_timestamp: timestampTests[0]?.raw_timestamp,
        sample_interpretations: timestampTests[0]?.interpretations
      },
      
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 타임스탬프 분석 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}