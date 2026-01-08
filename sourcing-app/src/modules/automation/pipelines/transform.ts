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
 *
 * 수동 실행과 동일한 서비스 레이어(CollectedProductService) 사용으로 통일
 */

import prisma, { AiProvider } from '@bandauto/db'
import { getBatchContext, checkCancellation } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import { transformPostsToProductsBatch, BatchTransformResult } from '@/modules/transformation/product.transformer'
import { settingsService } from '@/modules/config/domain/src/settings'
import { ProductTransformationError } from '@/modules/transformation/product.types'
import { collectedProductService } from '@/modules/catalog/domain/src/collected-product'
import {
  TransformConfig,
  TransformResult,
  TransformedPost,
  PipelineError,
} from '../types'

// =============================================
// PROCESSING CONFIGURATION
// =============================================

// 배치 처리 설정 (유료 API용: 1개씩 순차 처리)
const BATCH_SIZE = 1  // 1개 게시물/요청 (유료 API는 rate limit 충분)

// 전체 파이프라인 타임아웃 (없음 - 모든 게시물 처리)
const PIPELINE_TIMEOUT_MS = 0  // 타임아웃 비활성화

// 재시도 설정 (TRANSIENT 에러 대응)
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000  // 5초 (재시도마다 5s, 10s, 15s)

// =============================================
// MODEL-SPECIFIC RATE LIMITS
// =============================================

interface ModelRateLimit {
  rpm: number      // Requests Per Minute
  tpm: number      // Tokens Per Minute
  rpd: number      // Requests Per Day
}

// Gemini 모델별 Rate Limit (2025년 12월 기준)
const GEMINI_RATE_LIMITS: Record<string, ModelRateLimit> = {
  'gemini-2.5-flash': { rpm: 5, tpm: 250000, rpd: 20 },
  'gemini-2.5-flash-lite': { rpm: 10, tpm: 250000, rpd: 20 },
  'gemini-3-flash': { rpm: 5, tpm: 250000, rpd: 20 },
  // 기본값 (알 수 없는 모델)
  'default': { rpm: 5, tpm: 250000, rpd: 20 },
}

// OpenAI 모델 Rate Limit (일반적으로 더 높음)
const OPENAI_RATE_LIMITS: Record<string, ModelRateLimit> = {
  'gpt-4o': { rpm: 500, tpm: 800000, rpd: 10000 },
  'gpt-4o-mini': { rpm: 500, tpm: 2000000, rpd: 10000 },
  'gpt-4-turbo': { rpm: 500, tpm: 800000, rpd: 10000 },
  'default': { rpm: 60, tpm: 150000, rpd: 10000 },
}

/**
 * 모델의 Rate Limit 정보 반환
 */
function getModelRateLimit(provider: AiProvider, model: string): ModelRateLimit {
  if (provider === AiProvider.GEMINI) {
    return GEMINI_RATE_LIMITS[model] || GEMINI_RATE_LIMITS['default']
  } else if (provider === AiProvider.OPENAI) {
    return OPENAI_RATE_LIMITS[model] || OPENAI_RATE_LIMITS['default']
  }
  // 알 수 없는 provider는 보수적으로 설정
  return { rpm: 5, tpm: 250000, rpd: 20 }
}


/**
 * 일일 사용량 체크 및 업데이트
 * 날짜가 바뀌면 dailyUsageCount를 리셋
 * @returns 현재 일일 사용량
 */
async function checkAndResetDailyUsage(aiConfigId: number): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const aiConfig = await prisma.aiApiConfig.findUnique({
    where: { id: aiConfigId },
    select: { dailyUsageCount: true, dailyResetDate: true },
  })

  if (!aiConfig) return 0

  const resetDate = aiConfig.dailyResetDate ? new Date(aiConfig.dailyResetDate) : null
  resetDate?.setHours(0, 0, 0, 0)

  // 날짜가 바뀌었으면 리셋
  if (!resetDate || resetDate.getTime() !== today.getTime()) {
    await prisma.aiApiConfig.update({
      where: { id: aiConfigId },
      data: {
        dailyUsageCount: 0,
        dailyResetDate: today,
      },
    })
    console.log(`[Transform] Daily usage reset for config ${aiConfigId}`)
    return 0
  }

  return aiConfig.dailyUsageCount
}

/**
 * 일일 사용량 증가
 */
