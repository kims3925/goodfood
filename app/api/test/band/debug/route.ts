import { NextRequest, NextResponse } from 'next/server'
import { NaverBandClient } from '@/lib/api/band-client'

/**
 * 밴드 API 디버깅용 엔드포인트
 * GET /api/test/band/debug?bandKey=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bandKey = searchParams.get('bandKey') || 'AAAMvZteE5OjyYnjS64rQuH3'
    
    console.log('🔍 밴드 API 디버깅 시작...')
    console.log('📍 대상 밴드:', bandKey)

    const bandClient = new NaverBandClient()
    
    // 1단계: 날짜 파라미터 없이 기본 게시물 조회 시도
    console.log('1️⃣ 기본 게시물 조회 (날짜 필터 없음)...')
    try {
      const basicPosts = await bandClient.getBandPosts(bandKey, { limit: 5 })
      console.log(`✅ 기본 조회 성공: ${basicPosts.length}개 게시물`)
      
      // 2단계: 최근 게시물의 날짜 확인
      if (basicPosts.length > 0) {
        console.log('📅 최근 게시물 날짜들:')
        basicPosts.forEach((post, idx) => {
          console.log(`  ${idx + 1}. ${post.created_at} - ${post.content.substring(0, 50)}...`)
        })
        
        // 3단계: 다양한 날짜 형식으로 테스트
        const testDates = [
          // 오늘 (여러 형식)
          new Date().toISOString(),
          new Date().toISOString().split('T')[0], // YYYY-MM-DD
          new Date().toDateString(),
          
          // 어제부터 오늘까지
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          
          // 최근 3일
          new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        ]
        
        const testResults = []
        
        for (const testDate of testDates) {
          try {
            console.log(`🧪 테스트 날짜: ${testDate}`)
            const testPosts = await bandClient.getBandPosts(bandKey, {
              since: testDate,
              limit: 3
            })
            
            testResults.push({
              date: testDate,
              success: true,
              count: testPosts.length,
              posts: testPosts.map(p => ({
                created_at: p.created_at,
                content_preview: p.content.substring(0, 100)
              }))
            })
            
            console.log(`  ✅ 성공: ${testPosts.length}개`)
            
          } catch (error) {
            console.log(`  ❌ 실패:`, error instanceof Error ? error.message : error)
            testResults.push({
              date: testDate,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            })
          }
          
          // Rate limiting 방지
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        return NextResponse.json({
          success: true,
          message: '디버깅 완료',
          data: {
            bandKey,
            basicPostsCount: basicPosts.length,
            recentPosts: basicPosts.map(post => ({
              post_key: post.post_key,
              created_at: post.created_at,
              updated_at: post.updated_at,
              content_preview: post.content.substring(0, 200),
              has_images: post.photo && post.photo.length > 0,
              image_count: post.photo?.length || 0
            })),
            dateFormatTests: testResults,
            currentTime: {
              utc: new Date().toISOString(),
              kst: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
              local: new Date().toString()
            }
          }
        })
        
      } else {
        return NextResponse.json({
          success: true,
          message: '해당 밴드에 게시물이 없습니다.',
          data: { bandKey, basicPostsCount: 0 }
        })
      }
      
    } catch (basicError) {
      console.error('❌ 기본 게시물 조회 실패:', basicError)
      
      return NextResponse.json({
        success: false,
        error: '기본 게시물 조회 실패',
        details: {
          bandKey,
          error: basicError instanceof Error ? basicError.message : String(basicError),
          suggestions: [
            '1. 밴드 키가 올바른지 확인',
            '2. 해당 밴드에 접근 권한이 있는지 확인',
            '3. 비공개 밴드의 경우 멤버 권한 필요'
          ]
        }
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ 디버깅 테스트 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}