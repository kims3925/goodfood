/**
 * Transform Pipeline
 * AI를 사용하여 수집된 게시물을 CollectedProduct로 변환 후 Product로 생성
 */

import prisma, { AiProvider } from '@bandauto/db'
import { getBatchContext } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import { transformPostToProduct } from '@/modules/transformation'
import { downloadAndSaveProductImages } from '@/modules/utils/imageUtils'
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
 * 1. CollectedPost에서 CollectedProduct 생성
 * 2. CollectedProduct에서 Product 생성
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

      // CollectedProduct 생성 (원본 수집 상품)
      const collectedProduct = await prisma.collectedProduct.create({
        data: {
          userId,
          postId: post.id,
          name: draft.name,
          description: draft.description || null,
          currency: draft.currency || 'KRW',
          price: draft.price || null,
        },
      })

      // 게시물 이미지 URL 수집
      const imageUrls = post.images.map((img) => img.url)

      // Product 생성 (내부 기준 상품 - collectedProduct와 연결)
      const product = await prisma.product.create({
        data: {
          userId,
          collectedProductId: collectedProduct.id, // 외래키 연결
          name: draft.name,
          description: draft.description || null,
          categoryId: draft.categoryId || null,
          currency: draft.currency || 'KRW',
          price: draft.price || null,
          thumbnailUrl: post.images[0]?.url || null,
          options: draft.options?.length
            ? {
                create: draft.options.flatMap((opt, groupIndex) =>
                  opt.values.map((value, valueIndex) => ({
                    groupName: opt.groupName,
                    value,
                    sortOrder: groupIndex * 100 + valueIndex,
                  }))
                ),
              }
            : undefined,
          variants: draft.variants?.length
            ? {
                create: draft.variants.map((v) => ({
                  sku: v.sku || null,
                  optionSummary: v.optionSummary || null,
                  price: v.price || draft.price || 0,
                  stock: v.stock || 0,
                })),
              }
            : undefined,
        },
      })

      // 이미지 다운로드 및 ProductImage 저장
      if (imageUrls.length > 0) {
        try {
          console.log(`[Transform] 이미지 다운로드 시작: ${imageUrls.length}개`)
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

            // 첫 번째 이미지를 썸네일로 업데이트 (다운로드된 로컬 URL로)
            await prisma.product.update({
              where: { id: product.id },
              data: { thumbnailUrl: downloadedImages[0].url },
            })

            console.log(`[Transform] 이미지 저장 완료: ${downloadedImages.length}개`)
          }
        } catch (imageError) {
          console.error(`[Transform] 이미지 다운로드/저장 실패 (상품은 생성됨):`, imageError)
          // 이미지 실패해도 상품 생성은 성공으로 처리
        }
      }

      // AI 사용량 업데이트
      await prisma.aiApiConfig.update({
        where: { id: aiConfig.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      })

      transformedPost.status = 'success'
      transformedPost.productId = product.id
      createdProducts++
      consecutiveFailures = 0 // 성공 시 연속 실패 카운터 리셋

      console.log(`[Transform] Created product ${product.id} for post ${post.id}`)
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
