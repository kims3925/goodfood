import { NextRequest, NextResponse } from 'next/server'

/**
 * 나은 상품 공급방 게시물 디버깅 API
 * GET /api/test/band/debug-posts?limit=20
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 나은 상품 공급방 게시물 디버깅 시작...')
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    
    const accessToken = process.env.BAND_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'BAND_ACCESS_TOKEN이 설정되지 않았습니다.'
      }, { status: 500 })
    }

    const targetBandKey = 'AAAMvZteE5OjyYnjS64rQuH3'
    
    console.log('🎯 타겟 밴드:', targetBandKey)
    console.log('📊 요청 게시물 수:', limit)

    // 오늘 날짜 정보 (여러 시간대 확인)
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
    
    console.log('🌐 API 요청 URL:', postsUrl.toString())
    
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

    if (allPosts.length === 0) {
      return NextResponse.json({
        success: true,
        message: '게시물이 없습니다.',
        debug_info: {
          total_posts: 0,
          today_kst: todayKST,
          posts: []
        }
      })
    }

    // 각 게시물의 상세 날짜 분석
    const debugPosts = []
    const dateAnalysis = {
      timezone_tests: [],
      date_formats: [],
      today_candidates: []
    }

    for (let i = 0; i < Math.min(allPosts.length, limit); i++) {
      const post = allPosts[i]
      
      try {
        console.log(`📝 게시물 [${i+1}/${Math.min(allPosts.length, limit)}] 분석: ${post.post_key}`)

        // 다양한 날짜 변환 시도
        const timestamp = post.created_at
        
        // UTC 기준
        const utcDate = new Date(timestamp * 1000)
        const utcDateString = utcDate.toISOString().split('T')[0]
        
        // KST 기준 (UTC+9)
        const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000))
        const kstDateString = kstDate.toISOString().split('T')[0]
        
        // 현지 시간 기준
        const localDate = new Date(timestamp * 1000)
        const localDateString = localDate.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).replace(/\./g, '-').replace(/\s/g, '').slice(0, -1) // 2025-08-23 형태로 변환

        // 서버 시간대 기준
        const serverDate = new Date(timestamp * 1000)
        const serverDateString = serverDate.getFullYear() + '-' + 
          String(serverDate.getMonth() + 1).padStart(2, '0') + '-' + 
          String(serverDate.getDate()).padStart(2, '0')

        const dateAnalysisItem = {
          post_key: post.post_key,
          timestamp: timestamp,
          utc_date: utcDateString,
          kst_date: kstDateString,
          local_date: localDateString,
          server_date: serverDateString,
          is_today_utc: utcDateString === now.toISOString().split('T')[0],
          is_today_kst: kstDateString === todayKST,
          is_today_local: localDateString === todayKST,
          is_today_server: serverDateString === todayKST,
          formatted_times: {
            utc: utcDate.toISOString(),
            kst: kstDate.toISOString(),
            local: localDate.toLocaleString('ko-KR'),
            server: serverDate.toString()
          }
        }

        dateAnalysis.timezone_tests.push(dateAnalysisItem)

        // 오늘 날짜 후보 확인
        if (kstDateString === todayKST || utcDateString === todayKST || localDateString === todayKST || serverDateString === todayKST) {
          dateAnalysis.today_candidates.push({
            post_key: post.post_key,
            content_preview: (post.content || '').substring(0, 100) + '...',
            matched_timezone: [
              kstDateString === todayKST ? 'KST' : null,
              utcDateString === todayKST ? 'UTC' : null,
              localDateString === todayKST ? 'Local' : null,
              serverDateString === todayKST ? 'Server' : null
            ].filter(Boolean)
          })
        }

        // 게시물 기본 정보
        const debugPost = {
          index: i + 1,
          post_key: post.post_key,
          title: (post.content || '제목 없음').substring(0, 100) + '...',
          full_content: post.content || '',
          author: post.author?.name || '알 수 없음',
          created_timestamp: timestamp,
          date_analysis: dateAnalysisItem,
          comment_count: post.comment_count || 0,
          emotion_count: post.emotion_count || 0,
          has_photos: (post.photos && post.photos.length > 0) || false,
          photos_count: post.photos ? post.photos.length : 0
        }

        debugPosts.push(debugPost)

      } catch (error) {
        console.error(`❌ 게시물 분석 중 오류 [${post.post_key}]:`, error)
        
        debugPosts.push({
          index: i + 1,
          post_key: post.post_key,
          title: '분석 오류',
          error: error instanceof Error ? error.message : String(error),
          raw_post: post
        })
      }
    }

    // 날짜별 게시물 개수 통계
    const dateStats = {}
    debugPosts.forEach(post => {
      if (post.date_analysis) {
        const kstDate = post.date_analysis.kst_date
        dateStats[kstDate] = (dateStats[kstDate] || 0) + 1
      }
    })

    // 결과 분석
    const analysis = {
      total_posts_analyzed: debugPosts.length,
      today_candidates_found: dateAnalysis.today_candidates.length,
      date_distribution: dateStats,
      timezone_analysis: {
        utc_today_matches: dateAnalysis.timezone_tests.filter(t => t.is_today_utc).length,
        kst_today_matches: dateAnalysis.timezone_tests.filter(t => t.is_today_kst).length,
        local_today_matches: dateAnalysis.timezone_tests.filter(t => t.is_today_local).length,
        server_today_matches: dateAnalysis.timezone_tests.filter(t => t.is_today_server).length
      },
      most_recent_post: debugPosts.length > 0 ? {
        date: debugPosts[0]?.date_analysis?.kst_date,
        title: debugPosts[0]?.title,
        hours_ago: debugPosts.length > 0 ? 
          Math.floor((Date.now() - (debugPosts[0]?.created_timestamp * 1000)) / (1000 * 60 * 60)) : null
      } : null
    }

    console.log('🎉 게시물 디버깅 완료!')
    console.log('📋 분석 결과:', analysis)

    return NextResponse.json({
      success: true,
      message: `${debugPosts.length}개의 게시물을 분석했습니다.`,
      
      current_time_info: {
        utc_now: now.toISOString(),
        kst_now: koreaTime.toISOString(),
        today_kst: todayKST,
        timezone_offset_hours: 9
      },
      
      analysis,
      
      today_candidates: dateAnalysis.today_candidates,
      
      posts: debugPosts,
      
      debugging_tips: [
        '📅 날짜 비교 로직을 확인하세요.',
        '🕐 시간대 변환이 올바른지 확인하세요.',
        '📊 실제 게시물의 created_at 타임스탬프를 확인하세요.',
        '🔍 오늘 날짜 후보들의 시간대별 매칭을 확인하세요.'
      ],
      
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 게시물 디버깅 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}