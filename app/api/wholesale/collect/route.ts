import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { analyzeProductContent, analyzeProductContentWithPolicy, parallelBatchAnalyzeProducts } from '@/lib/gemini-ai'
import { validateBandToken, ensureValidToken } from '@/lib/band-token-refresh'

// 데이터베이스 저장을 위한 강화된 콘텐츠 정화 함수
function sanitizeContent(content: string | null | undefined): string {
  if (!content) return ''

  try {
    // 1단계: 기본 정화
    let sanitized = content.toString()

    // 2단계: 모든 백슬래시를 먼저 제거 (hex escape 오류 방지)
    sanitized = sanitized.replace(/\\/g, '')

    // 3단계: 제어 문자 및 NULL 바이트 제거
    sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    sanitized = sanitized.replace(/\x00/g, '') // NULL 바이트 제거

    // 4단계: 특수 문자 제거 (따옴표, 백틱 등)
    sanitized = sanitized.replace(/['"`]/g, '') // 따옴표 제거

    // 5단계: 특수한 유니코드 문자 정리
    sanitized = sanitized.replace(/[\uFFF0-\uFFFF]/g, '') // 특수 유니코드 범위 제거

    // 6단계: 연속된 공백 정리
    sanitized = sanitized.replace(/\s+/g, ' ')

    // 7단계: 길이 제한 (데이터베이스 필드 제한 고려)
    if (sanitized.length > 5000) { // 5KB 제한으로 축소
      sanitized = sanitized.substring(0, 5000) + '...'
    }

    return sanitized.trim()

  } catch (error) {
    console.error('콘텐츠 정화 중 오류 발생:', error, '원본:', content?.slice(0, 100))
    // 오류 시 매우 보수적인 안전 문자열 반환
    return content?.toString()
      .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ0-9]/g, '') // 문자, 숫자, 한글, 공백만 허용
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000) || ''
  }
}

