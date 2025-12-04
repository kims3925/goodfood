/**
 * Product Create Pipeline
 * 수집상품(CollectedProduct)에서 내부 상품(Product)을 생성
 *
 * Transform 파이프라인 이후, Publish 파이프라인 이전에 실행됨
 * CollectedProduct의 rawMetadata에 저장된 AI 분석 결과를 사용하여 Product 생성
 */

import prisma from '@bandauto/db'
import { getBatchContext } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import { downloadAndSaveProductImages } from '@/modules/utils/imageUtils'
import {
  ProductCreateConfig,
  ProductCreateResult,
  CreatedProductResult,
  PipelineError,
} from '../types'

// 연속 실패 시 조기 종료 임계값
const MAX_CONSECUTIVE_FAILURES = 5
// 전체 파이프라인 타임아웃 (10분)
const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000

// =============================================
// PRODUCT CREATE PIPELINE
// =============================================

/**
 * Product 생성 파이프라인 실행
 * CollectedProduct에서 Product 생성
 */
export async function runProductCreatePipeline(
  config: ProductCreateConfig
): Promise<ProductCreateResult> {
  const context = getBatchContext()
  if (!context) {
    throw new Error('Batch context is required')
  }

  const { userId } = context
  const errors: PipelineError[] = []
  const createdProducts: CreatedProductResult[] = []
  let totalCreated = 0

  console.log(`[ProductCreate] Starting for user ${userId}`)

  // Product가 없는 CollectedProduct 조회
  const whereClause: any = {
    userId,
    products: {
      none: {}, // Product가 아직 없는 수집상품만
    },
  }

  if (config.collectedProductIds?.length) {
    whereClause.id = { in: config.collectedProductIds }
  }

  const collectedProducts = await prisma.collectedProduct.findMany({
    where: whereClause,
    include: {
      post: {
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    take: 50, // 배치당 최대 50개
  })

  if (collectedProducts.length === 0) {
    console.log('[ProductCreate] No collected products to process')
    return {
      success: true,
      totalItems: 0,
      successCount: 0,
      failedCount: 0,
      details: {
        createdProducts: [],
        totalCreated: 0,
      },
      errors: [],
    }
  }

  console.log(`[ProductCreate] Found ${collectedProducts.length} collected products to process`)

  // 진행 상황 초기화
  const { workflowLogId } = context
  if (workflowLogId) {
    await updateWorkflowProgress(workflowLogId, collectedProducts.length, 0, 0)
  }

  // 파이프라인 시작 시간 기록
  const pipelineStartTime = Date.now()
  let consecutiveFailures = 0

  // 각 수집상품 처리
  for (const collectedProduct of collectedProducts) {
    // 파이프라인 타임아웃 체크
    if (Date.now() - pipelineStartTime > PIPELINE_TIMEOUT_MS) {
      console.log(`[ProductCreate] Pipeline timeout reached, stopping...`)
      errors.push({
        itemId: 0,
        message: `파이프라인 실행 시간이 초과되었습니다. 나머지 항목은 다음 실행에서 처리됩니다.`,
        timestamp: new Date(),
      })
      break
    }

    // 연속 실패 체크
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.log(`[ProductCreate] Too many consecutive failures, stopping...`)
      errors.push({
        itemId: 0,
        message: `연속 ${MAX_CONSECUTIVE_FAILURES}회 실패로 파이프라인이 중단되었습니다.`,
        timestamp: new Date(),
      })
      break
    }

    const result: CreatedProductResult = {
      collectedProductId: collectedProduct.id,
      status: 'pending' as any,
    }

    try {
      console.log(`[ProductCreate] Processing collectedProduct ${collectedProduct.id}: ${collectedProduct.name?.substring(0, 50)}...`)

      // rawMetadata에서 AI 분석 결과 추출
      const metadata = collectedProduct.rawMetadata as any || {}
      const options = metadata.options || []
      const variants = metadata.variants || []
      // shipping 객체 또는 직접 shippingFee/shippingInfo 필드 둘 다 지원
      const shipping = metadata.shipping || {
        shippingFee: metadata.shippingFee ?? null,
        shippingInfo: metadata.shippingInfo ?? null,
      }

      // 게시물 이미지 URL 수집
      const imageUrls = collectedProduct.post.images.map((img) => img.url)

      // Product 생성
      const product = await prisma.product.create({
        data: {
          userId,
          collectedProductId: collectedProduct.id,
          name: collectedProduct.name || '상품명 없음',
          description: collectedProduct.description || null,
          categoryId: metadata.category || null,
          currency: collectedProduct.currency || 'KRW',
          shippingFee: typeof shipping.shippingFee === 'number' ? shipping.shippingFee : null,
          shippingInfo: typeof shipping.shippingInfo === 'string' ? shipping.shippingInfo : null,
          thumbnailUrl: collectedProduct.post.images[0]?.url || null,
          options: options.length
            ? {
                create: options.flatMap((opt: any, groupIndex: number) =>
                  (opt.values || []).map((value: string, valueIndex: number) => ({
                    groupName: opt.groupName,
                    value,
                    sortOrder: groupIndex * 100 + valueIndex,
                  }))
                ),
              }
            : undefined,
          variants: variants.length
            ? {
                create: variants.map((v: any) => ({
                  optionSummary: v.optionSummary || null,
                  wholesalePrice: v.wholesalePrice || null,
                  price: v.price || 0,
                })),
              }
            : undefined,
        },
      })

      // 이미지 다운로드 및 ProductImage 저장
      if (imageUrls.length > 0) {
        try {
          console.log(`[ProductCreate] 이미지 다운로드 시작: ${imageUrls.length}개`)
          const downloadedImages = await downloadAndSaveProductImages(imageUrls)

          if (downloadedImages.length > 0) {
            // ProductImage 레코드 생성
            await prisma.productImage.createMany({
              data: downloadedImages.map((img, index) => ({
                productId: product.id,
                url: img.url,
                fileHash: img.fileHash,
                fileName: img.fileName,
                fileSize: img.fileSize,
                sortOrder: index,
              })),
            })

            // 첫 번째 이미지를 썸네일로 업데이트
            await prisma.product.update({
              where: { id: product.id },
              data: { thumbnailUrl: downloadedImages[0].url },
            })

            console.log(`[ProductCreate] 이미지 저장 완료: ${downloadedImages.length}개`)
          }
        } catch (imageError) {
          console.error(`[ProductCreate] 이미지 다운로드/저장 실패 (상품은 생성됨):`, imageError)
          // 이미지 실패해도 상품 생성은 성공으로 처리
        }
      }

      result.status = 'success'
      result.productId = product.id
      totalCreated++
      consecutiveFailures = 0

      console.log(`[ProductCreate] Created product ${product.id} from collectedProduct ${collectedProduct.id}`)
    } catch (error: any) {
      console.error(`[ProductCreate] Error processing collectedProduct ${collectedProduct.id}:`, error)
      result.status = 'failed'
      result.error = error.message
      consecutiveFailures++
      errors.push({
        itemId: collectedProduct.id,
        message: error.message,
        timestamp: new Date(),
      })
    }

    createdProducts.push(result)

    // 진행 상황 업데이트
    if (workflowLogId) {
      const currentSuccess = createdProducts.filter((p) => p.status === 'success').length
      const currentFailed = createdProducts.filter((p) => p.status === 'failed').length
      await updateWorkflowProgress(workflowLogId, collectedProducts.length, currentSuccess, currentFailed)
    }
  }

  const successCount = createdProducts.filter((p) => p.status === 'success').length
  const failedCount = createdProducts.filter((p) => p.status === 'failed').length

  return {
    success: failedCount === 0,
    totalItems: collectedProducts.length,
    successCount,
    failedCount,
    details: {
      createdProducts,
      totalCreated,
    },
    errors,
  }
}