async function incrementDailyUsage(aiConfigId: number): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await prisma.aiApiConfig.update({
    where: { id: aiConfigId },
    data: {
      dailyUsageCount: { increment: 1 },
      dailyResetDate: today,
    },
  })
}

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

  // workflowLogId 참조만 유지 (초기화 제거 - executor.ts에서 누적 관리)
  const { workflowLogId } = context

  // 파이프라인 시작 시간 기록
  const pipelineStartTime = Date.now()

  // 도매처(채널)별 가격 정책 조회
  // 각 게시물의 channelId에 맞는 활성화된 정책을 매핑
  const channelIds = [...new Set(posts.map(p => p.channelId))]
  const channelPolicies = await prisma.pricingPolicy.findMany({
    where: {
      channelId: { in: channelIds },
      userId,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },  // 최신 정책 우선
  })

  // channelId -> policyContent 맵 생성
  const policyByChannel = new Map<number, string>()
  for (const policy of channelPolicies) {
    // 채널당 첫 번째(최신) 활성 정책만 사용
    if (!policyByChannel.has(policy.channelId)) {
      policyByChannel.set(policy.channelId, policy.content)
    }
  }

  console.log(`[Transform] Found policies for ${policyByChannel.size}/${channelIds.length} channels`)

  // config.pricingPolicyContent를 폴백으로 사용
  const fallbackPolicyContent = config.pricingPolicyContent || null

  // 모델에 따른 Rate Limit 정보 조회 (유료 API 모니터링용)
  const rateLimit = getModelRateLimit(config.aiProvider, aiConfig.model)
  console.log(`[Transform] Model ${aiConfig.model} (${config.aiProvider}): No delay (paid API)`)

  // 일일 사용량 체크 및 리셋
  const currentDailyUsage = await checkAndResetDailyUsage(aiConfig.id)
  console.log(`[Transform] Daily usage: ${currentDailyUsage} (paid API - no limit)`)

  // 채널별로 게시물 그룹화 (같은 채널은 같은 정책 적용)
  const postsByChannel = new Map<number, typeof posts>()
  for (const post of posts) {
    const channelPosts = postsByChannel.get(post.channelId) || []
    channelPosts.push(post)
    postsByChannel.set(post.channelId, channelPosts)
  }

  // 채널별로 배치 생성 (각 배치에 정책 정보 포함)
  interface BatchWithPolicy {
    posts: typeof posts
    channelId: number
    policyContent: string | null
  }
  const batches: BatchWithPolicy[] = []

  for (const [channelId, channelPosts] of postsByChannel) {
    // 해당 채널의 정책 조회 (없으면 폴백 정책 사용)
    const policyContent = policyByChannel.get(channelId) || fallbackPolicyContent

    // 채널 내 게시물을 BATCH_SIZE로 분할
    for (let i = 0; i < channelPosts.length; i += BATCH_SIZE) {
      batches.push({
        posts: channelPosts.slice(i, i + BATCH_SIZE),
        channelId,
        policyContent,
      })
    }
  }

  console.log(`[Transform] Processing ${batches.length} posts across ${postsByChannel.size} channels (sequential, no delay)`)

  // 순차 처리 (유료 API: RPD 제한 체크 비활성화)
  let currentRpdUsage = currentDailyUsage
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    // 유료 API는 RPD 한도가 충분하므로 체크 생략

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
    const { posts: batchPosts, channelId: batchChannelId, policyContent: batchPolicyContent } = batch

    // 유료 API: 대기 없이 순차 처리 (응답 오면 바로 다음 요청)
    console.log(`[Transform] Processing ${batchIndex + 1}/${batches.length} (channel: ${batchChannelId}, policy: ${batchPolicyContent ? 'YES' : 'NO'})`)

    try {
      // 배치 입력 준비
      const inputs = batchPosts.map(post => ({
        post: post as any,
        aiProvider: config.aiProvider,
        aiConfig: {
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
        },
      }))

      // 배치 변환 실행 (재시도 로직 포함) - 채널별 정책 적용
      const batchResults = await runBatchWithRetry(
        inputs,
        {
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          provider: config.aiProvider,
        },
        batchPolicyContent  // 해당 채널의 정책 사용
      )

      // 결과 처리
      for (let i = 0; i < batchResults.length; i++) {
        // 취소 체크: 각 결과 처리 전에 확인
        if (await checkCancellation()) {
          console.log(`[Transform] Cancelled by user during result processing`)
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

        const result = batchResults[i]
        const post = batchPosts[i]

        let transformedPost: TransformedPost

        if (result.success && result.draft) {
          // 가격 정책 적용 검증 (정책이 설정된 경우에만)
          if (batchPolicyContent && result.draft.variants && result.draft.variants.length > 0) {
            const unpricedVariants = result.draft.variants.filter(v =>
              v.wholesalePrice !== undefined &&
              v.wholesalePrice !== null &&
              v.price !== undefined &&
              v.wholesalePrice === v.price
            )

            if (unpricedVariants.length > 0) {
              // 가격 정책 미적용 - 실패로 처리
              const failedOptions = unpricedVariants.map(v => v.optionSummary || '기본').join(', ')
              const errorMessage = `가격 정책 미적용: ${unpricedVariants.length}개 옵션의 도매가와 소매가가 동일합니다. (${failedOptions})`

              console.log(`[Transform] Post ${post.id} failed price policy validation: ${errorMessage}`)

              transformedPost = {
                postId: result.postId,
                status: 'failed',
                error: errorMessage,
                errorType: 'PERMANENT',
                retryable: true,  // 정책 수정 후 재시도 가능
              }

              errors.push({
                itemId: post.id,
                message: errorMessage,
                timestamp: new Date(),
              })

              transformedPosts.push(transformedPost)
              continue  // 다음 결과로
            }
          }

          try {
            // 트랜잭션으로 CollectedProduct 생성 + AI 사용량 업데이트 (원자적 처리)
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // TypeScript 타입 안전을 위해 draft를 미리 추출
            const draft = result.draft!

            const collectedProduct = await prisma.$transaction(async (tx) => {
              // CollectedProduct 생성 (CollectedProductService 사용 - 수동과 동일한 로직)
              const created = await collectedProductService.create({
                userId,
                postId: post.id,
                name: draft.name,
                description: draft.description || null,
                currency: draft.currency || 'KRW',
                pricingPolicyContent: batchPolicyContent,  // 적용된 가격 정책 전달
                rawMetadata: {
                  category: draft.categoryId,
                  options: draft.options,
                  variants: draft.variants,
                  wholesalePrice: draft.wholesalePrice ?? null,
                  price: draft.price ?? null,
                  // 배송비 정보 (최상위 레벨 + shipping 객체 둘 다 저장)
                  shippingFee: draft.shippingFee ?? null,
                  shippingInfo: draft.shippingInfo ?? null,
                  bundleMaxQty: draft.bundleMaxQty ?? 1,
                  shipping: {
                    shippingFee: draft.shippingFee ?? null,
                    shippingInfo: draft.shippingInfo ?? null,
                    bundleMaxQty: draft.bundleMaxQty ?? 1,
                  },
                },
              }, { tx })

              // AI 사용량 업데이트 (같은 트랜잭션 내에서)
              await tx.aiApiConfig.update({
                where: { id: aiConfig.id },
                data: {
                  usageCount: { increment: 1 },
                  dailyUsageCount: { increment: 1 },
                  dailyResetDate: today,
                  lastUsedAt: new Date(),
                },
              })

              return created
            })

            transformedPost = {
              postId: result.postId,
              status: 'success',
              channelId: collectedProduct.id,
            }
            createdProducts++
            currentRpdUsage++

            console.log(`[Transform] Created collectedProduct ${collectedProduct.id} for post ${post.id}`)
          } catch (dbError: any) {
            console.error(`[Transform] DB error for post ${post.id}:`, dbError.message)
            transformedPost = {
              postId: result.postId,
              status: 'failed',
              error: `저장 실패: ${dbError.message}`,
              errorType: 'PERMANENT',
              retryable: false,
            }

            errors.push({
              itemId: post.id,
              message: `저장 실패: ${dbError.message}`,
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

      // AI 사용량은 각 성공적인 create 트랜잭션 내에서 업데이트됨

      if (tokensUsed > 0) {
        console.log(`[Transform] Batch ${batchIndex + 1} used ${tokensUsed} tokens`)
      }

      console.log(`[Transform] Batch ${batchIndex + 1} completed (RPD: ${currentRpdUsage}/${rateLimit.rpd})`)

    } catch (batchError: any) {
      console.error(`[Transform] Batch ${batchIndex + 1} failed:`, batchError)

      // 배치 전체 실패 시 모든 게시물을 실패로 처리
      for (const post of batchPosts) {
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
