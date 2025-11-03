import { NextRequest, NextResponse } from 'next/server'
import { NaverBandClient } from '@/lib/api/band-client'

/**
 * 특정 밴드의 오늘 게시물 수집 테스트
 * GET /api/test/band/posts?bandKey=xxx&date=today
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bandKey = searchParams.get('bandKey')
    const dateFilter = searchParams.get('date') || 'today'
    
    console.log('🧪 밴드 게시물 수집 테스트 시작...')
    console.log('📍 대상 밴드:', bandKey)
    console.log('📅 수집 기준:', dateFilter)

    if (!bandKey) {
      return NextResponse.json({
        success: false,
        error: 'bandKey 파라미터가 필요합니다.',
        example: '/api/test/band/posts?bandKey=AAAMvZteE5OjyYnjS64rQuH3&date=today'
      }, { status: 400 })
    }

    // Band API 클라이언트 초기화
    const bandClient = new NaverBandClient()
    
    // 오늘 날짜 범위 설정 (KST 기준)
    const today = new Date()
    const koreaTime = new Date(today.getTime() + (9 * 60 * 60 * 1000)) // UTC + 9
    
    // 오늘 00:00:00 KST
    const startOfDay = new Date(koreaTime)
    startOfDay.setHours(0, 0, 0, 0)
    
    // 오늘 23:59:59 KST  
    const endOfDay = new Date(koreaTime)
    endOfDay.setHours(23, 59, 59, 999)
    
    console.log('🕐 수집 시간 범위:')
    console.log('  시작:', startOfDay.toISOString())
    console.log('  종료:', endOfDay.toISOString())

    // 1단계: 기본 게시물 목록 수집
    console.log('1️⃣ 기본 게시물 목록 수집...')
    const posts = await bandClient.getBandPosts(bandKey, {
      since: startOfDay.toISOString(),
      until: endOfDay.toISOString(),
      limit: 20  // 최대 20개
    })
    
    console.log(`📝 총 ${posts.length}개의 게시물을 찾았습니다.`)

    if (posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: '오늘 올라온 게시물이 없습니다.',
        data: {
          bandKey,
          dateRange: {
            start: startOfDay.toISOString(),
            end: endOfDay.toISOString()
          },
          postsFound: 0,
          posts: []
        }
      })
    }

    // 2단계: 각 게시물의 상세 정보 수집
    console.log('2️⃣ 게시물 상세 정보 수집...')
    const detailedPosts = []
    
    for (let i = 0; i < Math.min(posts.length, 10); i++) { // 최대 10개만 상세 수집
      const post = posts[i]
      
      try {
        console.log(`  📋 ${i + 1}/${posts.length}: ${post.post_key} 상세 정보 수집...`)
        
        const detailPost = await bandClient.getPostDetail(bandKey, post.post_key)
        
        if (detailPost) {
          // 이미지 정보 처리
          const images = detailPost.photo || []
          const imageUrls = images.map(img => ({
            original: img.url,
            thumbnail: img.thumbnail_url
          }))
          
          // 게시물 정보 구조화
          const structuredPost = {
            // 기본 정보
            post_key: detailPost.post_key,
            band_key: detailPost.band_key,
            
            // 내용 정보
            title: extractTitle(detailPost.content),
            content: detailPost.content,
            contentLength: detailPost.content.length,
            
            // 작성자 정보
            author: {
              user_key: detailPost.author.user_key,
              name: detailPost.author.name,
              profile_image: detailPost.author.profile_image || null
            },
            
            // 이미지 정보
            images: imageUrls,
            imageCount: images.length,
            
            // 메타데이터
            created_at: detailPost.created_at,
            updated_at: detailPost.updated_at,
            comment_count: detailPost.comment_count,
            emotion_count: detailPost.emotion_count,
            
            // 분석용 데이터
            containsPriceInfo: containsPriceKeywords(detailPost.content),
            containsProductInfo: containsProductKeywords(detailPost.content),
            estimatedProductCount: estimateProductCount(detailPost.content)
          }
          
          detailedPosts.push(structuredPost)
          
          // API 호출 간격 조절 (Rate Limiting 대응)
          if (i < posts.length - 1) {
            await sleep(200) // 200ms 대기
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ 게시물 ${post.post_key} 상세 정보 수집 실패:`, error)
        
        // 기본 정보만으로 구조화
        detailedPosts.push({
          post_key: post.post_key,
          band_key: post.band_key,
          title: extractTitle(post.content),
          content: post.content,
          contentLength: post.content.length,
          author: post.author,
          images: post.photo?.map(img => ({
            original: img.url,
            thumbnail: img.thumbnail_url
          })) || [],
          imageCount: post.photo?.length || 0,
          created_at: post.created_at,
          updated_at: post.updated_at,
          comment_count: post.comment_count,
          emotion_count: post.emotion_count,
          containsPriceInfo: containsPriceKeywords(post.content),
          containsProductInfo: containsProductKeywords(post.content),
          estimatedProductCount: estimateProductCount(post.content),
          error: 'Failed to fetch detailed info'
        })
      }
    }

    // 3단계: 결과 분석
    const analysis = {
      totalPosts: posts.length,
      detailedPosts: detailedPosts.length,
      postsWithImages: detailedPosts.filter(p => p.imageCount > 0).length,
      postsWithPriceInfo: detailedPosts.filter(p => p.containsPriceInfo).length,
      postsWithProductInfo: detailedPosts.filter(p => p.containsProductInfo).length,
      totalImages: detailedPosts.reduce((sum, p) => sum + p.imageCount, 0),
      averageContentLength: Math.round(
        detailedPosts.reduce((sum, p) => sum + p.contentLength, 0) / detailedPosts.length
      )
    }

    console.log('✅ 수집 완료! 분석 결과:', analysis)

    return NextResponse.json({
      success: true,
      message: `오늘 올라온 ${posts.length}개 게시물 중 ${detailedPosts.length}개 상세 수집 완료`,
      data: {
        bandKey,
        bandName: getBandName(bandKey),
        dateRange: {
          start: startOfDay.toISOString(),
          end: endOfDay.toISOString()
        },
        analysis,
        posts: detailedPosts
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 게시물 수집 테스트 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// 헬퍼 함수들

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractTitle(content: string): string {
  // 첫 번째 줄을 제목으로 추출 (최대 100자)
  const firstLine = content.split('\n')[0].trim()
  return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine
}

function containsPriceKeywords(content: string): boolean {
  const priceKeywords = ['원', '가격', '할인', '특가', '세일', '₩', '만원', '천원', '정가']
  const numberPattern = /\d{1,3}(,\d{3})*/
  
  return priceKeywords.some(keyword => content.includes(keyword)) && numberPattern.test(content)
}

function containsProductKeywords(content: string): boolean {
  const productKeywords = ['상품', '제품', '아이템', '품목', '판매', '주문', '구매', '신상', '재입고']
  
  return productKeywords.some(keyword => content.includes(keyword))
}

function estimateProductCount(content: string): number {
  // 간단한 상품 개수 추정 로직
  const bulletPoints = (content.match(/[•▶▷→-]\s/g) || []).length
  const numberedItems = (content.match(/\d+\.\s/g) || []).length
  const lineBreaks = (content.match(/\n/g) || []).length
  
  return Math.max(bulletPoints, numberedItems, Math.floor(lineBreaks / 3))
}

function getBandName(bandKey: string): string {
  const bandNames: Record<string, string> = {
    'AAAMvZteE5OjyYnjS64rQuH3': '나은 상품 공급방'
  }
  
  return bandNames[bandKey] || 'Unknown Band'
}