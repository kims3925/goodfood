import { NextRequest, NextResponse } from 'next/server'
import { prisma, PublishStatus, PublishType } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { NaverBandClient } from '@/modules/sourcing/domain/src/band'

// API 라우트 타임아웃 설정 (10분 = 600초)
// 상품 10개 × 밴드 5개 = 50개 발행 × 10초 = 500초 예상
export const maxDuration = 600

// 지연 함수
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 발행 간격 (10초)
const PUBLISH_DELAY_MS = 10000

interface PublishResult {
  bandId: number
  bandName: string
  productId: number
  productName: string
  success: boolean
  skipped?: boolean
  postKey?: string
  error?: string
}

// POST: 소매밴드에 상품 발행
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { retailBandIds, productIds, skipDuplicates = false } = body

    // 유효성 검사
    if (!retailBandIds || retailBandIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '발행할 소매밴드를 선택해주세요.' },
        { status: 400 }
      )
    }

    if (!productIds || productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '발행할 상품을 선택해주세요.' },
        { status: 400 }
      )
    }

    // 소매밴드 목록 조회
    const retailBands = await prisma.retailBand.findMany({
      where: {
        id: { in: retailBandIds },
        userId: user.userId,
        isActive: true,
      },
      include: {
        apiConfig: true,
      },
    })

    if (retailBands.length === 0) {
      return NextResponse.json(
        { success: false, error: '유효한 소매밴드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // API 토큰 확인 (모든 밴드에 대해)
    const bandsWithoutToken = retailBands.filter(b => !b.apiConfig?.accessToken)
    if (bandsWithoutToken.length > 0) {
      const names = bandsWithoutToken.map(b => b.name).join(', ')
      return NextResponse.json(
        { success: false, error: `다음 밴드의 API 토큰이 설정되지 않았습니다: ${names}. API 설정을 확인해주세요.` },
        { status: 400 }
      )
    }

    // 상품 목록 조회
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        userId: user.userId,
      },
      include: {
        post: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    })

    if (products.length === 0) {
      return NextResponse.json(
        { success: false, error: '발행할 상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 발행 결과 저장
    const results: PublishResult[] = []

    // 발행 카운터 (지연 로직용)
    let publishCount = 0

    // 각 밴드에 대해 상품 발행
    for (const retailBand of retailBands) {
      // Band API 클라이언트 초기화
      const bandClient = new NaverBandClient(retailBand.apiConfig!.accessToken as string)

      // 각 상품 발행
      for (const product of products) {
        try {
          // skipDuplicates가 true면 이미 발행된 조합 스킵
          if (skipDuplicates) {
            const existingPublish = await prisma.productPublish.findFirst({
              where: {
                productId: product.id,
                publishType: PublishType.RETAIL_BAND,
                retailBandId: retailBand.id,
                status: PublishStatus.SUCCESS,
              },
            })

            if (existingPublish) {
              console.log(`⏭️ 스킵: ${retailBand.name} / ${product.name} (이미 발행됨)`)
              results.push({
                bandId: retailBand.id,
                bandName: retailBand.name,
                productId: product.id,
                productName: product.name,
                success: false,
                skipped: true,
              })
              continue
            }
          }

          // 첫 번째 발행이 아니면 10초 지연
          if (publishCount > 0) {
            console.log(`⏳ ${PUBLISH_DELAY_MS / 1000}초 대기 중... (${publishCount}번째 발행 완료)`)
            await delay(PUBLISH_DELAY_MS)
          }
          publishCount++
          // 게시글 내용 생성
          const postContent = buildPostContent(product)

          // 게시글 작성
          const { postKey } = await bandClient.createPost(retailBand.bandKey, postContent, {
            doPush: false, // 푸시 알림 비활성화
          })

          // 댓글 작성 (해당 밴드의 주문서 URL)
          if (retailBand.formUrl) {
            const commentContent = buildCommentContent(retailBand.formUrl)
            if (commentContent) {
              await bandClient.createComment(retailBand.bandKey, postKey, commentContent)
            }
          }

          // ProductPublish 레코드 생성/업데이트
          await prisma.productPublish.upsert({
            where: {
              productId_publishType_retailBandId: {
                productId: product.id,
                publishType: PublishType.RETAIL_BAND,
                retailBandId: retailBand.id,
              },
            },
            create: {
              userId: user.userId,
              productId: product.id,
              publishType: PublishType.RETAIL_BAND,
              retailBandId: retailBand.id,
              status: PublishStatus.SUCCESS,
              externalId: postKey,
              publishedAt: new Date(),
            },
            update: {
              status: PublishStatus.SUCCESS,
              externalId: postKey,
              errorMessage: null,
              publishedAt: new Date(),
            },
          })

          results.push({
            bandId: retailBand.id,
            bandName: retailBand.name,
            productId: product.id,
            productName: product.name,
            success: true,
            postKey,
          })

          console.log(`✅ 상품 발행 성공: ${retailBand.name} / ${product.name} -> post_key: ${postKey}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
          console.error(`❌ 상품 발행 실패: ${retailBand.name} / ${product.name}`, error)

          results.push({
            bandId: retailBand.id,
            bandName: retailBand.name,
            productId: product.id,
            productName: product.name,
            success: false,
            error: errorMessage,
          })
        }
      }
    }

    // 성공/실패/스킵 카운트
    const successCount = results.filter(r => r.success).length
    const skippedCount = results.filter(r => r.skipped).length
    const failCount = results.filter(r => !r.success && !r.skipped).length

    return NextResponse.json({
      success: true,
      message: `${successCount}개 성공, ${skippedCount}개 스킵, ${failCount}개 실패`,
      results,
    })
  } catch (error) {
    console.error('발행 처리 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * 게시글 내용 생성
 */
function buildPostContent(
  product: {
    name: string
    description: string | null
    price: number | null
    wholesalePrice: number | null
    post?: {
      content: string
    } | null
  }
): string {
  const lines: string[] = []

  // 상품명
  lines.push(`🛍️ ${product.name}`)
  lines.push('')

  // 가격 정보 (판매가만 노출)
  if (product.price) {
    lines.push(`💰 판매가: ${product.price.toLocaleString()}원`)
    lines.push('')
  }

  // 상품 설명
  if (product.description) {
    lines.push(product.description)
  } else if (product.post?.content) {
    lines.push(product.post.content)
  }

  return lines.join('\n')
}

/**
 * 댓글 내용 생성 (주문서 URL)
 */
function buildCommentContent(formUrl: string): string {
  const lines: string[] = []

  lines.push(`📋 주문서 작성하기`)
  lines.push(formUrl)

  return lines.join('\n')
}
