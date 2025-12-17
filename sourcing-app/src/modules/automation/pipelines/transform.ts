/**
 * Transform Pipeline
 * AI를 사용하여 수집된 게시물(CollectedPost)을 수집상품(CollectedProduct)으로 변환
 *
 * 배치 처리 방식 (API 할당량 제한 대응):
 * - 10개 게시물당 1회 API 호출
 * - 요청 간 1분(60초) 대기 (할당량 초과 방지)
 * - 제한 없이 모든 대기 게시물 처리
 *
 * Note: Product 생성은 이 파이프라인에서 하지 않음
 * Product는 사용자가 수집상품 관리 페이지에서 수동으로 생성함
 */

import prisma, { AiProvider } from '@bandauto/db'
import { getBatchContext, checkCancellation } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import { transformPostsToProductsBatch, BatchTransformResult } from '@/modules/transformation/product.transformer'
import { settingsService } from '@/modules/config/domain/src/settings'
import { ProductTransformationError } from '@/modules/transformation/product.types'
import {
  TransformConfig,
  TransformResult,
  TransformedPost,
  PipelineError,
} from '../types'

// =============================================
// PROCESSING CONFIGURATION
// =============================================

// 배치 처리 설정 (TPM 15k 제한 대응)
const BATCH_SIZE = 10  // 10개 게시물/요청

// 요청 간 대기 시간 (API 할당량 초과 방지)
const REQUEST_INTERVAL_MS = 60000  // 60초 (1분)

// 전체 파이프라인 타임아웃 (없음 - 모든 게시물 처리)
const PIPELINE_TIMEOUT_MS = 0  // 타임아웃 비활성화

// 재시도 설정 (TRANSIENT 에러 대응)
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 10000  // 10초 (재시도마다 10s, 20s, 30s)

// =============================================
// TRANSFORM PIPELINE (BATCH MODE)
// =============================================

/**
 * AI 변환 파이프라인 실행 (배치 처리 방식)
 * CollectedPost에서 AI를 사용하여 CollectedProduct 생성
 *
 * 배치 처리 (TPM 15k 제한 대응):
 * - 10개 게시물당 1회 API 호출
 * - 요청 간 60초 대기 (TPM 제한 회피)
 * - 제한 없이 대기 중인 모든 게시물 처리
 */
