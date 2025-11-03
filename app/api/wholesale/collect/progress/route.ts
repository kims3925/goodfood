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

// 진행상황 스트리밍을 위한 헬퍼 함수
function createProgressStream() {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      const sendProgress = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      // 초기 진행상황
      sendProgress({
        type: 'init',
        message: '상품 수집을 준비하고 있습니다...',
        progress: 0,
        stage: 'preparing',
        details: {
          collected: 0,
          processing: 0,
          completed: 0,
          total: 0,
          currentAction: '초기화 중...'
        }
      })

      return { sendProgress, controller }
    }
  })

  return stream
}

export async function GET(request: NextRequest) {
  // URL 쿼리 파라미터에서 data를 추출
  const searchParams = request.nextUrl.searchParams
  const dataParam = searchParams.get('data')
  
  if (!dataParam) {
    return NextResponse.json({
      success: false,
      error: '필수 데이터가 없습니다.'
    }, { status: 400 })
  }

  let bandId, dateRange
  try {
    const parsedData = JSON.parse(dataParam)
    bandId = parsedData.bandId
    dateRange = parsedData.dateRange
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '데이터 파싱 오류'
    }, { status: 400 })
  }

  // 나머지 로직은 POST와 동일하게 처리
  return handleCollectionProgress(bandId, dateRange)
}

export async function POST(request: NextRequest) {
  const { bandId, dateRange } = await request.json()
  return handleCollectionProgress(bandId, dateRange)
}

