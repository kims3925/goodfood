/**
 * Publish Pipeline
 * 상품을 소매밴드에 발행
 */

import { PrismaClient, ProductStatus, PublishStatus } from '@prisma/client'
import { getBatchContext } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import {
  PublishConfig,
  PublishResult,
  PublishedProduct,
  BandPublishResult,
  PipelineError,
} from '../types'

const prisma = new PrismaClient()

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

  // 발행할 상품 조회
  const whereClause: any = {
    userId,
  }

  if (config.productIds?.length) {
    whereClause.id = { in: config.productIds }
  } else if (config.publishReadyOnly) {
    whereClause.status = ProductStatus.DRAFT
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

  // 발행 설정 조회
  const publishSetting = await prisma.publishSetting.findUnique({
    where: { userId },
  })

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
        // 발행 콘텐츠 생성
        const content = buildPublishContent(product, publishSetting)

        // Band API로 게시물 작성
        const postKey = await publishToBand(
          band.apiConfig.accessToken,
          band.bandKey,
          content,
          product.post?.images.map((img) => img.imageUrl) || []
        )

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

        // 상품 상태 업데이트
        await prisma.product.update({
          where: { id: product.id },
          data: { status: ProductStatus.ACTIVE },
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

        console.log(`[Publish] Published product ${product.id} to ${band.name}`)
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
 * 발행 콘텐츠 생성
 */
function buildPublishContent(
  product: any,
  publishSetting: any
): string {
  let content = ''

  // 상품명
  content += `${product.name}\n\n`

  // 상품 설명
  if (product.description) {
    content += `${product.description}\n\n`
  }

  // 가격 정보
  if (product.price) {
    content += `가격: ${product.price.toLocaleString()}원\n`
  }

  // 옵션 정보
  if (product.variants?.length > 0) {
    content += '\n옵션:\n'
    for (const variant of product.variants) {
      content += `- ${variant.optionSummary || '기본'}: ${variant.price.toLocaleString()}원\n`
    }
  }

  // 주문서 URL
  if (publishSetting?.orderFormUrl) {
    content += `\n주문서: ${publishSetting.orderFormUrl}\n`
  }

  // 추가 안내
  if (publishSetting?.additionalComment) {
    content += `\n${publishSetting.additionalComment}\n`
  }

  return content
}

/**
 * Band API로 게시물 발행
 */
async function publishToBand(
  accessToken: string,
  bandKey: string,
  content: string,
  imageUrls: string[]
): Promise<string> {
  // Band API 게시물 작성 (실제 구현 필요)
  // 참고: 이미지 업로드는 동료가 별도 구현 예정

  const url = 'https://openapi.band.us/v2.2/band/post/create'

  const formData = new FormData()
  formData.append('access_token', accessToken)
  formData.append('band_key', bandKey)
  formData.append('content', content)
  formData.append('do_push', 'true')

  // TODO: 이미지 업로드 구현 (동료 담당)
  // imageUrls가 있을 경우 photo 파라미터로 업로드

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Band API error: ${response.status}`)
  }

  const data = await response.json()

  if (data.result_code !== 1) {
    throw new Error(`Band API error: ${data.result_data?.message || 'Unknown error'}`)
  }

  return data.result_data?.post_key || ''
}
