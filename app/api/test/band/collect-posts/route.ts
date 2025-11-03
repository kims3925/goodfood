import { NextRequest, NextResponse } from 'next/server'

/**
 * 나은 상품 공급방 게시물 수집 테스트 API
 * GET /api/test/band/collect-posts?date=today
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📋 나은 상품 공급방 게시물 수집 시작...')
    
    const { searchParams } = new URL(request.url)
    const dateFilter = searchParams.get('date') || 'today'
    
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
    console.log('📅 날짜 필터:', dateFilter)
    console.log('🔑 토큰 미리보기:', accessToken.substring(0, 20) + '...')

    // 오늘 날짜 기준 설정 (KST)
    const today = new Date()
    const todayKST = new Date(today.getTime() + (9 * 60 * 60 * 1000)) // UTC+9
    const todayDateString = todayKST.toISOString().split('T')[0] // YYYY-MM-DD

    console.log('🗓️ 오늘 날짜 (KST):', todayDateString)

    // 1단계: 밴드 게시물 목록 조회 (최근 20개) - 올바른 API 엔드포인트 사용
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
        troubleshooting: {
          status: postsResponse.status,
          common_issues: {
            401: '토큰이 만료되었거나 유효하지 않습니다.',
            403: '해당 밴드에 접근 권한이 없습니다.',
            404: '밴드를 찾을 수 없습니다.'
          }
        }
      }, { status: postsResponse.status })
    }

    const postsData = await postsResponse.json()
    console.log('✅ 게시물 목록 조회 성공')
    console.log('📊 총 게시물 수:', postsData.result_data?.items?.length || 0)

    // API 응답 구조 변경: posts -> items
    if (!postsData.result_data?.items) {
      return NextResponse.json({
        success: true,
        message: '게시물이 없습니다.',
        data: {
          bandKey: targetBandKey,
          totalPosts: 0,
          todayPosts: 0,
          posts: []
        }
      })
    }

    // 2단계: 오늘 날짜 게시물 필터링 및 상세 정보 수집
    const allPosts = postsData.result_data.items
    const todayPosts = []
    const detailedPosts = []

    console.log('🔍 오늘 게시물 필터링 및 상세 정보 수집...')

    for (const post of allPosts) {
      try {
        // 게시물 작성일 확인 (created_at은 이미 밀리초 단위 timestamp)
        const postDate = new Date(post.created_at) // 이미 밀리초 단위이므로 1000 곱하지 않음
        const postDateKST = new Date(postDate.getTime() + (9 * 60 * 60 * 1000))
        const postDateString = postDateKST.toISOString().split('T')[0]

        console.log(`📝 게시물 [${post.post_key}] - 작성일: ${postDateString}`)

        // 오늘 날짜 필터 적용
        if (dateFilter === 'today' && postDateString !== todayDateString) {
          console.log('⏭️ 오늘 게시물이 아님, 건너뛰기')
          continue
        }

        todayPosts.push(post)

        // 3단계: 각 게시물의 상세 정보 조회 - 정확한 v2.1 API 엔드포인트 사용
        console.log(`🔍 게시물 상세 조회: ${post.post_key}`)
        const detailUrl = new URL('https://openapi.band.us/v2.1/band/post')
        detailUrl.searchParams.append('access_token', accessToken)
        detailUrl.searchParams.append('band_key', targetBandKey)
        detailUrl.searchParams.append('post_key', post.post_key)
        
        const detailResponse = await fetch(detailUrl.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': 'BandAuto/1.0.0'
          }
        })

        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          const postDetail = detailData.result_data.post

          // 게시물 정보 구조화
          const structuredPost = {
            // 기본 정보
            post_key: post.post_key,
            title: post.content?.substring(0, 50) || '제목 없음',
            
            // 작성자 정보
            author: {
              name: post.author?.name || '알 수 없음',
              profile_image: post.author?.profile_image_url || null
            },
            
            // 날짜 정보
            created_at: {
              timestamp: post.created_at,
              date: postDateString,
              formatted: postDateKST.toLocaleString('ko-KR')
            },
            
            // 내용
            content: {
              text: post.content || '',
              full_text: postDetail?.content || post.content || '',
              preview: (post.content || '').substring(0, 200) + '...'
            },
            
            // 이미지
            images: [],
            
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

          // 이미지 추출 (photo 또는 photos 배열)
          if (postDetail?.photo && Array.isArray(postDetail.photo)) {
            structuredPost.images = postDetail.photo.map(photo => ({
              url: photo.url,
              width: photo.width || null,
              height: photo.height || null
            }))
          } else if (postDetail?.photos && Array.isArray(postDetail.photos)) {
            structuredPost.images = postDetail.photos.map(photo => ({
              url: photo.url,
              width: photo.width || null,
              height: photo.height || null
            }))
          }

          // 상품 정보 파싱 (가격, 상품명 등)
          const contentText = structuredPost.content.full_text.toLowerCase()
          
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

          detailedPosts.push(structuredPost)
          console.log(`✅ 게시물 상세 정보 수집 완료: ${post.post_key}`)

        } else {
          console.log(`⚠️ 게시물 상세 조회 실패: ${post.post_key} (${detailResponse.status})`)
          
          // 기본 정보만으로 구조화
          const basicPost = {
            post_key: post.post_key,
            title: post.content?.substring(0, 50) || '제목 없음',
            author: {
              name: post.author?.name || '알 수 없음',
              profile_image: post.author?.profile_image_url || null
            },
            created_at: {
              timestamp: post.created_at,
              date: postDateString,
              formatted: postDateKST.toLocaleString('ko-KR')
            },
            content: {
              text: post.content || '',
              preview: (post.content || '').substring(0, 200) + '...'
            },
            images: [],
            error: `상세 조회 실패: ${detailResponse.status}`
          }
          
          detailedPosts.push(basicPost)
        }

        // Rate limiting 방지 (300ms 대기)
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (error) {
        console.error(`❌ 게시물 처리 중 오류 [${post.post_key}]:`, error)
      }
    }

    // 4단계: 수집 결과 정리
    console.log('📊 수집 결과 정리...')
    
    const summary = {
      total_posts_checked: allPosts.length,
      today_posts_found: todayPosts.length,
      detailed_posts_collected: detailedPosts.length,
      posts_with_images: detailedPosts.filter(p => p.images && p.images.length > 0).length,
      posts_with_prices: detailedPosts.filter(p => p.product_info?.has_price).length,
      product_related_posts: detailedPosts.filter(p => p.product_info?.has_product_info).length
    }

    console.log('🎉 게시물 수집 완료!')
    console.log('📋 수집 요약:', summary)

    return NextResponse.json({
      success: true,
      message: `${summary.today_posts_found}개의 오늘 게시물을 찾았습니다. (총 ${summary.detailed_posts_collected}개 상세 수집)`,
      
      filter: {
        date: dateFilter,
        target_date: todayDateString,
        band_key: targetBandKey,
        band_name: '나은 상품 공급방'
      },
      
      summary,
      
      posts: detailedPosts,
      
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