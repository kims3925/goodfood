import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 실제 사용자 ID 찾기
    let actualUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, bandAccessToken: true }
    })

    if (!actualUser) {
      actualUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: { id: true, bandAccessToken: true }
      })
    }

    if (!actualUser?.bandAccessToken) {
      return NextResponse.json({
        success: false,
        error: 'Band API 토큰이 필요합니다.'
      })
    }

    // 등록된 밴드들 조회 (테스트용으로 첫 번째만)
    const wholesaleBand = await prisma.wholesaleBand.findFirst({
      where: {
        userId: actualUser.id,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        bandKey: true
      }
    })

    if (!wholesaleBand) {
      return NextResponse.json({
        success: false,
        error: '등록된 밴드가 없습니다.'
      })
    }

    console.log(`🔍 ${wholesaleBand.name} (${wholesaleBand.bandKey}) 타임스탬프 분석 시작...`)

    // Band API로 최신 게시물 조회
    const url = `https://openapi.band.us/v2/band/posts?access_token=${actualUser.bandAccessToken}&band_key=${wholesaleBand.bandKey}&locale=ko_KR&limit=10`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BandAuto/1.0.0'
      }
    })

    const data = await response.json()

    if (data.result_code !== 1 || !data.result_data?.items) {
      return NextResponse.json({
        success: false,
        error: `Band API 오류: result_code=${data.result_code}`,
        api_response: data
      })
    }

    const posts = data.result_data.items

    // 현재 시간 정보
    const now = new Date()
    const nowKST = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    
    // 오늘 날짜 계산 (현재 코드와 동일)
    const todayStart = new Date(nowKST.getFullYear(), nowKST.getMonth(), nowKST.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    console.log(`📅 현재 시간 분석:`)
    console.log(`   현재 UTC: ${now.toISOString()}`)
    console.log(`   현재 KST: ${nowKST.toISOString()}`) 
    console.log(`   오늘 시작: ${todayStart.toISOString()}`)
    console.log(`   오늘 끝: ${todayEnd.toISOString()}`)

    // 게시물별 타임스탬프 분석
    const timestampAnalysis = posts.map((post: any, index: number) => {
      console.log(`\n📝 게시물 ${index + 1} 분석:`)
      console.log(`   post_key: ${post.post_key}`)
      console.log(`   title: ${post.content?.slice(0, 50) || '제목없음'}...`)
      
      // Band API created_at 원본값 확인
      console.log(`   created_at 원본: ${post.created_at} (타입: ${typeof post.created_at})`)
      
      // 다양한 방식으로 날짜 파싱 시도
      let createdDate1 = null
      let createdDate2 = null
      let createdDate3 = null
      
      try {
        // 방법 1: 밀리초 timestamp로 가정
        if (typeof post.created_at === 'number') {
          createdDate1 = new Date(post.created_at)
        } else if (typeof post.created_at === 'string') {
          const timestamp = parseInt(post.created_at)
          if (!isNaN(timestamp)) {
            createdDate1 = new Date(timestamp)
          }
        }
        
        // 방법 2: 초 timestamp로 가정  
        if (typeof post.created_at === 'number') {
          createdDate2 = new Date(post.created_at * 1000)
        } else if (typeof post.created_at === 'string') {
          const timestamp = parseInt(post.created_at)
          if (!isNaN(timestamp)) {
            createdDate2 = new Date(timestamp * 1000)
          }
        }
        
        // 방법 3: ISO string으로 직접 파싱
        if (typeof post.created_at === 'string' && post.created_at.includes('-')) {
          createdDate3 = new Date(post.created_at)
        }
        
      } catch (error) {
        console.log(`   파싱 에러: ${error}`)
      }
      
      console.log(`   방법1 (밀리초): ${createdDate1?.toISOString() || 'Invalid'}`)
      console.log(`   방법2 (초*1000): ${createdDate2?.toISOString() || 'Invalid'}`) 
      console.log(`   방법3 (ISO): ${createdDate3?.toISOString() || 'Invalid'}`)
      
      // 현재 코드와 동일한 방식으로 파싱
      const currentCodeDate = new Date(post.created_at)
      console.log(`   현재코드방식: ${currentCodeDate.toISOString()}`)
      
      // 오늘 범위 체크
      const isToday1 = createdDate1 && createdDate1 >= todayStart && createdDate1 < todayEnd
      const isToday2 = createdDate2 && createdDate2 >= todayStart && createdDate2 < todayEnd  
      const isToday3 = createdDate3 && createdDate3 >= todayStart && createdDate3 < todayEnd
      const isTodayCurrent = currentCodeDate >= todayStart && currentCodeDate < todayEnd
      
      console.log(`   오늘인가? 방법1: ${isToday1}, 방법2: ${isToday2}, 방법3: ${isToday3}, 현재코드: ${isTodayCurrent}`)
      
      // 현재 시간과의 차이 계산
      if (createdDate2 && createdDate2.getTime() > 0) {
        const hoursDiff = (now.getTime() - createdDate2.getTime()) / (1000 * 60 * 60)
        console.log(`   현재시간과 차이: ${hoursDiff.toFixed(2)}시간 전`)
      }

      return {
        post_key: post.post_key,
        title: (post.content || '').substring(0, 100),
        created_at_raw: post.created_at,
        created_at_type: typeof post.created_at,
        parsed_methods: {
          method1_milliseconds: createdDate1?.toISOString() || null,
          method2_seconds: createdDate2?.toISOString() || null, 
          method3_iso: createdDate3?.toISOString() || null,
          current_code: currentCodeDate.toISOString()
        },
        is_today_check: {
          method1: isToday1,
          method2: isToday2,
          method3: isToday3,
          current_code: isTodayCurrent
        },
        hours_ago: createdDate2 ? ((now.getTime() - createdDate2.getTime()) / (1000 * 60 * 60)) : null
      }
    })

    return NextResponse.json({
      success: true,
      band_info: {
        name: wholesaleBand.name,
        band_key: wholesaleBand.bandKey
      },
      time_analysis: {
        current_utc: now.toISOString(),
        current_kst: nowKST.toISOString(),
        today_range: {
          start: todayStart.toISOString(),
          end: todayEnd.toISOString()
        }
      },
      posts_count: posts.length,
      posts_analysis: timestampAnalysis,
      summary: {
        total_posts: posts.length,
        method1_today_count: timestampAnalysis.filter(p => p.is_today_check.method1).length,
        method2_today_count: timestampAnalysis.filter(p => p.is_today_check.method2).length,
        method3_today_count: timestampAnalysis.filter(p => p.is_today_check.method3).length,
        current_code_today_count: timestampAnalysis.filter(p => p.is_today_check.current_code).length
      }
    })

  } catch (error) {
    console.error('타임스탬프 디버그 실패:', error)
    return NextResponse.json({
      success: false,
      error: '테스트 중 오류가 발생했습니다.',
      error_details: error.toString()
    }, { status: 500 })
  }
}