export async function runTransformPipeline(
  config: TransformConfig
): Promise<TransformResult> {
  const context = getBatchContext()
  if (!context) {
    throw new Error('Batch context is required')
  }

  const { userId } = context
  const errors: PipelineError[] = []
  const transformedPosts: TransformedPost[] = []
  let createdProducts = 0

  console.log(`[Transform] Starting processing for user ${userId}`)

  // AI 설정 조회
  const aiConfig = await prisma.aiApiConfig.findFirst({
    where: {
      userId,
      provider: config.aiProvider,
      isActive: true,
    },
  })

  if (!aiConfig) {
    throw new Error(`Active ${config.aiProvider} API config not found`)
  }

  // 변환할 게시물 조회 (아직 CollectedProduct가 없는 게시물)
  const whereClause: any = {
    userId,
    collectedProducts: {
      none: {}, // CollectedProduct가 없는 게시물만
    },
  }

  if (config.postIds?.length) {
    whereClause.id = { in: config.postIds }
  }

  // 제한 없이 모든 대기 게시물 조회
  const posts = await prisma.collectedPost.findMany({
    where: whereClause,
    include: {
      images: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (posts.length === 0) {
    console.log('[Transform] No posts to transform')
    return {
      success: true,
      totalItems: 0,
      successCount: 0,
      failedCount: 0,
      details: {
        transformedPosts: [],
        createdProducts: 0,
        skippedCount: 0,
        retryablePostIds: [],
      },
      errors: [],
    }
  }

  console.log(`[Transform] Found ${posts.length} posts to transform`)

  // 진행 상황 초기화
  const { workflowLogId } = context
  if (workflowLogId) {
    await updateWorkflowProgress(workflowLogId, posts.length, 0, 0)
  }

  // 파이프라인 시작 시간 기록
  const pipelineStartTime = Date.now()

  // 가격 정책 조회
  let pricingPolicyContent: string | null = null
  if (config.pricingPolicyId) {
    const policy = await prisma.pricingPolicy.findUnique({
      where: { id: config.pricingPolicyId },
    })
    pricingPolicyContent = policy?.content || null
  }

  // 게시물을 배치로 나누기
  const batches: typeof posts[] = []
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    batches.push(posts.slice(i, i + BATCH_SIZE))
  }

  console.log(`[Transform] Split into ${batches.length} batches`)

  // 각 배치 처리
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    // 취소 체크: 각 배치 처리 전에 확인
    if (await checkCancellation()) {
      console.log(`[Transform] Cancelled by user before batch ${batchIndex + 1}`)
      return {
        success: false,
        totalItems: posts.length,
        successCount: transformedPosts.filter((p) => p.status === 'success').length,
        failedCount: transformedPosts.filter((p) => p.status === 'failed').length,
        details: {
          transformedPosts,
          createdProducts,
          skippedCount: 0,
          retryablePostIds: [],
          cancelled: true,
        },
        errors: [...errors, { itemId: 0, message: '사용자에 의해 취소됨', timestamp: new Date() }],
      }
    }

    const batch = batches[batchIndex]

    // 첫 번째 요청이 아니면 대기 (TPM 제한 대응)
    if (batchIndex > 0) {
      console.log(`[Transform] Waiting ${REQUEST_INTERVAL_MS / 1000}s before next request...`)
      await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS))
    }

    console.log(`[Transform] Processing ${batchIndex + 1}/${batches.length}`)

    try {
      // 배치 입력 준비
      const inputs = batch.map(post => ({
        post: post as any,
        aiProvider: config.aiProvider,
        aiConfig: {
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
        },
      }))

      // 배치 변환 실행 (재시도 로직 포함)
      const batchResults = await runBatchWithRetry(
        inputs,
        {
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          provider: config.aiProvider,
        },
        pricingPolicyContent
      )

      // 결과 처리
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i]
        const post = batch[i]

        let transformedPost: TransformedPost

        if (result.success && result.draft) {
          try {
            // CollectedProduct 생성
            const collectedProduct = await prisma.collectedProduct.create({
              data: {
                userId,
                postId: post.id,
                name: result.draft.name,
                description: result.draft.description || null,
                currency: result.draft.currency || 'KRW',
                rawMetadata: JSON.stringify({
                  category: result.draft.categoryId,
                  options: result.draft.options,
                  variants: result.draft.variants,
                  wholesalePrice: result.draft.wholesalePrice ?? null,
                  price: result.draft.price ?? null,
                  shipping: {
                    shippingFee: result.draft.shippingFee ?? null,
                    shippingInfo: result.draft.shippingInfo ?? null,
                  },
                }),
              },
            })

            transformedPost = {
              postId: result.postId,
              status: 'success',
              channelId: collectedProduct.id,
            }
            createdProducts++

            console.log(`[Transform] Created collectedProduct ${collectedProduct.id} for post ${post.id}`)
          } catch (dbError: any) {
            console.error(`[Transform] DB error for post ${post.id}:`, dbError.message)
            transformedPost = {
              postId: result.postId,
              status: 'failed',
              error: `DB 저장 실패: ${dbError.message}`,
              errorType: 'PERMANENT',
              retryable: false,
            }

            errors.push({
              itemId: post.id,
              message: `DB 저장 실패: ${dbError.message}`,
              timestamp: new Date(),
            })
          }
        } else {
          // 배치 내 개별 실패
          transformedPost = {
            postId: result.postId,
            status: 'failed',
            error: result.error || '알 수 없는 오류',
            errorType: 'PERMANENT',
            retryable: true,  // 배치 실패는 재시도 가능
          }

          console.log(`[Transform] Post ${post.id} failed: ${result.error}`)

          errors.push({
            itemId: post.id,
            message: result.error || '알 수 없는 오류',
            timestamp: new Date(),
          })
        }

        transformedPosts.push(transformedPost)
      }

      // 배치에서 토큰 사용량 추출 (첫 번째 결과에 포함)
      const tokensUsed = batchResults[0]?.tokensUsed || 0

      // AI 사용량 업데이트 (배치당 1회 + 토큰 누적)
      await prisma.aiApiConfig.update({
        where: { id: aiConfig.id },
        data: {
          usageCount: { increment: 1 },  // 배치 1회 = API 1회
          totalTokensUsed: { increment: BigInt(tokensUsed) },  // 토큰 누적
          lastUsedAt: new Date(),
        },
      })

      if (tokensUsed > 0) {
        console.log(`[Transform] Batch ${batchIndex + 1} used ${tokensUsed} tokens`)
      }

      console.log(`[Transform] Batch ${batchIndex + 1} completed`)

    } catch (batchError: any) {
      console.error(`[Transform] Batch ${batchIndex + 1} failed:`, batchError)

      // 배치 전체 실패 시 모든 게시물을 실패로 처리
      for (const post of batch) {
        const transformedPost: TransformedPost = {
          postId: post.id,
          status: 'failed',
          error: batchError.message,
          errorType: batchError instanceof ProductTransformationError && batchError.isTransient()
            ? 'TRANSIENT'
            : 'PERMANENT',
          retryable: batchError instanceof ProductTransformationError && batchError.isTransient(),
        }

        transformedPosts.push(transformedPost)

        errors.push({
          itemId: post.id,
          message: batchError.message,
          timestamp: new Date(),
        })
      }

      // 배치 실패 시 다음 배치 시도 여부 결정
      if (batchError.message?.includes('API key') || batchError.message?.includes('401')) {
        // API 키 에러는 중단
        console.log('[Transform] API key error, stopping pipeline')
        errors.push({
          itemId: 0,
          message: 'API 키 오류로 파이프라인이 중단되었습니다.',
          timestamp: new Date(),
        })
        break
      }
      // 그 외 에러는 다음 배치 계속 시도
    }

    // 진행 상황 및 details 실시간 업데이트
    if (workflowLogId) {
      const currentSuccess = transformedPosts.filter((p) => p.status === 'success').length
      const currentFailed = transformedPosts.filter((p) => p.status === 'failed').length
      await updateWorkflowProgress(workflowLogId, posts.length, currentSuccess, currentFailed, {
        transform: {
          transformedPosts: transformedPosts.slice(-10), // 최근 10개만
          batchProgress: { current: batchIndex + 1, total: batches.length },
          totalSuccess: currentSuccess,  // 실시간 총 성공 건수
          totalFailed: currentFailed,    // 실시간 총 실패 건수
          errors: errors.slice(-5),
        },
      })
    }
  }

  // 결과 집계
  const successCount = transformedPosts.filter((p) => p.status === 'success').length
  const failedCount = transformedPosts.filter((p) => p.status === 'failed').length
  const skippedPosts = transformedPosts.filter((p) => p.status === 'skipped')
  const skippedCount = skippedPosts.length
  const retryablePostIds = transformedPosts
    .filter((p) => p.retryable)
    .map((p) => p.postId)

  console.log(`[Transform] Completed: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`)
  console.log(`[Transform] API calls made: ${batches.length} (batch mode)`)
  console.log(`[Transform] RPD saved: ${posts.length - batches.length} requests`)

  if (retryablePostIds.length > 0) {
    console.log(`[Transform] Retryable post IDs: ${retryablePostIds.join(', ')}`)
  }

  return {
    success: failedCount === 0,
    totalItems: posts.length,
    successCount,
    failedCount,
    details: {
      transformedPosts,
      createdProducts,
      skippedCount,
      retryablePostIds,
    },
    errors,
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * 배치 변환 실행 (재시도 로직 포함)
 * TRANSIENT 에러 발생 시 최대 3회 재시도 (10s, 20s, 30s 대기)
 */
async function runBatchWithRetry(
  inputs: any[],
  aiConfig: { apiKey: string; model: string; provider: any },
  pricingPolicyContent: string | null,
  retryCount: number = 0
): Promise<BatchTransformResult[]> {
  try {
    return await transformPostsToProductsBatch(inputs, aiConfig, pricingPolicyContent)
  } catch (error: any) {
    // TRANSIENT 에러이고 재시도 가능한 경우
    if (
      error instanceof ProductTransformationError &&
      error.isTransient() &&
      retryCount < MAX_RETRIES
    ) {
      const delay = RETRY_DELAY_MS * (retryCount + 1)  // 10s, 20s, 30s
      console.log(`[Transform] TRANSIENT error, retrying in ${delay / 1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      console.log(`[Transform] Error: ${error.message}`)

      await new Promise((resolve) => setTimeout(resolve, delay))
      return runBatchWithRetry(inputs, aiConfig, pricingPolicyContent, retryCount + 1)
    }

    // 재시도 불가능한 에러거나 최대 재시도 횟수 초과
    throw error
  }
}
