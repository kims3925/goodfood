/**
 * Product Create Pipeline
 * 수집상품(CollectedProduct)에서 내부 상품(Product)을 생성
 *
 * Transform 파이프라인 이후, Publish 파이프라인 이전에 실행됨
 * CollectedProduct의 rawMetadata에 저장된 AI 분석 결과를 사용하여 Product 생성
 *
 * 수동 실행과 동일한 서비스 레이어(ProductService) 사용으로 통일
 */

import prisma from '@bandauto/db'
import { getBatchContext, checkCancellation } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import { productService } from '@/modules/catalog/domain/src/product/services/product.service'
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

  // Product가 없는 CollectedProduct 조회 (isConverted=false)
  const whereClause: any = {
    userId,
    isConverted: false, // Product로 아직 변환되지 않은 수집상품만
  }

  if (config.channelIds?.length) {
    whereClause.id = { in: config.channelIds }
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
    // 제한 없음 - 상품 등록이 안된 수집상품 전부 처리
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

  // ProductService.createFromCollectedProducts() 사용 (수동과 동일한 로직)
  // 진행 콜백을 통해 취소, 타임아웃, 연속실패 체크 및 진행 업데이트
  const collectedProductIds = collectedProducts.map(cp => cp.id)

  const batchResult = await productService.createFromCollectedProducts({
    userId,
    collectedProductIds,
    onProgress: async ({ current, total, result: itemResult, itemId }) => {
      // 취소 체크
      if (await checkCancellation()) {
        throw new Error('CANCELLED_BY_USER')
      }

      // 타임아웃 체크
      if (Date.now() - pipelineStartTime > PIPELINE_TIMEOUT_MS) {
        throw new Error('PIPELINE_TIMEOUT')
      }

      // 연속 실패 체크
      if (!itemResult.success) {
        consecutiveFailures++
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error('TOO_MANY_FAILURES')
        }
      } else {
        consecutiveFailures = 0
      }

      // 결과 수집 (서비스에서 전달된 itemId 사용으로 인덱스 불일치 문제 해결)
      const collectedProductId = itemId ?? collectedProducts[current]?.id ?? 0
      const createdResult: CreatedProductResult = {
        channelId: collectedProductId,
        status: itemResult.success ? 'success' : 'failed',
        productId: itemResult.data?.id,
        productName: itemResult.data?.name,
        error: itemResult.error,
      }
      createdProducts.push(createdResult)

      if (itemResult.success) {
        totalCreated++
      } else if (itemResult.error) {
        errors.push({
          itemId: collectedProductId,
          message: itemResult.error,
          timestamp: new Date(),
        })
      }

      // 진행 상황 및 details 실시간 업데이트
      if (workflowLogId) {
        const currentSuccess = createdProducts.filter((p) => p.status === 'success').length
        const currentFailed = createdProducts.filter((p) => p.status === 'failed').length
        await updateWorkflowProgress(workflowLogId, collectedProducts.length, currentSuccess, currentFailed, {
          productCreate: {
            createdProducts: createdProducts.slice(-10),
            totalCreated,
            errors: errors.slice(-5),
          },
        })
      }
    },
  }).catch((error: Error) => {
    // 조기 종료 처리
    if (error.message === 'CANCELLED_BY_USER') {
      errors.push({ itemId: 0, message: '사용자에 의해 취소됨', timestamp: new Date() })
    } else if (error.message === 'PIPELINE_TIMEOUT') {
      errors.push({ itemId: 0, message: '파이프라인 실행 시간이 초과되었습니다.', timestamp: new Date() })
    } else if (error.message === 'TOO_MANY_FAILURES') {
      errors.push({ itemId: 0, message: `연속 ${MAX_CONSECUTIVE_FAILURES}회 실패로 파이프라인이 중단되었습니다.`, timestamp: new Date() })
    } else {
      throw error
    }
    return null
  })

  // 조기 종료된 경우
  if (!batchResult) {
    return {
      success: false,
      totalItems: collectedProducts.length,
      successCount: createdProducts.filter((p) => p.status === 'success').length,
      failedCount: createdProducts.filter((p) => p.status === 'failed').length,
      details: {
        createdProducts,
        totalCreated,
        cancelled: errors.some(e => e.message.includes('취소')),
      },
      errors,
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
