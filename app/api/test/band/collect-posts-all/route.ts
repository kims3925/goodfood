import { NextRequest, NextResponse } from 'next/server'

/**
 * 나은 상품 공급방 전체 게시물 수집 테스트 API (날짜 필터 없음)
 * GET /api/test/band/collect-posts-all?limit=10
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📋 나은 상품 공급방 전체 게시물 수집 시작...')
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const accessToken = process.env.BAND_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'BAND_ACCESS_TOKEN이 설정되지 않았습니다.',
        hint: '.env.local 파일의 BAND_ACCESS_TOKEN을 확인해주세요.'
      }, { status: 500 })
    }

    // 나은 상품 공급방 밴드 키
    const targetBandKey = 'AAAMvZteE5OjyYnjS64rQuH3'
    
    console.log('🎯 타겟 밴드:', targetBandKey)
    console.log('📊 요청 게시물 수:', limit)
    console.log('🔑 토큰 미리보기:', accessToken.substring(0, 20) + '...')

    // 밴드 게시물 목록 조회 (올바른 API 엔드포인트 사용)
    console.log('📥 게시물 목록 조회 중...')
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
      console.error('❌ 게시물 목록 조회 실패:', postsResponse.status, errorText)
      
      return NextResponse.json({
        success: false,
        error: `게시물 목록 조회 실패: HTTP ${postsResponse.status}`,
        details: errorText,
        api_endpoint: postsUrl.toString()
      }, { status: postsResponse.status })
    }

    const postsData = await postsResponse.json()
    console.log('✅ 게시물 목록 조회 성공')
    console.log('📊 총 게시물 수:', postsData.result_data?.items?.length || 0)
    console.log('🔍 응답 구조:', Object.keys(postsData.result_data || {}))

    if (!postsData.result_data?.items || postsData.result_data.items.length === 0) {
      return NextResponse.json({
        success: true,
        message: '게시물이 없습니다.',
        data: {
          bandKey: targetBandKey,
          totalPosts: 0,
          posts: []
        },
        raw_response: postsData
      })
    }

    // 게시물 처리 (최대 limit 개수만)
    const allPosts = postsData.result_data.items
    const processedPosts = []

    console.log('🔍 게시물 상세 정보 수집...')

    for (let i = 0; i < Math.min(allPosts.length, limit); i++) {
      const post = allPosts[i]
      
      try {
        console.log(`📝 게시물 [${i+1}/${Math.min(allPosts.length, limit)}]: ${post.post_key}`)

        // 게시물 작성일 확인 (created_at은 timestamp)
        const postDate = new Date(post.created_at * 1000) // timestamp를 Date로 변환
        const postDateKST = new Date(postDate.getTime() + (9 * 60 * 60 * 1000))
        const postDateString = postDateKST.toISOString().split('T')[0]

        // 게시물 정보 구조화
        const structuredPost = {
          // 기본 정보
          post_key: post.post_key,
          title: post.content?.substring(0, 50) + '...' || '제목 없음',
          
          // 작성자 정보
          author: {
            name: post.author?.name || '알 수 없음',
            profile_image: post.author?.profile_image_url || null
          },
          
          // 날짜 정보
          created_at: {
            timestamp: post.created_at,
            date: postDateString,
            formatted: postDateKST.toLocaleString('ko-KR'),
            days_ago: Math.floor((Date.now() - (post.created_at * 1000)) / (1000 * 60 * 60 * 24))
          },
          
          // 내용
          content: {
            text: post.content || '',
            preview: (post.content || '').substring(0, 200) + '...',
            length: (post.content || '').length
          },
          
          // 이미지 (기본 응답에서 가져올 수 있는 것)
          images: post.photos || [],
          
          // 상품 관련 정보 (파싱)
          product_info: {
            has_price: false,
            prices: [],
            has_product_info: false
          },
          
          // 메타데이터
          metadata: {
            likes_count: post.emotion_count || 0,
            comments_count: post.comment_count || 0,
            band_key: targetBandKey,
            band_name: '나은 상품 공급방'
          }
        }

        // 상품 정보 파싱 (가격, 상품명 등)
        const contentText = structuredPost.content.text.toLowerCase()
        
        // 가격 정보 추출 (원, 만원 등)
        const priceRegex = /(\d{1,3}(?:,\d{3})*)\s*(?:원|만원|천원)/g
        const priceMatches = [...contentText.matchAll(priceRegex)]
        if (priceMatches.length > 0) {
          structuredPost.product_info.has_price = true
          structuredPost.product_info.prices = priceMatches.map(match => ({
            text: match[0],
            amount: match[1].replace(',', ''),
            unit: match[0].includes('만원') ? '만원' : match[0].includes('천원') ? '천원' : '원'
          }))
        }

        // 상품 관련 키워드 검출
        const productKeywords = ['판매', '상품', '도매', '소매', '주문', '가격', '배송', '택배']
        structuredPost.product_info.has_product_info = productKeywords.some(keyword => 
          contentText.includes(keyword)
        )

        processedPosts.push(structuredPost)
        console.log(`✅ 게시물 처리 완료: ${post.post_key} (${structuredPost.created_at.days_ago}일 전)`)

      } catch (error) {
        console.error(`❌ 게시물 처리 중 오류 [${post.post_key}]:`, error)
        
        // 기본 정보만으로 추가
        processedPosts.push({
          post_key: post.post_key,
          title: '처리 오류',
          error: error instanceof Error ? error.message : String(error),
          raw_post: post
        })
      }

      // Rate limiting 방지 (300ms 대기)
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // 결과 정리
    const summary = {
      total_posts_available: allPosts.length,
      posts_processed: processedPosts.length,
      posts_with_images: processedPosts.filter(p => p.images && p.images.length > 0).length,
      posts_with_prices: processedPosts.filter(p => p.product_info?.has_price).length,
      product_related_posts: processedPosts.filter(p => p.product_info?.has_product_info).length,
      date_range: processedPosts.length > 0 ? {
        newest: Math.min(...processedPosts.map(p => p.created_at?.days_ago || 999)),
        oldest: Math.max(...processedPosts.map(p => p.created_at?.days_ago || 0))
      } : null
    }

    console.log('🎉 게시물 수집 완료!')
    console.log('📋 수집 요약:', summary)

    return NextResponse.json({
      success: true,
      message: `${processedPosts.length}개의 게시물을 수집했습니다. (총 ${allPosts.length}개 중)`,
      
      filter: {
        band_key: targetBandKey,
        band_name: '나은 상품 공급방',
        limit: limit,
        no_date_filter: true
      },
      
      summary,
      
      posts: processedPosts,
      
      api_info: {
        endpoint: postsUrl.toString(),
        response_structure: Object.keys(postsData.result_data || {}),
        result_code: postsData.result_code
      },
      
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 게시물 수집 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}