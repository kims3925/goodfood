/**
 * Publish Pipeline
 * 상품을 소매밴드에 발행
 */

import prisma, { PublishStatus } from '@bandauto/db'
import { getBatchContext } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import { NaverBandClient } from '@/modules/sourcing/domain/src/band'
import {
  PublishConfig,
  PublishResult,
  PublishedProduct,
  BandPublishResult,
  PipelineError,
} from '../types'

// 지연 함수
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Band API 쿨다운 지연 시간 (10초)
const BAND_API_COOLDOWN_MS = 10000

// =============================================
// PUBLISH PIPELINE
// =============================================

/**
 * 발행 파이프라인 실행
 */
export async function runPublishPipeline(
  config: PublishConfig
): Promise<PublishResult> {
  const context = getBatchContext()
  if (!context) {
    throw new Error('Batch context is required')
  }

  const { userId } = context
  const errors: PipelineError[] = []
  const publishedProducts: PublishedProduct[] = []
  const bandResults: BandPublishResult[] = []

  console.log(`[Publish] Starting for user ${userId}`)

  // 발행할 상품 조회 (선택된 상품만)
  const whereClause: any = {
    userId,
  }

  if (config.productIds?.length) {
    whereClause.id = { in: config.productIds }
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    include: {
      post: {
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      variants: true,
    },
  })

  if (products.length === 0) {
    console.log('[Publish] No products to publish')
    return {
      success: true,
      totalItems: 0,
      successCount: 0,
      failedCount: 0,
      details: {
        publishedProducts: [],
        bandResults: [],
      },
      errors: [],
    }
  }

  console.log(`[Publish] Found ${products.length} products to publish`)

  // 소매밴드 조회
  const retailBands = await prisma.retailBand.findMany({
    where: {
      userId,
      id: { in: config.retailBandIds },
      isActive: true,
    },
    include: {
      apiConfig: true,
    },
  })

  if (retailBands.length === 0) {
    throw new Error('No active retail bands found')
  }

  console.log(`[Publish] Publishing to ${retailBands.length} retail bands`)

  // 진행 상황 초기화
  const { workflowLogId } = context
  const totalItems = products.length * retailBands.length
  let currentSuccess = 0
  let currentFailed = 0

  if (workflowLogId) {
    await updateWorkflowProgress(workflowLogId, totalItems, 0, 0)
  }

  // 각 소매밴드에 발행
  for (const band of retailBands) {
    const bandResult: BandPublishResult = {
      bandId: band.id,
      bandName: band.name,
      attempted: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    }

    if (!band.apiConfig?.accessToken) {
      bandResult.errors.push('Band API 토큰이 설정되지 않았습니다')
      bandResults.push(bandResult)
      continue
    }

    // Band API 클라이언트 초기화
    const bandClient = new NaverBandClient(band.apiConfig.accessToken)

    // 각 상품 발행
    for (const product of products) {
      bandResult.attempted++

      // 이미 발행된 상품인지 확인
      const existingPublish = await prisma.publishHistory.findUnique({
        where: {
          productId_retailBandId: {
            productId: product.id,
            retailBandId: band.id,
          },
        },
      })

      if (existingPublish && existingPublish.status === PublishStatus.SUCCESS) {
        bandResult.skipped++
        publishedProducts.push({
          productId: product.id,
          retailBandId: band.id,
          postKey: existingPublish.postKey || undefined,
          status: PublishStatus.SUCCESS,
        })
        continue
      }

      try {
        // 첫 번째 상품이 아니면 쿨다운 대기 (Band API 제한)
        if (bandResult.attempted > 1) {
          console.log(`[Publish] Waiting ${BAND_API_COOLDOWN_MS / 1000}s for Band API cooldown...`)
          await delay(BAND_API_COOLDOWN_MS)
        }

        // 게시글 내용 생성
        const postContent = buildPostContent(product)

        // Band API로 게시물 작성
        const { postKey } = await bandClient.createPost(band.bandKey, postContent, {
          doPush: false, // 푸시 알림 비활성화
        })

        // 댓글로 주문서 URL 추가 (밴드의 formUrl 사용)
        if (band.formUrl) {
          const commentContent = buildCommentContent(band.formUrl)
          await bandClient.createComment(band.bandKey, postKey, commentContent)
        }

        // 발행 이력 저장/업데이트
        await prisma.publishHistory.upsert({
          where: {
            productId_retailBandId: {
              productId: product.id,
              retailBandId: band.id,
            },
          },
          create: {
            userId,
            productId: product.id,
            retailBandId: band.id,
            postKey,
            status: PublishStatus.SUCCESS,
          },
          update: {
            postKey,
            status: PublishStatus.SUCCESS,
            errorMessage: null,
            publishedAt: new Date(),
          },
        })

        // ProductPublish 레코드 생성/업데이트 (쇼핑몰 표시용)
        await prisma.productPublish.upsert({
          where: {
            productId_retailBandId: {
              productId: product.id,
              retailBandId: band.id,
            },
          },
          create: {
            userId,
            productId: product.id,
            retailBandId: band.id,
            status: PublishStatus.SUCCESS,
          },
          update: {
            status: PublishStatus.SUCCESS,
          },
        })

        bandResult.success++
        currentSuccess++
        publishedProducts.push({
          productId: product.id,
          retailBandId: band.id,
          postKey,
          status: PublishStatus.SUCCESS,
        })

        // 진행 상황 업데이트
        if (workflowLogId) {
          await updateWorkflowProgress(workflowLogId, totalItems, currentSuccess, currentFailed)
        }

        console.log(`[Publish] Published product ${product.id} to ${band.name} -> post_key: ${postKey}`)
      } catch (publishError: any) {
        console.error(
          `[Publish] Error publishing product ${product.id} to ${band.name}:`,
          publishError
        )

        // 실패 이력 저장
        await prisma.publishHistory.upsert({
          where: {
            productId_retailBandId: {
              productId: product.id,
              retailBandId: band.id,
            },
          },
          create: {
            userId,
            productId: product.id,
            retailBandId: band.id,
            status: PublishStatus.FAILED,
            errorMessage: publishError.message,
          },
          update: {
            status: PublishStatus.FAILED,
            errorMessage: publishError.message,
            publishedAt: new Date(),
          },
        })

        bandResult.failed++
        currentFailed++
        bandResult.errors.push(`Product ${product.id}: ${publishError.message}`)
        publishedProducts.push({
          productId: product.id,
          retailBandId: band.id,
          status: PublishStatus.FAILED,
          error: publishError.message,
        })

        // 진행 상황 업데이트
        if (workflowLogId) {
          await updateWorkflowProgress(workflowLogId, totalItems, currentSuccess, currentFailed)
        }

        errors.push({
          itemId: `${product.id}-${band.id}`,
          message: publishError.message,
          timestamp: new Date(),
        })
      }
    }

    bandResults.push(bandResult)
  }

  const totalSuccess = bandResults.reduce((sum, r) => sum + r.success, 0)
  const totalFailed = bandResults.reduce((sum, r) => sum + r.failed, 0)

  return {
    success: totalFailed === 0,
    totalItems: products.length * retailBands.length,
    successCount: totalSuccess,
    failedCount: totalFailed,
    details: {
      publishedProducts,
      bandResults,
    },
    errors,
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * 게시글 내용 생성
 */
function buildPostContent(product: any): string {
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
