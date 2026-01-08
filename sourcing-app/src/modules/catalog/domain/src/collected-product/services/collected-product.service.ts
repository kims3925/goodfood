/**
 * CollectedProduct Service
 * 수집상품 관리를 위한 서비스 레이어
 *
 * 수동 실행(API)과 자동화 파이프라인에서 동일하게 사용
 */

import prisma, { CollectedProduct, Prisma } from '@bandauto/db'
import type { BatchResult, ProgressCallback } from '@/types/batch.types'
import { createEmptyBatchResult } from '@/types/batch.types'

// Prisma 트랜잭션 클라이언트 타입
type PrismaTransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

/**
 * 수집상품 생성 입력 타입
 */
export interface CollectedProductCreateInput {
  userId: number
  postId: number
  name: string | null
  description?: string | null
  currency?: string
  rawMetadata?: Record<string, unknown> | null
  pricingPolicyContent?: string | null
}

/**
 * 수집상품 생성 옵션 타입
 */
export interface CollectedProductCreateOptions {
  tx?: PrismaTransactionClient
}

/**
 * 수집상품 서비스
 */
export class CollectedProductService {
  /**
   * 수집상품 단건 생성 (수동 API에서 사용)
   * @param data 수집상품 생성 입력
   * @param options 옵션 (트랜잭션 클라이언트 등)
   */
  async create(
    data: CollectedProductCreateInput,
    options?: CollectedProductCreateOptions
  ): Promise<CollectedProduct> {
    const { userId, postId, name, description, currency, rawMetadata, pricingPolicyContent } = data
    const db = options?.tx || prisma

    // 중복 체크: 같은 postId로 이미 생성된 수집상품이 있는지 확인
    const existing = await db.collectedProduct.findFirst({
      where: { postId, userId },
    })

    if (existing) {
      throw new Error('이미 해당 게시물로 등록된 수집상품이 있습니다.')
    }

    // 게시물 존재 여부 확인
    const post = await db.collectedPost.findFirst({
      where: { id: postId, userId },
    })

    if (!post) {
      throw new Error('게시물을 찾을 수 없습니다.')
    }

    // rawMetadata에 pricingPolicyContent 포함
    const metadata = rawMetadata ? { ...rawMetadata } : {}
    if (pricingPolicyContent) {
      metadata.pricingPolicyContent = pricingPolicyContent
    }

    // 수집상품 생성
    const collectedProduct = await db.collectedProduct.create({
      data: {
        userId,
        postId,
        name: name || null,
        description: description || null,
        currency: currency || 'KRW',
        rawMetadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      },
      include: {
        post: {
          include: {
            channel: {
              select: {
                id: true,
                name: true,
                coverUrl: true,
              },
            },
            images: {
              take: 1,
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    })

    return collectedProduct
  }

  /**
   * 수집상품 배치 생성 (자동화 파이프라인에서 사용)
   */
  async createBatch(
    data: CollectedProductCreateInput[],
    onProgress?: ProgressCallback<CollectedProduct>
  ): Promise<BatchResult<CollectedProduct>> {
    const result = createEmptyBatchResult<CollectedProduct>()

    if (data.length === 0) {
      return result
    }

    result.total = data.length

    // userId 일관성 검증: 배치의 모든 항목은 동일한 userId를 가져야 함
    const userId = data[0].userId
    const hasInconsistentUserId = data.some((d) => d.userId !== userId)
    if (hasInconsistentUserId) {
      throw new Error('배치 생성 시 모든 항목은 동일한 userId를 가져야 합니다.')
    }

    // 배치 중복 체크
    const postIds = data.map((d) => d.postId)
    const existingProducts = await prisma.collectedProduct.findMany({
      where: {
        postId: { in: postIds },
        userId,
      },
      select: { postId: true },
    })
    const existingPostIds = new Set(existingProducts.map((p) => p.postId))

    console.log(`[CollectedProductService.createBatch] Total: ${data.length}, Existing: ${existingPostIds.size}`)

    // 각 항목 처리
    for (let i = 0; i < data.length; i++) {
      const item = data[i]

      // 중복 체크
      if (existingPostIds.has(item.postId)) {
        result.skippedCount++
        result.results.push({
          success: true,
          error: `이미 등록된 수집상품 (postId: ${item.postId})`,
        })

        if (onProgress) {
          await onProgress({
            current: i,
            total: data.length,
            result: { success: true, error: 'Skipped: duplicate' },
          })
        }
        continue
      }

      try {
        // 수집상품 생성
        const collectedProduct = await prisma.collectedProduct.create({
          data: {
            userId: item.userId,
            postId: item.postId,
            name: item.name || null,
            description: item.description || null,
            currency: item.currency || 'KRW',
            rawMetadata: item.rawMetadata ? JSON.stringify(item.rawMetadata) : null,
          },
        })

        result.successCount++
        result.results.push({
          success: true,
          data: collectedProduct,
        })

        if (onProgress) {
          await onProgress({
            current: i,
            total: data.length,
            result: { success: true, data: collectedProduct },
          })
        }

        console.log(`[CollectedProductService.createBatch] Created collectedProduct ${collectedProduct.id} for post ${item.postId}`)
      } catch (error: any) {
        result.failedCount++
        result.results.push({
          success: false,
          error: error.message || '수집상품 생성 실패',
          errorType: 'PERMANENT',
        })

        if (onProgress) {
          await onProgress({
            current: i,
            total: data.length,
            result: { success: false, error: error.message },
          })
        }

        console.error(`[CollectedProductService.createBatch] Failed for post ${item.postId}:`, error.message)
      }
    }

    console.log(`[CollectedProductService.createBatch] Completed: ${result.successCount} success, ${result.failedCount} failed, ${result.skippedCount} skipped`)
    return result
  }

  /**
   * 수집상품 조회 (ID로)
   */
  async getById(id: number, userId: number): Promise<CollectedProduct | null> {
    return prisma.collectedProduct.findFirst({
      where: { id, userId },
      include: {
        post: {
          include: {
            channel: {
              select: {
                id: true,
                name: true,
                coverUrl: true,
              },
            },
            images: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    })
  }

  /**
   * 수집상품 삭제
   */
  async delete(id: number, userId: number): Promise<void> {
    const existing = await prisma.collectedProduct.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      throw new Error('수집상품을 찾을 수 없습니다.')
    }

    await prisma.collectedProduct.delete({ where: { id } })
  }

  /**
   * rawMetadata JSON 파싱 헬퍼
   */
  parseRawMetadata(collectedProduct: CollectedProduct): CollectedProduct & { rawMetadata: Record<string, unknown> | null } {
    return {
      ...collectedProduct,
      rawMetadata: collectedProduct.rawMetadata
        ? JSON.parse(collectedProduct.rawMetadata as string)
        : null,
    }
  }
}

export const collectedProductService = new CollectedProductService()
