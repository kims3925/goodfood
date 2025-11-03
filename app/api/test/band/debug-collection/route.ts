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

    // 등록된 밴드들 조회
    const wholesaleBands = await prisma.wholesaleBand.findMany({
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

    const results: any[] = []

    for (const band of wholesaleBands) {
      console.log(`🔍 ${band.name} (${band.bandKey}) 테스트 중...`)

      // Band API로 최근 게시물 1페이지 조회
      const url = `https://openapi.band.us/v2/band/posts?access_token=${actualUser.bandAccessToken}&band_key=${band.bandKey}&locale=ko_KR&limit=20`
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'BandAuto/1.0.0'
          }
        })

        const data = await response.json()

        if (data.result_code === 1 && data.result_data?.items) {
          const posts = data.result_data.items

          // 각 게시물의 날짜를 확인
          const postAnalysis = posts.map((post: any) => {
            const createdAtMs = parseInt(post.created_at) * 1000
            const postDate = new Date(createdAtMs)
            const kstDate = new Date(postDate.getTime() + (9 * 60 * 60 * 1000))
            
            return {
              post_key: post.post_key,
              title: post.title || '(제목 없음)',
              created_at: postDate.toISOString(),
              created_at_kst: kstDate.toISOString(),
              content_preview: (post.content || '').substring(0, 100)
            }
          })

          // 오늘 날짜 계산 (현재 로직과 동일)
          const today = new Date()
          const todayKST = new Date(today.getTime() + (9 * 60 * 60 * 1000))
          const todayStart = new Date(todayKST.getFullYear(), todayKST.getMonth(), todayKST.getDate())
          const todayEnd = new Date(todayStart)
          todayEnd.setDate(todayEnd.getDate() + 1)

          // 오늘 게시물 필터링
          const todayPosts = postAnalysis.filter(post => {
            const postTime = new Date(post.created_at_kst).getTime()
            return postTime >= todayStart.getTime() && postTime < todayEnd.getTime()
          })

          results.push({
            band_name: band.name,
            band_key: band.bandKey,
            total_posts_fetched: posts.length,
            today_date_range: {
              start: todayStart.toISOString(),
              end: todayEnd.toISOString()
            },
            today_posts_count: todayPosts.length,
            all_posts: postAnalysis,
            today_posts: todayPosts
          })

        } else {
          results.push({
            band_name: band.name,
            band_key: band.bandKey,
            error: `API 오류: result_code=${data.result_code}`,
            api_response: data
          })
        }

      } catch (error) {
        results.push({
          band_name: band.name,
          band_key: band.bandKey,
          error: `요청 실패: ${error}`,
        })
      }
    }

    return NextResponse.json({
      success: true,
      current_time: new Date().toISOString(),
      current_kst_time: new Date(Date.now() + (9 * 60 * 60 * 1000)).toISOString(),
      bands_analysis: results
    })

  } catch (error) {
    console.error('디버그 수집 테스트 실패:', error)
    return NextResponse.json({
      success: false,
      error: '테스트 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}