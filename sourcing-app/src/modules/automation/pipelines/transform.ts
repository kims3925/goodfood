/**
 * Transform Pipeline
 * AI를 사용하여 수집된 게시물(CollectedPost)을 수집상품(CollectedProduct)으로 변환
 *
 * Note: Product 생성은 이 파이프라인에서 하지 않음
 * Product는 사용자가 수집상품 관리 페이지에서 수동으로 생성함
 */

import prisma, { AiProvider } from '@bandauto/db'
import { getBatchContext } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import { transformPostToProduct } from '@/modules/transformation'
import {
  TransformConfig,
  TransformResult,
  TransformedPost,
  PipelineError,
} from '../types'

// 연속 실패 시 조기 종료 임계값
const MAX_CONSECUTIVE_FAILURES = 5
// 전체 파이프라인 타임아웃 (10분)
const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000

// =============================================
// TRANSFORM PIPELINE
// =============================================

/**
 * AI 변환 파이프라인 실행
 * CollectedPost에서 AI를 사용하여 CollectedProduct 생성
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

  console.log(`[Transform] Starting for user ${userId}`)

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

  const posts = await prisma.collectedPost.findMany({
    where: whereClause,
    include: {
      images: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    take: 50, // 배치당 최대 50개
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
      },
      errors: [],
    }
  }

  console.log(`[Transform] Found ${posts.length} posts to transform`)

  // 진행 상황 초기화 (totalItems 설정)
  const { workflowLogId } = context
  if (workflowLogId) {
    await updateWorkflowProgress(workflowLogId, posts.length, 0, 0)
  }

  // 파이프라인 시작 시간 기록
  const pipelineStartTime = Date.now()
  let consecutiveFailures = 0

  // 가격 정책 조회
  let pricingPolicyContent: string | null = null
  if (config.pricingPolicyId) {
    const policy = await prisma.pricingPolicy.findUnique({
      where: { id: config.pricingPolicyId },
    })
    pricingPolicyContent = policy?.content || null
  }

  // 각 게시물 변환
  for (const post of posts) {
    // 파이프라인 타임아웃 체크
    if (Date.now() - pipelineStartTime > PIPELINE_TIMEOUT_MS) {
      console.log(`[Transform] Pipeline timeout reached after ${PIPELINE_TIMEOUT_MS / 1000}s, stopping...`)
      errors.push({
        itemId: 0,
        message: `파이프라인 실행 시간이 초과되었습니다 (${PIPELINE_TIMEOUT_MS / 60000}분). 나머지 항목은 다음 실행에서 처리됩니다.`,
        timestamp: new Date(),
      })
      break
    }

    // 연속 실패 체크 - AI API 문제일 가능성 높음
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.log(`[Transform] Too many consecutive failures (${consecutiveFailures}), stopping...`)
      errors.push({
        itemId: 0,
        message: `연속 ${MAX_CONSECUTIVE_FAILURES}회 실패로 파이프라인이 중단되었습니다. AI API 상태를 확인해주세요.`,
        timestamp: new Date(),
      })
      break
    }

    const transformedPost: TransformedPost = {
      postId: post.id,
      status: 'pending' as any,
    }

    try {
      console.log(`[Transform] Processing post ${post.id}: ${post.title.substring(0, 50)}...`)

      // AI 변환 실행
      const draft = await transformPostToProduct({
        post: post as any,
        aiProvider: config.aiProvider,
        aiConfig: {
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
        },
        policyContent: pricingPolicyContent || undefined,
      })

      // CollectedProduct 생성 (수집상품)
      const collectedProduct = await prisma.collectedProduct.create({
        data: {
          userId,
          postId: post.id,
          name: draft.name,
          description: draft.description || null,
          currency: draft.currency || 'KRW',
          // AI 분석 결과를 rawMetadata에 저장 (JSON 직렬화)
          rawMetadata: JSON.parse(JSON.stringify({
            category: draft.categoryId,
            options: draft.options,
            variants: draft.variants,
            shipping: {
              shippingFee: draft.shippingFee ?? null,
              shippingInfo: draft.shippingInfo ?? null,
            },
          })),
        },
      })

      // AI 사용량 업데이트
      await prisma.aiApiConfig.update({
        where: { id: aiConfig.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      })

      transformedPost.status = 'success'
      transformedPost.collectedProductId = collectedProduct.id
      createdProducts++
      consecutiveFailures = 0 // 성공 시 연속 실패 카운터 리셋

      console.log(`[Transform] Created collectedProduct ${collectedProduct.id} for post ${post.id}`)
    } catch (postError: any) {
      console.error(`[Transform] Error transforming post ${post.id}:`, postError)
      transformedPost.status = 'failed'
      transformedPost.error = postError.message
      consecutiveFailures++ // 실패 시 연속 실패 카운터 증가
      errors.push({
        itemId: post.id,
        message: postError.message,
        timestamp: new Date(),
      })
    }

    transformedPosts.push(transformedPost)

    // 진행 상황 업데이트
    if (workflowLogId) {
      const currentSuccess = transformedPosts.filter((p) => p.status === 'success').length
      const currentFailed = transformedPosts.filter((p) => p.status === 'failed').length
      await updateWorkflowProgress(workflowLogId, posts.length, currentSuccess, currentFailed)
    }
  }

  const successCount = transformedPosts.filter((p) => p.status === 'success').length
  const failedCount = transformedPosts.filter((p) => p.status === 'failed').length

  return {
    success: failedCount === 0,
    totalItems: posts.length,
    successCount,
    failedCount,
    details: {
      transformedPosts,
      createdProducts,
    },
    errors,
  }
}
