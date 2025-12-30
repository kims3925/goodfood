/**
 * Collection Pipeline
 * 도매채널(도매밴드 등)에서 게시물 수집
 */

import prisma, { ChannelKind } from '@bandauto/db'
import { getBatchContext, checkCancellation } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import {
  CollectionConfig,
  CollectionResult,
  ChannelCollectionResult,
  PipelineError,
} from '../types'

// =============================================
// COLLECTION PIPELINE
// =============================================

/**
 * 게시물 수집 파이프라인 실행
 */
export async function runCollectionPipeline(
  config: CollectionConfig
): Promise<CollectionResult> {
  const context = getBatchContext()
  if (!context) {
    throw new Error('Batch context is required')
  }

  const { userId } = context
  const errors: PipelineError[] = []
  const channelResults: ChannelCollectionResult[] = []
  let totalNewPosts = 0
  let totalDuplicates = 0

  console.log(`[Collection] Starting for user ${userId}`)

  // channelIds가 없으면 수집하지 않음
  const channelIds = config.channelIds
  if (!channelIds?.length) {
    console.log('[Collection] No channels configured, skipping collection')
    return {
      success: true,
      totalItems: 0,
      successCount: 0,
      failedCount: 0,
      details: {
        channelResults: [],
        totalNewPosts: 0,
        totalDuplicates: 0,
      },
      errors: [],
    }
  }

  // 수집할 채널 목록 조회 (지정된 도매 채널만)
  const whereClause: any = {
    userId,
    kind: ChannelKind.WHOLESALE,
    isActive: true,
    id: { in: channelIds },
  }

  const wholesaleChannels = await prisma.channel.findMany({
    where: whereClause,
  })

  // 사용자의 Band API 설정 조회
  const apiConfig = await prisma.sourcingApiConfig.findFirst({
    where: {
      userId,
      platform: 'BAND',
      isActive: true,
    },
  })

  if (wholesaleChannels.length === 0) {
    console.log('[Collection] No active wholesale channels found')
    return {
      success: true,
      totalItems: 0,
      successCount: 0,
      failedCount: 0,
      details: {
        channelResults: [],
        totalNewPosts: 0,
        totalDuplicates: 0,
      },
      errors: [],
    }
  }

  console.log(`[Collection] Found ${wholesaleChannels.length} channels to collect from`)

  // 진행 상황 초기화
  const { workflowLogId } = context
  if (workflowLogId) {
    await updateWorkflowProgress(workflowLogId, wholesaleChannels.length, 0, 0)
  }

  let processedChannels = 0
  let successChannels = 0
  let failedChannels = 0

  // 각 채널에서 게시물 수집
  for (const channel of wholesaleChannels) {
    // 취소 체크: 각 채널 처리 전에 확인
    if (await checkCancellation()) {
      console.log(`[Collection] Cancelled by user before channel ${channel.name}`)
      errors.push({ itemId: 0, message: '사용자에 의해 취소됨', timestamp: new Date() })
      return {
        success: false,
        totalItems: channelResults.reduce((sum, r) => sum + r.fetched, 0),
        successCount: totalNewPosts,
        failedCount: channelResults.reduce((sum, r) => sum + r.failed, 0),
        details: {
          channelResults,
          totalNewPosts,
          totalDuplicates,
        },
        errors,
      }
    }

    const channelResult: ChannelCollectionResult = {
      channelId: channel.id,
      channelName: channel.name,
      fetched: 0,
      newPosts: 0,
      duplicates: 0,
      failed: 0,
      errors: [],
    }

    try {
      console.log(`[Collection] Collecting from channel: ${channel.name}`)

      // API 토큰 확인
      if (!apiConfig?.accessToken) {
        throw new Error('API 토큰이 설정되지 않았습니다')
      }

      // Band API 호출하여 게시물 가져오기
      const bandPosts = await fetchBandPosts(
        apiConfig.accessToken,
        channel.channelKey,
        config.limit || 20
      )

      channelResult.fetched = bandPosts.length

      // 배치 중복 체크 (개별 쿼리 대신 한 번에 조회)
      const externalIds = bandPosts.map((p: any) => p.post_key)
      const existingPosts = await prisma.collectedPost.findMany({
        where: {
          channelId: channel.id,
          externalId: { in: externalIds },
        },
        select: { externalId: true },
      })
      const existingSet = new Set(existingPosts.map((p) => p.externalId))

      // 새 게시물만 필터링
      const newBandPosts = bandPosts.filter((p: any) => !existingSet.has(p.post_key))
      channelResult.duplicates = bandPosts.length - newBandPosts.length

      // 새 게시물 일괄 저장 (이미지 제외)
      if (newBandPosts.length > 0) {
        try {
          // createMany로 일괄 생성 (이미지는 별도 처리)
          await prisma.collectedPost.createMany({
            data: newBandPosts.map((post: any) => ({
              userId,
              channelId: channel.id,
              externalId: post.post_key,
              title: extractTitle(post.content),
              content: post.content,
              author: post.author?.name || null,
            })),
            skipDuplicates: true,
          })

          // 생성된 게시물 조회하여 이미지 추가
          const createdPosts = await prisma.collectedPost.findMany({
            where: {
              channelId: channel.id,
              externalId: { in: newBandPosts.map((p: any) => p.post_key) },
            },
            select: { id: true, externalId: true },
          })

          const postIdMap = new Map(createdPosts.map((p) => [p.externalId, p.id]))

          // 이미지 일괄 생성
          const imageData: { postId: number; url: string; sortOrder: number }[] = []
          for (const post of newBandPosts) {
            const postId = postIdMap.get(post.post_key)
            if (postId && post.photos?.length) {
              for (let i = 0; i < post.photos.length; i++) {
                imageData.push({
                  postId,
                  url: post.photos[i].url,
                  sortOrder: i,
                })
              }
            }
          }

          if (imageData.length > 0) {
            await prisma.collectedPostImage.createMany({
              data: imageData,
              skipDuplicates: true,
            })
          }

          channelResult.newPosts = newBandPosts.length
        } catch (batchError: any) {
          // 배치 저장 실패 시 개별 저장으로 폴백
          console.log(`[Collection] Batch save failed, falling back to individual saves: ${batchError.message}`)
          for (const post of newBandPosts) {
            try {
              await prisma.collectedPost.create({
                data: {
                  userId,
                  channelId: channel.id,
                  externalId: post.post_key,
                  title: extractTitle(post.content),
                  content: post.content,
                  author: post.author?.name || null,
                  images: {
                    create: (post.photos || []).map((photo: any, index: number) => ({
                      url: photo.url,
                      sortOrder: index,
                    })),
                  },
                },
              })
              channelResult.newPosts++
            } catch (postError: any) {
              channelResult.failed++
              const errorMsg = truncateErrorMessage(postError.message, 200)
              channelResult.errors.push(errorMsg)
            }
          }
        }
      }

      totalNewPosts += channelResult.newPosts
      totalDuplicates += channelResult.duplicates

      console.log(
        `[Collection] ${channel.name}: ${channelResult.newPosts} new, ${channelResult.duplicates} duplicates`
      )

      successChannels++
    } catch (channelError: any) {
      console.error(`[Collection] Error collecting from ${channel.name}:`, channelError)
      // 에러 메시지 길이 제한
      const errorMsg = truncateErrorMessage(channelError.message, 200)
      errors.push({
        itemId: channel.id,
        message: errorMsg,
        timestamp: new Date(),
      })
      channelResult.errors.push(errorMsg)
      failedChannels++
    }

    channelResults.push(channelResult)
    processedChannels++

    // 진행 상황 및 details 실시간 업데이트
    if (workflowLogId) {
      await updateWorkflowProgress(workflowLogId, wholesaleChannels.length, successChannels, failedChannels, {
        collection: {
          channelResults,
          totalNewPosts,
          totalDuplicates,
          errors: errors.slice(-5),
        },
      })
    }
  }

  const totalItems = channelResults.reduce((sum, r) => sum + r.fetched, 0)
  const successCount = totalNewPosts
  const failedCount = channelResults.reduce((sum, r) => sum + r.failed, 0)

  return {
    success: errors.length === 0,
    totalItems,
    successCount,
    failedCount,
    details: {
      channelResults,
      totalNewPosts,
      totalDuplicates,
    },
    errors,
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Band API에서 게시물 가져오기
 * Note: v2 API 사용 (v2.1이 아님) - /api/post/available과 동일한 방식
 */
async function fetchBandPosts(
  accessToken: string,
  bandKey: string,
  limit: number
): Promise<any[]> {
  // v2 API 사용 (게시물 추가 기능과 동일)
  const url = new URL('https://openapi.band.us/v2/band/posts')
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('band_key', bandKey)
  url.searchParams.set('locale', 'ko_KR')

  console.log(`[Collection] Fetching from Band API v2: bandKey=${bandKey}`)

  const response = await fetch(url.toString())

  if (!response.ok) {
    console.error(`[Collection] Band API HTTP error: ${response.status} ${response.statusText}`)
    throw new Error(`Band API error: ${response.status}`)
  }

  const data = await response.json()
  console.log(`[Collection] Band API response: result_code=${data.result_code}, items=${data.result_data?.items?.length || 0}`)

  if (data.result_code !== 1) {
    console.error(`[Collection] Band API error response:`, JSON.stringify(data, null, 2))
    throw new Error(`Band API error: ${data.result_data?.message || 'Unknown error'} (code: ${data.result_code})`)
  }

  const items = data.result_data?.items || []
  console.log(`[Collection] Fetched ${items.length} posts from Band API`)

  // limit이 적용된 경우 최근 N개만 반환 (Band API는 최신순 정렬)
  const limitedItems = limit > 0 ? items.slice(0, limit) : items
  console.log(`[Collection] Returning ${limitedItems.length} posts (limit: ${limit})`)

  return limitedItems
}

/**
 * 게시물 내용에서 제목 추출
 */
function extractTitle(content: string): string {
  if (!content) return '제목 없음'

  // 첫 줄 또는 첫 100자를 제목으로 사용
  const firstLine = content.split('\n')[0]
  if (firstLine.length <= 100) {
    return firstLine.trim() || '제목 없음'
  }
  return firstLine.substring(0, 100).trim() + '...'
}

/**
 * 에러 메시지를 지정된 길이로 자르기
 * Prisma 에러 등 너무 긴 메시지를 방지
 */
function truncateErrorMessage(message: string, maxLength: number = 200): string {
  if (!message) return '알 수 없는 오류'
  if (message.length <= maxLength) return message
  return message.substring(0, maxLength) + '...(truncated)'
}
