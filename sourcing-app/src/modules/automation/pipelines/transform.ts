/**
 * Transform Pipeline
 * AI를 사용하여 게시물을 상품으로 변환
 */

import { PrismaClient, AiProvider, ProductStatus } from '@prisma/client'
import { getBatchContext } from '../context'
import { transformPostToProduct } from '@/modules/transformation'
import {
  TransformConfig,
  TransformResult,
  TransformedPost,
  PipelineError,
} from '../types'

const prisma = new PrismaClient()

// =============================================
// TRANSFORM PIPELINE
// =============================================

/**
 * AI 변환 파이프라인 실행
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

  // 변환할 게시물 조회
  const whereClause: any = {
    userId,
    product: null, // 상품이 없는 게시물만
  }

  if (config.postIds?.length) {
    whereClause.id = { in: config.postIds }
  }

  const posts = await prisma.post.findMany({
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
    const transformedPost: TransformedPost = {
      postId: post.id,
      status: 'pending' as any,
    }

    try {
      console.log(`[Transform] Processing post ${post.id}: ${post.title.substring(0, 50)}...`)

      // 이미 상품이 있는지 다시 확인 (동시성 방지)
      const existingProduct = await prisma.product.findUnique({
        where: { postId: post.id },
      })

      if (existingProduct) {
        transformedPost.status = 'skipped'
        transformedPost.productId = existingProduct.id
        transformedPosts.push(transformedPost)
        continue
      }

      // AI 변환 실행
      const draft = await transformPostToProduct({
        post: {
          id: post.id,
          title: post.title,
          content: post.content,
          images: post.images,
        },
        aiProvider: config.aiProvider,
        aiConfig: {
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
        },
        policyContent: pricingPolicyContent,
      })

      // 상품 생성
      const product = await prisma.product.create({
        data: {
          userId,
          postId: post.id,
          name: draft.name,
          description: draft.description || null,
          status: ProductStatus.DRAFT,
          categoryId: draft.categoryId || null,
          currency: draft.currency || 'KRW',
          price: draft.price || null,
          wholesalePrice: draft.wholesalePrice || null,
          thumbnailUrl: post.images[0]?.imageUrl || null,
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
                  wholesalePrice: v.wholesalePrice || draft.wholesalePrice || null,
                  stock: v.stock || 0,
                })),
              }
            : undefined,
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
      transformedPost.productId = product.id
      createdProducts++

      console.log(`[Transform] Created product ${product.id} for post ${post.id}`)
    } catch (postError: any) {
      console.error(`[Transform] Error transforming post ${post.id}:`, postError)
      transformedPost.status = 'failed'
      transformedPost.error = postError.message
      errors.push({
        itemId: post.id,
        message: postError.message,
        timestamp: new Date(),
      })
    }

    transformedPosts.push(transformedPost)
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
