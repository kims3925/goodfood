/**
 * Transform Pipeline
 * AI를 사용하여 수집된 게시물(CollectedPost)을 수집상품(CollectedProduct)으로 변환
 *
 * 배치 처리 방식:
 * - 여러 게시물을 하나의 API 호출로 처리하여 RPD(Requests Per Day) 절약
 * - gemini-2.5-flash-lite 기준: RPD 20, RPM 10, TPM 250,000
 * - 5개 게시물/배치, 자동화 1회당 2배치 = 10개 게시물, 2 RPD
 *
 * Note: Product 생성은 이 파이프라인에서 하지 않음
 * Product는 사용자가 수집상품 관리 페이지에서 수동으로 생성함
 */

import prisma, { AiProvider } from '@bandauto/db'
import { getBatchContext } from '../context'
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
// BATCH PROCESSING CONFIGURATION
// =============================================

// 배치 설정: RPD 절약을 위한 배치 처리
const BATCH_SIZE = 5  // 5개 게시물/배치 (출력 토큰 제한 고려)
const MAX_BATCHES_PER_RUN = 2  // 자동화 1회당 최대 2배치 = 2 RPD

// 배치 간 대기 시간 (RPM 10 = 6초/요청, 여유 고려하여 7초 설정)
const BATCH_INTERVAL_MS = 7000

// 전체 파이프라인 타임아웃 (10분)
const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000

// =============================================
// TRANSFORM PIPELINE (BATCH MODE)
// =============================================

/**
 * AI 변환 파이프라인 실행 (배치 처리 방식)
 * CollectedPost에서 AI를 사용하여 CollectedProduct 생성
 *
 * 배치 처리:
 * - 5개 게시물을 하나의 AI 요청으로 처리
 * - 자동화 1회당 최대 2배치 = 10개 게시물
 * - RPD 사용량: 2 (기존 개별 처리 대비 80% 절약)
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

  console.log(`[Transform] Starting batch processing for user ${userId}`)
  console.log(`[Transform] Batch size: ${BATCH_SIZE}, Max batches: ${MAX_BATCHES_PER_RUN}`)

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

  // 최대 처리 개수: 배치 크기 × 최대 배치 수
  const maxPostsPerRun = BATCH_SIZE * MAX_BATCHES_PER_RUN

  const posts = await prisma.collectedPost.findMany({
    where: whereClause,
    include: {
      images: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    take: maxPostsPerRun,
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

  console.log(`[Transform] Found ${posts.length} posts to transform (max: ${maxPostsPerRun})`)

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
    const batch = batches[batchIndex]

    // 파이프라인 타임아웃 체크
    if (Date.now() - pipelineStartTime > PIPELINE_TIMEOUT_MS) {
      console.log(`[Transform] Pipeline timeout reached, stopping...`)
      errors.push({
        itemId: 0,
        message: `파이프라인 실행 시간이 초과되었습니다. 나머지 항목은 다음 실행에서 처리됩니다.`,
        timestamp: new Date(),
      })
      break
    }

    // 첫 번째 배치가 아니면 배치 간 대기
    if (batchIndex > 0) {
      console.log(`[Transform] Waiting ${BATCH_INTERVAL_MS / 1000}s before next batch...`)
      await new Promise((resolve) => setTimeout(resolve, BATCH_INTERVAL_MS))
    }

    console.log(`[Transform] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} posts)`)

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

      // 배치 변환 실행 (1회 API 호출)
      const batchResults = await transformPostsToProductsBatch(
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
                rawMetadata: JSON.parse(JSON.stringify({
                  category: result.draft.categoryId,
                  options: result.draft.options,
                  variants: result.draft.variants,
                  shipping: {
                    shippingFee: result.draft.shippingFee ?? null,
                    shippingInfo: result.draft.shippingInfo ?? null,
                  },
                })),
              },
            })

            transformedPost = {
              postId: result.postId,
              status: 'success',
              collectedProductId: collectedProduct.id,
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

      // AI 사용량 업데이트 (배치당 1회)
      await prisma.aiApiConfig.update({
        where: { id: aiConfig.id },
        data: {
          usageCount: { increment: 1 },  // 배치 1회 = API 1회
          lastUsedAt: new Date(),
        },
      })

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

    // 진행 상황 업데이트
    if (workflowLogId) {
      const currentSuccess = transformedPosts.filter((p) => p.status === 'success').length
      const currentFailed = transformedPosts.filter((p) => p.status === 'failed').length
      await updateWorkflowProgress(workflowLogId, posts.length, currentSuccess, currentFailed)
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