async function handleCollectionProgress(bandId: string, dateRange?: any) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    if (!bandId) {
      return NextResponse.json({
        success: false,
        error: '밴드 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 실제 사용자 ID 찾기
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

    // 해당 밴드가 사용자의 것인지 확인
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
        pricingPolicy: true
      }
    })

    if (!wholesaleBand) {
      return NextResponse.json({
        success: false,
        error: '해당 밴드에 접근할 수 없습니다.'
      }, { status: 403 })
    }

    // 환경변수에서 밴드 API 토큰 사용
    let accessToken = process.env.BAND_ACCESS_TOKEN
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: '밴드 API 토큰이 설정되지 않았습니다.'
      }, { status: 400 })
    }

    // 토큰 유효성 검사
    const isTokenValid = await validateBandToken(accessToken)
    
    if (!isTokenValid) {
      return NextResponse.json({
        success: false,
        error: 'Band API 토큰이 만료되었거나 유효하지 않습니다.',
        needsTokenRefresh: true
      }, { status: 401 })
    }

    // Server-Sent Events 설정
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        try {
          // 1단계: 초기화
          sendProgress({
            type: 'stage',
            message: '수집 준비 중...',
            progress: 5,
            stage: 'initializing',
            details: {
              collected: 0,
              processing: 0,
              completed: 0,
              total: 0,
              currentAction: '밴드 정보 확인 중...',
              timeElapsed: 0,
              estimatedTimeRemaining: null
            }
          })

          const startTime = Date.now()

          // 날짜 범위 설정
          let recentStart, todayEnd, isFullCollection = false
          
          if (dateRange && dateRange.startDate && dateRange.endDate) {
            recentStart = new Date(dateRange.startDate + 'T00:00:00.000Z')
            todayEnd = new Date(dateRange.endDate + 'T23:59:59.999Z')
          } else {
            isFullCollection = true
            const today = new Date()
            const todayKST = new Date(today.getTime() + (9 * 60 * 60 * 1000))
            recentStart = new Date(todayKST.getFullYear(), todayKST.getMonth(), todayKST.getDate())
            recentStart.setDate(recentStart.getDate() - 30)
            todayEnd = new Date(todayKST.getFullYear(), todayKST.getMonth(), todayKST.getDate())
            todayEnd.setDate(todayEnd.getDate() + 1)
          }

          // 2단계: 밴드에서 게시물 수집
          sendProgress({
            type: 'stage',
            message: '밴드에서 게시물을 수집하고 있습니다...',
            progress: 10,
            stage: 'collecting',
            details: {
              collected: 0,
              processing: 0,
              completed: 0,
              total: 0,
              currentAction: '첫 번째 페이지 요청 중...',
              timeElapsed: Date.now() - startTime,
              estimatedTimeRemaining: null
            }
          })

          // Band API에서 페이징으로 모든 게시물 가져오기
          let allTodayPosts: any[] = []
          let hasMorePosts = true
          let after: string | null = null
          let pageCount = 0
          const maxPages = 50

          while (hasMorePosts && pageCount < maxPages) {
            pageCount++

            // 페이지별 진행상황 업데이트
            sendProgress({
              type: 'progress',
              message: `페이지 ${pageCount} 수집 중...`,
              progress: Math.min(10 + (pageCount / maxPages) * 40, 50),
              stage: 'collecting',
              details: {
                collected: allTodayPosts.length,
                processing: 0,
                completed: 0,
                total: allTodayPosts.length,
                currentAction: `페이지 ${pageCount}/${maxPages} 처리 중...`,
                timeElapsed: Date.now() - startTime,
                estimatedTimeRemaining: pageCount > 1 ? ((Date.now() - startTime) / pageCount) * (maxPages - pageCount) : null
              }
            })

            // API URL 구성
            const postsUrl = new URL('https://openapi.band.us/v2/band/posts')
            postsUrl.searchParams.append('access_token', accessToken)
            postsUrl.searchParams.append('band_key', wholesaleBand.bandKey)
            postsUrl.searchParams.append('locale', 'ko_KR')
            if (after) {
              postsUrl.searchParams.append('after', after)
            }
            
            const postsResponse = await fetch(postsUrl.toString(), {
              method: 'GET',
              headers: {
                'User-Agent': 'BandAuto/1.0.0'
              }
            })

            if (!postsResponse.ok) {
              throw new Error(`Band API 오류: ${postsResponse.status}`)
            }

            const postsData = await postsResponse.json()
            
            if (!postsData.result_data?.items) {
              break
            }

            const currentPagePosts = postsData.result_data.items

            // 지정된 기간에 해당하는 게시물만 필터링
            const todayPostsInPage = currentPagePosts.filter((post: any) => {
              const postDate = new Date(post.created_at)
              return postDate >= recentStart && postDate < todayEnd
            })

            allTodayPosts.push(...todayPostsInPage)

            // 다음 페이지 확인
            if (currentPagePosts.length < 20) {
              hasMorePosts = false
            } else if (todayPostsInPage.length === 0 && currentPagePosts.length === 20 && !isFullCollection) {
              hasMorePosts = false
            } else {
              after = currentPagePosts[currentPagePosts.length - 1].post_key
            }

            // API 요청 간 간격
            if (hasMorePosts) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }

          // 중복 제거
          const uniqueTodayPosts = allTodayPosts.filter((post, index, self) => 
            index === self.findIndex(p => p.post_key === post.post_key)
          )

          // 3단계: 새로운 게시물 필터링
          sendProgress({
            type: 'stage',
            message: '새로운 게시물을 필터링하고 있습니다...',
            progress: 50,
            stage: 'filtering',
            details: {
              collected: uniqueTodayPosts.length,
              processing: 0,
              completed: 0,
              total: uniqueTodayPosts.length,
              currentAction: '기존 게시물 중복 검사 중...',
              timeElapsed: Date.now() - startTime,
              estimatedTimeRemaining: null
            }
          })

          // 댓글 수집 함수
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
                return []
              }

              const commentsData = await commentsResponse.json()
              if (commentsData.result_data?.items) {
                return commentsData.result_data.items.map((comment: any) => comment.content || comment.body || '')
              }
              
              return []
            } catch (error) {
              return []
            }
          }

          const newPostsData = []
          
          for (let i = 0; i < uniqueTodayPosts.length; i++) {
            const post = uniqueTodayPosts[i]
            
            // 필터링 진행상황 업데이트
            if (i % 5 === 0 || i === uniqueTodayPosts.length - 1) {
              sendProgress({
                type: 'progress',
                message: `새로운 게시물 확인 중... (${i + 1}/${uniqueTodayPosts.length})`,
                progress: 50 + (i / uniqueTodayPosts.length) * 10,
                stage: 'filtering',
                details: {
                  collected: uniqueTodayPosts.length,
                  processing: i + 1,
                  completed: newPostsData.length,
                  total: uniqueTodayPosts.length,
                  currentAction: `게시물 중복 검사 중... (${i + 1}/${uniqueTodayPosts.length})`,
                  timeElapsed: Date.now() - startTime,
                  estimatedTimeRemaining: i > 0 ? ((Date.now() - startTime) / (i + 1)) * (uniqueTodayPosts.length - i - 1) : null
                }
              })
            }

            // 이미 수집된 게시물인지 확인
            const existingPost = await prisma.collectedPost.findFirst({
              where: {
                bandPostId: post.post_key,
                wholesaleBandId: wholesaleBand.id
              }
            })

            if (!existingPost) {
              // 이미지 URL 추출
              const images = []
              if (post.photos && Array.isArray(post.photos)) {
                images.push(...post.photos.map((photo: any) => photo.url))
              }

              // 댓글 수집
              const comments = await fetchComments(post.post_key)

              newPostsData.push({
                post,
                images,
                comments
              })
            }
          }

          if (newPostsData.length === 0) {
            sendProgress({
              type: 'complete',
              message: '새로운 게시물이 없습니다.',
              progress: 100,
              stage: 'completed',
              details: {
                collected: uniqueTodayPosts.length,
                processing: 0,
                completed: 0,
                total: 0,
                currentAction: '완료',
                timeElapsed: Date.now() - startTime,
                estimatedTimeRemaining: 0
              }
            })

            controller.close()
            return
          }

          // 4단계: AI 분석
          sendProgress({
            type: 'stage',
            message: `AI 분석을 시작합니다... (총 ${newPostsData.length}개 상품)`,
            progress: 60,
            stage: 'ai_analyzing',
            details: {
              collected: uniqueTodayPosts.length,
              processing: 0,
              completed: 0,
              total: newPostsData.length,
              currentAction: 'AI 분석 준비 중...',
              timeElapsed: Date.now() - startTime,
              estimatedTimeRemaining: null
            }
          })

          // AI 분석용 데이터 준비
          const postsForAI = newPostsData.map(item => ({
            title: item.post.content?.slice(0, 100) || '제목 없음',
            content: item.post.content || '',
            comments: item.comments,
            pricingPolicy: wholesaleBand.pricingPolicy || undefined
          }))

          // 병렬 배치 AI 분석 실행
          const batchSize = 3  // Rate Limit 방지
          const maxConcurrency = 1  // 15 RPM 제한 준수
          const totalBatches = Math.ceil(newPostsData.length / batchSize)
          const groups = Math.ceil(totalBatches / maxConcurrency)

          let processedItems = 0

          // AI 분석 진행상황을 추적하기 위해 커스텀 함수 사용
          const aiAnalysisResults = []
          
          for (let group = 0; group < groups; group++) {
            const groupStartIdx = group * maxConcurrency * batchSize
            const groupEndIdx = Math.min(groupStartIdx + (maxConcurrency * batchSize), newPostsData.length)
            const groupItems = postsForAI.slice(groupStartIdx, groupEndIdx)
            
            if (groupItems.length === 0) break

            // 그룹 단위로 진행상황 업데이트
            sendProgress({
              type: 'progress',
              message: `AI 분석 중... 그룹 ${group + 1}/${groups}`,
              progress: 60 + ((group / groups) * 25),
              stage: 'ai_analyzing',
              details: {
                collected: uniqueTodayPosts.length,
                processing: groupItems.length,
                completed: processedItems,
                total: newPostsData.length,
                currentAction: `AI 분석 그룹 ${group + 1}/${groups} (배치 ${batchSize}개씩, 병렬 ${maxConcurrency}개)`,
                timeElapsed: Date.now() - startTime,
                estimatedTimeRemaining: group > 0 ? ((Date.now() - startTime) / (group + 1)) * (groups - group - 1) : null
              }
            })

            // 그룹 단위로 병렬 배치 분석
            try {
              const groupResults = await parallelBatchAnalyzeProducts(groupItems, batchSize, maxConcurrency)
              aiAnalysisResults.push(...groupResults)
            } catch (aiError) {
              console.error(`❌ AI 분석 그룹 ${group + 1} 실패:`, aiError)
              sendProgress({
                type: 'error',
                message: 'AI 분석 실패',
                error: `Gemini API 오류: ${aiError instanceof Error ? aiError.message : String(aiError)}`,
                suggestion: '1-2분 후 다시 시도하거나, Gemini API 키와 할당량을 확인해주세요.',
                totalFound: allTodayPosts.length,
                uniqueFound: uniqueTodayPosts.length,
                newPosts: 0,
                filteredOut: 0,
                totalPages: pageCount,
                aiAnalyzed: 0,
                commentsCollected: 0
              })
              return // 스트림 종료
            }
            processedItems += groupItems.length

            // 그룹 간 간격
            if (group < groups - 1) {
              await new Promise(resolve => setTimeout(resolve, 300))
            }
          }

          // 5단계: 데이터베이스 저장
          sendProgress({
            type: 'stage',
            message: '데이터베이스에 저장하고 있습니다...',
            progress: 85,
            stage: 'saving',
            details: {
              collected: uniqueTodayPosts.length,
              processing: 0,
              completed: 0,
              total: newPostsData.length,
              currentAction: '데이터베이스 저장 준비 중...',
              timeElapsed: Date.now() - startTime,
              estimatedTimeRemaining: null
            }
          })

          const savedPosts = []

          for (let i = 0; i < newPostsData.length; i++) {
            const item = newPostsData[i]
            const aiAnalysis = aiAnalysisResults[i]
            
            // 저장 진행상황 업데이트
            if (i % 5 === 0 || i === newPostsData.length - 1) {
              sendProgress({
                type: 'progress',
                message: `데이터베이스 저장 중... (${i + 1}/${newPostsData.length})`,
                progress: 85 + ((i / newPostsData.length) * 14),
                stage: 'saving',
                details: {
                  collected: uniqueTodayPosts.length,
                  processing: 1,
                  completed: i,
                  total: newPostsData.length,
                  currentAction: `게시물 저장 중... (${i + 1}/${newPostsData.length})`,
                  timeElapsed: Date.now() - startTime,
                  estimatedTimeRemaining: i > 0 ? ((Date.now() - startTime) / (i + 1)) * (newPostsData.length - i - 1) : null
                }
              })
            }
            
            try {
              // 콘텐츠 정화
              const sanitizedContent = sanitizeContent(item.post.content)
              const sanitizedTitle = sanitizeContent(item.post.content?.slice(0, 100)) || '제목 없음'
              const sanitizedAuthor = sanitizeContent(item.post.author?.name)
              
              const savedPost = await prisma.collectedPost.create({
                data: {
                  userId: actualUser.id,
                  wholesaleBandId: wholesaleBand.id,
                  bandPostId: item.post.post_key,
                  title: sanitizedTitle,
                  content: sanitizedContent,
                  author: sanitizedAuthor || null,
                  images: JSON.stringify(item.images),
                  comments: JSON.stringify(item.comments),
                  policyApplied: !!(aiAnalysis?.priceCalculation),
                  priceCalculation: aiAnalysis?.priceCalculation ? JSON.stringify(aiAnalysis.priceCalculation) : null,
                  bandCreatedAt: new Date(item.post.created_at),
                  status: 'PENDING',
                  // AI 분석 결과
                  aiAnalyzed: true,
                  shippingFee: aiAnalysis?.shippingFee || null,
                  priceInfo: aiAnalysis?.priceInfo ? JSON.stringify(aiAnalysis.priceInfo) : null,
                  priceOptions: aiAnalysis?.priceOptions ? JSON.stringify(aiAnalysis.priceOptions) : '[]',
                  shippingPolicy: sanitizeContent(aiAnalysis?.shippingPolicy) || null,
                  hookingTitle: sanitizeContent(aiAnalysis?.hookingTitle) || null,
                  hookingContent: sanitizeContent(aiAnalysis?.hookingContent) || null,
                  detailedContent: sanitizeContent(aiAnalysis?.detailedContent) || null,
                  productCategory: aiAnalysis?.productCategory || 'OTHER',
                  aiProcessedAt: new Date(),
                  // 가격 정보 (수정된 매핑 로직)
                  extractedPrice: (() => {
                    if (aiAnalysis?.extractedPrice) {
                      return aiAnalysis.extractedPrice
                    }
                    if (aiAnalysis?.priceOptions && Array.isArray(aiAnalysis.priceOptions) && aiAnalysis.priceOptions.length > 0) {
                      return aiAnalysis.priceOptions[0].price
                    }
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
                    if (aiAnalysis?.adjustedPrice) {
                      return aiAnalysis.adjustedPrice
                    }
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
                  // 마감시간 및 추적 정보
                  hasDeadline: aiAnalysis?.hasDeadline || false,
                  deadlineInfo: sanitizeContent(aiAnalysis?.deadlineInfo) || null,
                  lastCheckedAt: new Date(),
                  isAvailable: true
                }
              })

              savedPosts.push(savedPost)
              
            } catch (dbError) {
              console.error(`데이터베이스 저장 실패 for post ${item.post.post_key}:`, dbError)
              continue
            }
          }

          // 완료
          const totalTime = Date.now() - startTime
          const aiAnalyzedCount = savedPosts.filter(post => post.aiAnalyzed).length
          const commentsCollectedCount = savedPosts.filter(post => {
            try {
              const comments = JSON.parse(post.comments || '[]')
              return comments.length > 0
            } catch {
              return false
            }
          }).length

          sendProgress({
            type: 'complete',
            message: `완료! ${savedPosts.length}개의 새로운 게시물을 수집했습니다.`,
            progress: 100,
            stage: 'completed',
            details: {
              collected: uniqueTodayPosts.length,
              processing: 0,
              completed: savedPosts.length,
              total: savedPosts.length,
              currentAction: '수집 완료',
              timeElapsed: totalTime,
              estimatedTimeRemaining: 0
            },
            summary: {
              totalFound: uniqueTodayPosts.length,
              newPosts: savedPosts.length,
              aiAnalyzed: aiAnalyzedCount,
              commentsCollected: commentsCollectedCount,
              totalTime: totalTime,
              averageTimePerPost: savedPosts.length > 0 ? totalTime / savedPosts.length : 0,
              processingMethod: 'Ultra 병렬 + 배치 처리'
            }
          })

          controller.close()

        } catch (error) {
          sendProgress({
            type: 'error',
            message: '상품 수집 중 오류가 발생했습니다.',
            progress: 0,
            stage: 'error',
            error: error instanceof Error ? error.message : '알 수 없는 오류',
            details: {
              collected: 0,
              processing: 0,
              completed: 0,
              total: 0,
              currentAction: '오류 발생',
              timeElapsed: Date.now() - startTime,
              estimatedTimeRemaining: null
            }
          })
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('진행상황 스트리밍 실패:', error)
    return NextResponse.json({
      success: false,
      error: '상품 수집을 시작할 수 없습니다.'
    }, { status: 500 })
  }
}