/**
 * Publish Pipeline
 * 상품을 소매채널(소매밴드 등)에 발행
 */

import prisma, { PublishStatus, ChannelKind } from '@bandauto/db'
import { getBatchContext } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import { NaverBandClient } from '@/modules/sourcing/domain/src/channel'
import {
  PublishConfig,
  PublishResult,
  PublishedProductResult,
  ChannelPublishResult,
  PipelineError,
} from '../types'

// 지연 함수
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Band API 쿨다운 지연 시간 (10초)
const BAND_API_COOLDOWN_MS = 10000

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
  const publishedProducts: PublishedProductResult[] = []
  const channelResults: ChannelPublishResult[] = []

  console.log(`[Publish] Starting for user ${userId}`)

  // 발행할 상품 조회 (선택된 상품만)
  const whereClause: any = {
    userId,
  }

  if (config.productIds?.length) {
    whereClause.id = { in: config.productIds }
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    include: {
      collectedProduct: {
        include: {
          post: {
            include: {
              images: {
                orderBy: { sortOrder: 'asc' },
              },
            },
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
        channelResults: [],
      },
      errors: [],
    }
  }

  console.log(`[Publish] Found ${products.length} products to publish`)

  // 소매채널 조회 (하위 호환성: channelIds도 channelIds로 처리)
  const channelIds = config.channelIds || config.channelIds
  const retailChannels = await prisma.channel.findMany({
    where: {
      userId,
      id: { in: channelIds },
      kind: ChannelKind.RETAIL,
      isActive: true,
    },
    include: {
      apiConfig: true,
    },
  })

  if (retailChannels.length === 0) {
    throw new Error('No active retail channels found')
  }

  console.log(`[Publish] Publishing to ${retailChannels.length} retail channels`)

  // 진행 상황 초기화
  const { workflowLogId } = context
  const totalItems = products.length * retailChannels.length
  let currentSuccess = 0
  let currentFailed = 0

  if (workflowLogId) {
    await updateWorkflowProgress(workflowLogId, totalItems, 0, 0)
  }

  // 각 소매채널에 발행
  for (const channel of retailChannels) {
    const channelResult: ChannelPublishResult = {
      channelId: channel.id,
      channelName: channel.name,
      attempted: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    }

    if (!channel.apiConfig?.accessToken) {
      channelResult.errors.push('API 토큰이 설정되지 않았습니다')
      channelResults.push(channelResult)
      continue
    }

    // Band API 클라이언트 초기화
    const bandClient = new NaverBandClient(channel.apiConfig.accessToken)

    // 각 상품 발행
    for (const product of products) {
      channelResult.attempted++

      // 이미 발행된 상품인지 확인
      const existingPublish = await prisma.publishedProduct.findUnique({
        where: {
          productId_channelId: {
            productId: product.id,
            channelId: channel.id,
          },
        },
      })

      if (existingPublish && existingPublish.status === PublishStatus.SUCCESS) {
        channelResult.skipped++
        publishedProducts.push({
          productId: product.id,
          channelId: channel.id,
          postKey: existingPublish.externalId || undefined,
          status: PublishStatus.SUCCESS,
        })
        continue
      }

      try {
        // 첫 번째 상품이 아니면 쿨다운 대기 (Band API 제한)
        if (channelResult.attempted > 1) {
          console.log(`[Publish] Waiting ${BAND_API_COOLDOWN_MS / 1000}s for Band API cooldown...`)
          await delay(BAND_API_COOLDOWN_MS)
        }

        // 게시글 내용 생성
        const postContent = buildPostContent(product)

        // Band API로 게시물 작성
        const { postKey } = await bandClient.createPost(channel.channelKey, postContent, {
          doPush: false, // 푸시 알림 비활성화
        })

        // 댓글로 주문서 URL 추가 (채널의 formUrl 사용)
        if (channel.formUrl) {
          const commentContent = buildCommentContent(channel.formUrl)
          await bandClient.createComment(channel.channelKey, postKey, commentContent)
        }

        // PublishedProduct 레코드 생성/업데이트
        await prisma.publishedProduct.upsert({
          where: {
            productId_channelId: {
              productId: product.id,
              channelId: channel.id,
            },
          },
          create: {
            userId,
            productId: product.id,
            channelId: channel.id,
            status: PublishStatus.SUCCESS,
            externalId: postKey,
            publishedAt: new Date(),
          },
          update: {
            status: PublishStatus.SUCCESS,
            externalId: postKey,
            errorMessage: null,
            publishedAt: new Date(),
          },
        })

        channelResult.success++
        currentSuccess++
        publishedProducts.push({
          productId: product.id,
          channelId: channel.id,
          postKey,
          status: PublishStatus.SUCCESS,
        })

        // 진행 상황 업데이트
        if (workflowLogId) {
          await updateWorkflowProgress(workflowLogId, totalItems, currentSuccess, currentFailed)
        }

        console.log(`[Publish] Published product ${product.id} to ${channel.name} -> post_key: ${postKey}`)
      } catch (publishError: any) {
        console.error(
          `[Publish] Error publishing product ${product.id} to ${channel.name}:`,
          publishError
        )

        // 실패 이력 저장
        await prisma.publishedProduct.upsert({
          where: {
            productId_channelId: {
              productId: product.id,
              channelId: channel.id,
            },
          },
          create: {
            userId,
            productId: product.id,
            channelId: channel.id,
            status: PublishStatus.FAILED,
            errorMessage: publishError.message,
            publishedAt: new Date(),
          },
          update: {
            status: PublishStatus.FAILED,
            errorMessage: publishError.message,
            publishedAt: new Date(),
          },
        })

        channelResult.failed++
        currentFailed++
        channelResult.errors.push(`Product ${product.id}: ${publishError.message}`)
        publishedProducts.push({
          productId: product.id,
          channelId: channel.id,
          status: PublishStatus.FAILED,
          error: publishError.message,
        })

        // 진행 상황 업데이트
        if (workflowLogId) {
          await updateWorkflowProgress(workflowLogId, totalItems, currentSuccess, currentFailed)
        }

        errors.push({
          itemId: `${product.id}-${channel.id}`,
          message: publishError.message,
          timestamp: new Date(),
        })
      }
    }

    channelResults.push(channelResult)
  }

  const totalSuccess = channelResults.reduce((sum, r) => sum + r.success, 0)
  const totalFailed = channelResults.reduce((sum, r) => sum + r.failed, 0)

  return {
    success: totalFailed === 0,
    totalItems: products.length * retailChannels.length,
    successCount: totalSuccess,
    failedCount: totalFailed,
    details: {
      publishedProducts,
      channelResults,
    },
    errors,
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * 게시글 내용 생성
 */
function buildPostContent(product: any): string {
  const lines: string[] = []

  // 상품명
  lines.push(`🛍️ ${product.name}`)
  lines.push('')

  // 가격 정보 (판매가만 노출)
  if (product.price) {
    lines.push(`💰 판매가: ${product.price.toLocaleString()}원`)
    lines.push('')
  }

  // 상품 설명
  if (product.description) {
    lines.push(product.description)
  } else if (product.collectedProduct?.post?.content) {
    lines.push(product.collectedProduct.post.content)
  }

  return lines.join('\n')
}

/**
 * 댓글 내용 생성 (주문서 URL)
 */
function buildCommentContent(formUrl: string): string {
  const lines: string[] = []

  lines.push(`📋 주문서 작성하기`)
  lines.push(formUrl)

  return lines.join('\n')
}