// 문자열 유사도 계산 함수 (Jaccard 유사도)
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0

  // 문자열을 단어로 분할
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(word => word.length > 1))
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(word => word.length > 1))

  // 교집합과 합집합 계산
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  // Jaccard 유사도 = 교집합 / 합집합
  return intersection.size / union.size
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const { bandId, dateRange } = await request.json()

    if (!bandId) {
      return NextResponse.json({
        success: false,
        error: '밴드 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 실제 사용자 ID 찾기 (ID 또는 이메일로)
    let actualUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })

    if (!actualUser) {
      actualUser = await prisma.user.findUnique({
        where: { email: session.user.email || '' },
        select: { id: true }
      })
    }

    if (!actualUser) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 해당 밴드가 사용자의 것인지 확인 (댓글 수집 여부 포함)
    const wholesaleBand = await prisma.wholesaleBand.findFirst({
      where: {
        id: bandId,
        userId: actualUser.id
      },
      select: {
        id: true,
        name: true,
        bandKey: true,
        collectComments: true,
        // 가격정책 정보
        pricingPolicy: true
      }
    })

    if (!wholesaleBand) {
      return NextResponse.json({
        success: false,
        error: '해당 밴드에 접근할 수 없습니다.'
      }, { status: 403 })
    }

    // 환경변수에서 밴드 API 토큰 사용 (개발 단계)
    let accessToken = process.env.BAND_ACCESS_TOKEN
    console.log('🔐 전체 환경변수 로드 상태:', {
      NODE_ENV: process.env.NODE_ENV,
      BAND_ACCESS_TOKEN: accessToken ? `${accessToken.slice(0, 10)}...` : '없음',
      BAND_CLIENT_ID: process.env.BAND_CLIENT_ID ? '설정됨' : '없음',
      GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY ? '설정됨' : '없음'
    })
    
    if (!accessToken) {
      console.error('❌ BAND_ACCESS_TOKEN이 없습니다. .env.local 파일을 확인하세요.')
      return NextResponse.json({
        success: false,
        error: '밴드 API 토큰이 설정되지 않았습니다. 환경변수 BAND_ACCESS_TOKEN을 설정해주세요.',
        debug: {
          envLoaded: !!process.env.BAND_ACCESS_TOKEN,
          nodeEnv: process.env.NODE_ENV
        }
      }, { status: 400 })
    }

    // 토큰 유효성 검사
    console.log('🔍 토큰 유효성 검사 중...')
    const isTokenValid = await validateBandToken(accessToken)
    
    if (!isTokenValid) {
      // Band API에서 할당량 초과 확인
      try {
        const testUrl = new URL('https://openapi.band.us/v2/profile')
        testUrl.searchParams.append('access_token', accessToken)
        const testResponse = await fetch(testUrl.toString())
        const testData = await testResponse.json()
        
        if (testData.result_code === 1001) {
          return NextResponse.json({
            success: false,
            error: 'Band API 일일 할당량이 초과되었습니다. 내일 다시 시도하거나 Band Developers에서 할당량을 확인해주세요.',
            errorType: 'quota_exceeded',
            retryAfter: '24시간 후'
          }, { status: 429 })
        }
      } catch (quotaError) {
        console.error('할당량 확인 중 오류:', quotaError)
      }
      
      return NextResponse.json({
        success: false,
        error: 'Band API 토큰이 만료되었거나 유효하지 않습니다. 새로운 토큰을 발급받아 주세요.',
        needsTokenRefresh: true
      }, { status: 401 })
    }
    
    console.log('✅ 토큰 유효성 검사 통과')

    // 날짜 범위 설정 (사용자 지정 또는 전체 수집)
    let recentStart, todayEnd, isFullCollection = false
    
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      // 사용자가 지정한 날짜 범위 사용
      recentStart = new Date(dateRange.startDate + 'T00:00:00.000Z')
      todayEnd = new Date(dateRange.endDate + 'T23:59:59.999Z')
      console.log(`📅 사용자 지정 날짜 범위: ${dateRange.startDate} ~ ${dateRange.endDate}`)
    } else {
      // 기간 미설정시 전체 게시물 수집 (최근 30일)
      isFullCollection = true
      const today = new Date()
      const todayKST = new Date(today.getTime() + (9 * 60 * 60 * 1000)) // UTC+9
      recentStart = new Date(todayKST.getFullYear(), todayKST.getMonth(), todayKST.getDate())
      recentStart.setDate(recentStart.getDate() - 30) // 30일 전부터
      todayEnd = new Date(todayKST.getFullYear(), todayKST.getMonth(), todayKST.getDate())
      todayEnd.setDate(todayEnd.getDate() + 1) // 오늘 끝까지
      console.log(`📅 전체 수집 모드: 최근 30일 (${recentStart.toISOString().split('T')[0]} ~ ${todayEnd.toISOString().split('T')[0]})`)
    }

    console.log(`🗺️ 수집 날짜 범위: ${recentStart.toISOString()} ~ ${todayEnd.toISOString()}`)

    // Band API에서 페이징으로 모든 오늘 게시물 가져오기
    let allTodayPosts: any[] = []
    let hasMorePosts = true
    let after: string | null = null
    let pageCount = 0
    const maxPages = 50 // 안전장치: 최대 50페이지 (1000개 게시물)

    while (hasMorePosts && pageCount < maxPages) {
      pageCount++
      console.log(`📄 페이지 ${pageCount} 요청 중...`)

      // API URL 구성 (URL 파라미터 방식으로 변경)
      const postsUrl = new URL('https://openapi.band.us/v2/band/posts')
      postsUrl.searchParams.append('access_token', accessToken)
      postsUrl.searchParams.append('band_key', wholesaleBand.bandKey)
      postsUrl.searchParams.append('locale', 'ko_KR')
      if (after) {
        postsUrl.searchParams.append('after', after)
      }
      
      console.log('Band API 요청 URL (토큰 제외):', postsUrl.toString().replace(accessToken, '[HIDDEN]'))
      
      const postsResponse = await fetch(postsUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'BandAuto/1.0.0'
        }
      })

      if (!postsResponse.ok) {
        console.error('Band API 응답 오류:', postsResponse.status, postsResponse.statusText)
        
        // 응답 본문도 확인
        const errorText = await postsResponse.text()
        console.error('Band API 오류 응답 본문:', errorText)
        
        if (postsResponse.status === 401) {
          return NextResponse.json({
            success: false,
            error: `Band API 인증 실패: ${errorText || '토큰이 유효하지 않거나 만료되었습니다.'}`,
            needsTokenRefresh: true,
            bandApiError: errorText
          }, { status: 401 })
        }
        
        return NextResponse.json({
          success: false,
          error: `Band API 오류: ${postsResponse.status} - ${errorText || postsResponse.statusText}`,
          bandApiError: errorText
        }, { status: 500 })
      }

      const postsData = await postsResponse.json()
      
      // 응답 구조 확인
      if (!postsData.result_data?.items) {
        console.error('Band API 응답 구조가 예상과 다릅니다:', postsData)
        break
      }

      const currentPagePosts = postsData.result_data.items
      console.log(`📋 페이지 ${pageCount}에서 ${currentPagePosts.length}개 게시물 수신`)

      // 지정된 기간에 해당하는 게시물만 필터링
      const todayPostsInPage = currentPagePosts.filter((post: any) => {
        const postDate = new Date(post.created_at)
        return postDate >= recentStart && postDate < todayEnd
      })

      console.log(`📅 페이지 ${pageCount}에서 기간 내 게시물: ${todayPostsInPage.length}개`)

      // 오늘 게시물을 결과에 추가
      allTodayPosts.push(...todayPostsInPage)

      // 다음 페이지 확인
      if (currentPagePosts.length < 20) {
        // 20개 미만이면 마지막 페이지
        hasMorePosts = false
        console.log('📄 마지막 페이지에 도달했습니다.')
      } else if (todayPostsInPage.length === 0 && currentPagePosts.length === 20 && !isFullCollection) {
        // 기간 내 게시물이 없고 페이지가 가득 차있으면, 지정된 기간 이전 날짜로 넘어간 것이므로 중단 (전체 수집이 아닌 경우만)
        console.log('📅 지정된 기간 이전 날짜의 게시물에 도달하여 수집을 중단합니다.')
        hasMorePosts = false
      } else {
        // 다음 페이지 요청을 위한 after 파라미터 설정
        after = currentPagePosts[currentPagePosts.length - 1].post_key
        console.log(`➡️ 다음 페이지 요청을 위한 after: ${after}`)
      }

      // API 요청 간 간격 (요청 제한 방지)
      if (hasMorePosts) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`🎉 수집 완료! 총 ${pageCount}페이지에서 기간 내 게시물 ${allTodayPosts.length}개 발견`)

    // 1차 중복 제거 (post_key 기준)
    const uniqueByKeyPosts = allTodayPosts.filter((post, index, self) =>
      index === self.findIndex(p => p.post_key === post.post_key)
    )

    // 2차 고급 중복 제거 (제목 유사도 기준)
    const uniqueTodayPosts = []
    const processedTitles = new Set()

    for (const post of uniqueByKeyPosts) {
      const postTitle = (post.content || '').trim().toLowerCase()
      const cleanTitle = postTitle
        .replace(/[0-9,원₩$]/g, '')
        .replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      // 이미 처리된 제목과 80% 이상 유사한지 확인
      let isDuplicate = false
      for (const existingTitle of processedTitles) {
        if (cleanTitle && existingTitle && cleanTitle.length > 5 && existingTitle.length > 5) {
          const similarity = calculateSimilarity(cleanTitle, existingTitle)
          if (similarity > 0.8) {
            console.log(`🔄 API 단계에서 유사 제목 중복 제거: "${cleanTitle.slice(0, 30)}..." (유사도: ${(similarity * 100).toFixed(1)}%)`)
            isDuplicate = true
            break
          }
        }
      }

      if (!isDuplicate && cleanTitle.length > 5) {
        uniqueTodayPosts.push(post)
        processedTitles.add(cleanTitle)
      }
    }

    console.log(`🔄 고급 중복 제거 후: ${uniqueTodayPosts.length}개의 고유한 기간 내 게시물 (${uniqueByKeyPosts.length - uniqueTodayPosts.length}개 추가 제거)`)

    // 댓글 수집 함수 (accessToken을 외부에서 가져옴)
    const fetchComments = async (postKey: string): Promise<string[]> => {
      if (!wholesaleBand.collectComments) {
        return []
      }

      try {
        const commentsUrl = new URL('https://openapi.band.us/v2/band/post/comments')
        commentsUrl.searchParams.append('access_token', accessToken)
        commentsUrl.searchParams.append('band_key', wholesaleBand.bandKey)
        commentsUrl.searchParams.append('post_key', postKey)
        commentsUrl.searchParams.append('locale', 'ko_KR')

        const commentsResponse = await fetch(commentsUrl.toString())
        if (!commentsResponse.ok) {
          console.warn(`댓글 수집 실패 for post ${postKey}:`, commentsResponse.status)
          return []
        }

        const commentsData = await commentsResponse.json()
        if (commentsData.result_data?.items) {
          return commentsData.result_data.items.map((comment: any) => comment.content || comment.body || '')
        }
        
        return []
      } catch (error) {
        console.error(`댓글 수집 오류 for post ${postKey}:`, error)
        return []
      }
    }

    // 🚀 병렬 + 배치 처리 방식으로 데이터베이스 저장 및 AI 분석
    const savedPosts = []

    // 1단계: 새로운 게시물 필터링 및 기본 데이터 준비 (중복 방지 강화)
    console.log('📦 1단계: 새로운 게시물 필터링 및 중복 체크 중...')

    // 1-0: 대량 중복 체크 - DB 쿼리를 한 번으로 줄여 성능 향상
    const existingPostIds = new Set()
    if (uniqueTodayPosts.length > 0) {
      const allPostKeys = uniqueTodayPosts.map(post => post.post_key)
      const existingPosts = await prisma.collectedPost.findMany({
        where: {
          bandPostId: { in: allPostKeys },
          wholesaleBandId: wholesaleBand.id
        },
        select: { bandPostId: true }
      })

      existingPosts.forEach(post => existingPostIds.add(post.bandPostId))
      console.log(`🔍 DB에서 기존 게시물 ${existingPosts.length}개 확인됨`)
    }

    const newPostsData = []
    const seenTitles = new Set() // 제목 기반 중복 방지용
    const seenImages = new Set() // 이미지 기반 중복 방지용

    for (const post of uniqueTodayPosts) {
      // 1-1: post_key 기반 중복 체크 (개선된 로직 - 대량 조회로 성능 향상)
      if (existingPostIds.has(post.post_key)) {
        console.log(`🔄 이미 수집됨 (post_key): ${post.post_key}`)
        continue
      }

      // 1-2: 제목 기반 중복 체크 (새로운 로직 - 더 엄격하게)
      const postTitle = (post.content || '').trim().toLowerCase()
      const titleKey = postTitle.slice(0, 50) // 첫 50자를 제목으로 간주

      // 제목의 핵심 키워드 추출 (가격, 기호 제거 후)
      const cleanTitle = titleKey
        .replace(/[0-9,원₩$]/g, '') // 가격 관련 문자 제거
        .replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, ' ') // 특수 문자를 공백으로
        .replace(/\s+/g, ' ') // 연속 공백 정리
        .trim()

      if (cleanTitle && cleanTitle.length > 10 && seenTitles.has(cleanTitle)) {
        console.log(`🔄 제목 중복 상품 건너뜀: ${cleanTitle.slice(0, 30)}...`)
        continue
      }

      // 1-3: 이미지 기반 중복 체크 (추가 보완)
      let isDuplicateByImage = false
      if (post.photos && Array.isArray(post.photos) && post.photos.length > 0) {
        const firstImageUrl = post.photos[0]?.url
        if (firstImageUrl && seenImages.has(firstImageUrl)) {
          console.log(`🖼️ 이미지 중복 상품 건너뜀: ${post.post_key}`)
          isDuplicateByImage = true
          continue
        }
        if (firstImageUrl) {
          seenImages.add(firstImageUrl)
        }
      }

      // 1-4: DB에서 유사한 제목의 상품이 있는지 체크 (더 정교하게)
      if (cleanTitle && cleanTitle.length > 10) {
        // 여러 키워드로 더 정교하게 검색
        const keywords = cleanTitle.split(' ').filter(word => word.length > 2).slice(0, 3) // 첫 3개 키워드
        let foundSimilar = false

        for (const keyword of keywords) {
          if (keyword.length >= 3) {
            const similarPost = await prisma.collectedPost.findFirst({
              where: {
                wholesaleBandId: wholesaleBand.id,
                OR: [
                  {
                    title: {
                      contains: keyword
                    }
                  },
                  {
                    hookingTitle: {
                      contains: keyword
                    }
                  },
                  {
                    content: {
                      contains: keyword
                    }
                  }
                ]
              }
            })

            if (similarPost) {
              console.log(`🔄 키워드 "${keyword}" 기반 유사 상품 존재: ${similarPost.title?.slice(0, 30)}...`)
              foundSimilar = true
              break
            }
          }
        }

        if (foundSimilar) {
          continue
        }

        seenTitles.add(cleanTitle)
      } else if (titleKey) {
        // cleanTitle이 너무 짧으면 원본 titleKey 사용
        seenTitles.add(titleKey)
      }

      // 1-5: 이미 현재 배치에서 처리 중인 게시물들과도 중복 체크
      const alreadyProcessed = newPostsData.find(existingItem => {
        const existingCleanTitle = (existingItem.post.content || '')
          .trim()
          .toLowerCase()
          .slice(0, 50)
          .replace(/[0-9,원₩$]/g, '')
          .replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        // 제목이 80% 이상 유사하면 중복으로 판단
        if (cleanTitle && existingCleanTitle && cleanTitle.length > 5 && existingCleanTitle.length > 5) {
          const similarity = calculateSimilarity(cleanTitle, existingCleanTitle)
          return similarity > 0.8
        }

        return false
      })

      if (alreadyProcessed) {
        console.log(`🔄 현재 배치에서 이미 처리 중인 유사 상품: ${cleanTitle.slice(0, 30)}...`)
        continue
      }

      // 새로운 상품으로 처리
      // 이미지 URL 추출
      const images = []
      if (post.photos && Array.isArray(post.photos)) {
        images.push(...post.photos.map((photo: any) => photo.url))
      }

      // 댓글 수집 (필요한 경우만)
      const comments = await fetchComments(post.post_key)
      console.log(`💬 게시물 ${post.post_key}의 댓글 ${comments.length}개 수집`)

      newPostsData.push({
        post,
        images,
        comments
      })
    }

    console.log(`📋 처리할 새로운 게시물: ${newPostsData.length}개`)

    // 새로운 게시물이 없는 경우 통계와 함께 반환
    if (newPostsData.length === 0) {
      const uniqueByKeyCount = allTodayPosts.filter((post, index, self) =>
        index === self.findIndex(p => p.post_key === post.post_key)
      ).length
      const duplicatesRemovedCount = allTodayPosts.length - uniqueByKeyCount
      const similarityRemovedCount = uniqueByKeyCount - uniqueTodayPosts.length
      const dbDuplicatesCount = uniqueTodayPosts.length - newPostsData.length

      return NextResponse.json({
        success: true,
        message: `모든 게시물이 이미 등록되었거나 중복입니다. (총 ${allTodayPosts.length}개 → post_key 중복 ${duplicatesRemovedCount}개 제거 → 유사도 중복 ${similarityRemovedCount}개 제거 → DB 중복 ${dbDuplicatesCount}개 제거 = 최종 0개)`,
        totalFound: allTodayPosts.length,
        uniqueByKey: uniqueByKeyCount,
        uniqueAfterSimilarity: uniqueTodayPosts.length,
        duplicatesRemovedByKey: duplicatesRemovedCount,
        duplicatesRemovedBySimilarity: similarityRemovedCount,
        duplicatesRemovedByDB: dbDuplicatesCount,
        newPosts: 0,
        filteredOut: 0,
        totalPages: pageCount,
        aiAnalyzed: 0,
        commentsCollected: 0,
        policyApplied: wholesaleBand.pricingPolicy ? true : false,
        duplicatePreventionEnabled: true,
        posts: []
      })
    }

    if (newPostsData.length > 0) {
      // 2단계: 병렬 + 배치 AI 분석 실행
      console.log('🚀 2단계: 병렬 배치 AI 분석 시작...')
      const analysisStartTime = Date.now()

      // AI 분석용 데이터 준비 (정책 가격 적용 강화)
      const postsForAI = newPostsData.map(item => ({
        title: item.post.content?.slice(0, 100) || '제목 없음',
        content: item.post.content || '',
        comments: item.comments,
        pricingPolicy: wholesaleBand.pricingPolicy || undefined,
        bandName: wholesaleBand.name // 정책 적용 디버깅용
      }))

      console.log(`🎯 정책 적용 정보: ${wholesaleBand.name} - ${wholesaleBand.pricingPolicy ? '정책 있음' : '정책 없음'}`)

      // 병렬 + 배치 AI 분석 실행 (Rate Limit 고려)
      let aiAnalysisResults
      try {
        aiAnalysisResults = await parallelBatchAnalyzeProducts(
          postsForAI,
          3,  // 배치 크기: 3개씩 묶어서 처리 (Rate Limit 방지)
          1   // 동시 처리: 1개 배치만 순차 실행 (15 RPM 제한 준수)
        )
      } catch (aiError) {
        console.error('❌ AI 분석 실패:', aiError)

        const errorMessage = aiError instanceof Error ? aiError.message : String(aiError)

        // 에러 타입별 명확한 메시지 분류
        let userFriendlyError = ''
        let errorType = 'AI_ANALYSIS_FAILED'
        let statusCode = 503

        if (errorMessage.includes('API key') || errorMessage.includes('GOOGLE_AI_API_KEY')) {
          userFriendlyError = '❌ Gemini API 키가 설정되지 않았습니다. .env.local 파일에서 GOOGLE_AI_API_KEY를 확인해주세요.'
          errorType = 'API_KEY_MISSING'
          statusCode = 500
        } else if (errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
          userFriendlyError = '❌ Gemini API 할당량이 초과되었습니다. 새 API 키를 발급받거나 내일 다시 시도해주세요.'
          errorType = 'QUOTA_EXCEEDED'
          statusCode = 429
        } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          userFriendlyError = '❌ Gemini API 모델을 찾을 수 없습니다. API 키가 올바른지 확인해주세요.'
          errorType = 'MODEL_NOT_FOUND'
          statusCode = 500
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          userFriendlyError = '❌ Gemini API 연결에 실패했습니다. 인터넷 연결을 확인해주세요.'
          errorType = 'NETWORK_ERROR'
          statusCode = 503
        } else {
          userFriendlyError = '❌ AI 분석 중 알 수 없는 오류가 발생했습니다. 관리자에게 문의해주세요.'
          errorType = 'UNKNOWN_ERROR'
          statusCode = 500
        }

        return NextResponse.json({
          success: false,
          error: userFriendlyError,
          errorDetail: errorMessage,
          errorType: errorType,
          suggestion: errorType === 'QUOTA_EXCEEDED'
            ? 'https://aistudio.google.com/apikey 에서 새 API 키를 발급받아주세요.'
            : errorType === 'API_KEY_MISSING'
            ? '.env.local 파일에 GOOGLE_AI_API_KEY="your-api-key" 를 추가해주세요.'
            : '문제가 지속되면 시스템 관리자에게 문의해주세요.'
        }, { status: statusCode })
      }

      // 2-1단계: 가격 정보가 없는 상품 필터링
      console.log('📋 2-1단계: 가격 정보 검증 및 필터링 중...')
      const validPostsData = []
      const validAnalysisResults = []
      let filteredOutCount = 0

      for (let i = 0; i < newPostsData.length; i++) {
        const item = newPostsData[i]
        const aiAnalysis = aiAnalysisResults[i]
        
        // 가격 정보 검증
        const hasPrice = (
          aiAnalysis?.extractedPrice && aiAnalysis.extractedPrice > 0
        ) || (
          aiAnalysis?.priceOptions && 
          Array.isArray(aiAnalysis.priceOptions) && 
          aiAnalysis.priceOptions.length > 0 &&
          aiAnalysis.priceOptions.some(option => option.price && option.price > 0)
        )

        if (hasPrice) {
          validPostsData.push(item)
          validAnalysisResults.push(aiAnalysis)
        } else {
          filteredOutCount++
          console.log(`❌ 가격 정보 없는 상품 제외: ${item.post.post_key} - ${(item.post.content || '').slice(0, 50)}...`)
        }
      }

      console.log(`📋 가격 정보 검증 완료: 유효 ${validPostsData.length}개, 제외 ${filteredOutCount}개`)
      
      // 유효한 상품이 없으면 조기 반환
      if (validPostsData.length === 0) {
        console.log('📭 가격 정보가 있는 유효한 상품이 없습니다.')
        const duplicatesRemovedCount = allTodayPosts.length - uniqueTodayPosts.length
        const titleDuplicatesCount = uniqueTodayPosts.length - newPostsData.length

        return NextResponse.json({
          success: true,
          message: `수집한 ${newPostsData.length}개 게시물 모두 가격 정보가 없어 필터링되었습니다. ${titleDuplicatesCount > 0 ? `(제목 중복 ${titleDuplicatesCount}개 제외)` : ''}`,
          totalFound: allTodayPosts.length,
          uniqueFound: uniqueTodayPosts.length,
          duplicatesRemoved: duplicatesRemovedCount,
          titleDuplicatesRemoved: titleDuplicatesCount,
          newPosts: 0,
          filteredOut: filteredOutCount,
          totalPages: pageCount,
          aiAnalyzed: 0,
          commentsCollected: 0,
          policyApplied: wholesaleBand.pricingPolicy ? true : false,
          duplicatePreventionEnabled: true,
          posts: []
        })
      }

      // 유효한 데이터로 변수 업데이트
      const finalNewPostsData = validPostsData
      const finalAiAnalysisResults = validAnalysisResults

      const analysisTime = Date.now() - analysisStartTime
      console.log(`🎉 AI 분석 완료: ${analysisTime}ms, 평균 ${analysisTime / finalNewPostsData.length}ms/개`)

      // 3단계: 데이터베이스 일괄 저장
      console.log('💾 3단계: 데이터베이스 일괄 저장 시작...')
      const saveStartTime = Date.now()

      for (let i = 0; i < finalNewPostsData.length; i++) {
        const item = finalNewPostsData[i]
        const aiAnalysis = finalAiAnalysisResults[i] // 순서 보장됨

        // 콘텐츠 정화 (try 블록 밖에서 선언)
        const sanitizedContent = sanitizeContent(item.post.content)
        const sanitizedTitle = sanitizeContent(item.post.content?.slice(0, 100)) || '제목 없음'
        const sanitizedAuthor = sanitizeContent(item.post.author?.name)

        try {
          // UPSERT 패턴을 사용한 중복 방지 (완전한 해결책)
          const savedPost = await prisma.collectedPost.upsert({
            where: {
              wholesaleBandId_bandPostId: {
                wholesaleBandId: wholesaleBand.id,
                bandPostId: item.post.post_key
              }
            },
            update: {
              // 이미 존재하는 경우 업데이트 (필요한 경우만)
              lastCheckedAt: new Date(),
              isAvailable: true
            },
            create: {
              userId: actualUser.id,
              wholesaleBandId: wholesaleBand.id,
              bandPostId: item.post.post_key,
              title: sanitizedTitle,
              content: sanitizedContent,
              author: sanitizedAuthor || null,
              images: JSON.stringify(item.images),
              comments: JSON.stringify(item.comments),
              policyApplied: !!(aiAnalysis?.adjustedPrice) || !!(wholesaleBand.pricingPolicy && aiAnalysis?.extractedPrice),
              priceCalculation: aiAnalysis?.priceCalculation ? JSON.stringify(aiAnalysis.priceCalculation) : null,
              bandCreatedAt: new Date(item.post.created_at),
              status: 'PENDING',
              // AI 분석 결과 (병렬 배치 처리로 획득)
              aiAnalyzed: true, // 병렬 배치 처리 완료
              shippingFee: (() => {
                if (typeof aiAnalysis?.shippingFee === 'number') {
                  return aiAnalysis.shippingFee
                }
                if (typeof aiAnalysis?.shippingFee === 'string') {
                  const numericValue = parseFloat(aiAnalysis.shippingFee)
                  if (!isNaN(numericValue)) {
                    return numericValue
                  }
                }
                return null // "별도", "무료배송" 등의 텍스트는 null로 처리
              })(),
              priceInfo: aiAnalysis?.priceInfo ? JSON.stringify(aiAnalysis.priceInfo) : null,
              priceOptions: aiAnalysis?.priceOptions ? JSON.stringify(aiAnalysis.priceOptions) : '[]',
              shippingPolicy: sanitizeContent(aiAnalysis?.shippingPolicy) || null,
              hookingTitle: sanitizeContent(aiAnalysis?.hookingTitle) || null,
              hookingContent: sanitizeContent(aiAnalysis?.hookingContent) || null,
              detailedContent: sanitizeContent(aiAnalysis?.detailedContent) || null,
              productCategory: aiAnalysis?.productCategory || 'OTHER',
              // 가격 정보 (AI 추출 + 정책 적용 결과)
              extractedPrice: (() => {
                // 1. AI 분석에서 직접 추출된 가격이 있으면 사용
                if (aiAnalysis?.extractedPrice) {
                  return aiAnalysis.extractedPrice
                }
                // 2. priceOptions에서 첫 번째 가격 사용
                if (aiAnalysis?.priceOptions && Array.isArray(aiAnalysis.priceOptions) && aiAnalysis.priceOptions.length > 0) {
                  return aiAnalysis.priceOptions[0].price
                }
                // 3. priceCalculation에서 originalPrice 사용
                if (aiAnalysis?.priceCalculation) {
                  try {
                    const calc = typeof aiAnalysis.priceCalculation === 'string'
                      ? JSON.parse(aiAnalysis.priceCalculation)
                      : aiAnalysis.priceCalculation
                    return calc?.originalPrice || null
                  } catch (e) {
                    console.warn('priceCalculation 파싱 오류:', e)
                  }
                }
                return null
              })(),
              adjustedPrice: (() => {
                // 1. AI 분석에서 직접 조정된 가격이 있으면 사용
                if (aiAnalysis?.adjustedPrice) {
                  return aiAnalysis.adjustedPrice
                }
                // 2. priceCalculation에서 adjustedPrice 사용
                if (aiAnalysis?.priceCalculation) {
                  try {
                    const calc = typeof aiAnalysis.priceCalculation === 'string'
                      ? JSON.parse(aiAnalysis.priceCalculation)
                      : aiAnalysis.priceCalculation
                    return calc?.adjustedPrice || null
                  } catch (e) {
                    console.warn('priceCalculation 파싱 오류:', e)
                  }
                }
                return null
              })(),
              aiProcessedAt: new Date(), // 병렬 배치 처리 완료 시간
              // 마감시간 및 추적 정보
              hasDeadline: aiAnalysis?.hasDeadline || false,
              deadlineInfo: sanitizeContent(aiAnalysis?.deadlineInfo) || null,
              lastCheckedAt: new Date(),
              isAvailable: true
            }
          })

          savedPosts.push(savedPost)
          
          if (i % 10 === 0 || i === finalNewPostsData.length - 1) {
            console.log(`💾 저장 진행률: ${i + 1}/${finalNewPostsData.length} (${Math.round((i + 1) / finalNewPostsData.length * 100)}%)`)
          }
        } catch (dbError) {
          console.error(`❌ 데이터베이스 저장 실패 for post ${item.post.post_key}:`, dbError)
          console.error('문제가 된 콘텐츠 미리보기:', {
            title: (sanitizedTitle || 'N/A').slice(0, 50),
            contentLength: (sanitizedContent || '').length,
            contentPreview: (sanitizedContent || '').slice(0, 100)
          })
          // 개별 게시물 저장 실패 시에도 다른 게시물은 계속 처리
          continue
        }
      }

      const saveTime = Date.now() - saveStartTime
      console.log(`💾 데이터베이스 저장 완료: ${saveTime}ms, 평균 ${saveTime / finalNewPostsData.length}ms/개`)
    } else {
      console.log('📭 새로운 게시물이 없습니다.')
    }

    // AI 분석 통계 계산
    const aiAnalyzedCount = savedPosts.filter(post => post.aiAnalyzed).length
    const commentsCollectedCount = savedPosts.filter(post => {
      try {
        const comments = JSON.parse(post.comments || '[]')
        return comments.length > 0
      } catch {
        return false
      }
    }).length

    // 필터링 및 중복 제거 정보 계산
    const filteredOutCount = (newPostsData?.length || 0) - savedPosts.length
    const duplicatesRemovedCount = allTodayPosts.length - uniqueTodayPosts.length
    const titleDuplicatesCount = uniqueTodayPosts.length - (newPostsData?.length || 0)

    return NextResponse.json({
      success: true,
      message: `🚀 Ultra 병렬+배치 처리로 ${savedPosts.length}개의 새로운 게시물을 초고속 수집했습니다! ${titleDuplicatesCount > 0 ? `(제목 중복 ${titleDuplicatesCount}개 제외) ` : ''}${filteredOutCount > 0 ? `(가격 정보 없는 상품 ${filteredOutCount}개 제외) ` : ''}${wholesaleBand.collectComments ? `(댓글 수집: ${commentsCollectedCount}개, AI 분석: ${aiAnalyzedCount}개)` : ''}`,
      totalFound: allTodayPosts.length,
      uniqueFound: uniqueTodayPosts.length,
      duplicatesRemoved: duplicatesRemovedCount,
      titleDuplicatesRemoved: titleDuplicatesCount,
      newPosts: savedPosts.length,
      filteredOut: filteredOutCount,
      totalPages: pageCount,
      aiAnalyzed: aiAnalyzedCount,
      commentsCollected: commentsCollectedCount,
      policyApplied: wholesaleBand.pricingPolicy ? true : false,
      duplicatePreventionEnabled: true,
      processingMethod: '순차 배치 처리 + 중복 방지 강화 (Rate Limit 안전)',
      performanceImprovement: 'Gemini Free Tier 15 RPM 제한 준수',
      batchSize: 3,
      maxConcurrency: 1,
      posts: savedPosts
    })

  } catch (error) {
    console.error('상품 수집 실패:', error)
    return NextResponse.json({
      success: false,
      error: '상품을 수집할 수 없습니다.'
    }, { status: 500 })
  }
}