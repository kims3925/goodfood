/**
 * Collection Pipeline
 * 도매밴드에서 게시물 수집
 */

import prisma from '@bandauto/db'
import { getBatchContext } from '../context'
import { updateWorkflowProgress } from '../workflow-service'
import {
  CollectionConfig,
  CollectionResult,
  BandCollectionResult,
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
  const bandResults: BandCollectionResult[] = []
  let totalNewPosts = 0
  let totalDuplicates = 0

  console.log(`[Collection] Starting for user ${userId}`)

  // 수집할 밴드 목록 조회
  const whereClause: any = {
    userId,
    isActive: true,
  }

  if (!config.collectFromAllBands && config.wholesaleBandIds?.length) {
    whereClause.id = { in: config.wholesaleBandIds }
  }

  const wholesaleBands = await prisma.wholesaleBand.findMany({
    where: whereClause,
    include: {
      apiConfig: true,
    },
  })

  if (wholesaleBands.length === 0) {
    console.log('[Collection] No active wholesale bands found')
    return {
      success: true,
      totalItems: 0,
      successCount: 0,
      failedCount: 0,
      details: {
        bandResults: [],
        totalNewPosts: 0,
        totalDuplicates: 0,
      },
      errors: [],
    }
  }

  console.log(`[Collection] Found ${wholesaleBands.length} bands to collect from`)

  // 진행 상황 초기화
  const { workflowLogId } = context
  if (workflowLogId) {
    await updateWorkflowProgress(workflowLogId, wholesaleBands.length, 0, 0)
  }

  let processedBands = 0
  let successBands = 0
  let failedBands = 0

  // 각 밴드에서 게시물 수집
  for (const band of wholesaleBands) {
    const bandResult: BandCollectionResult = {
      bandId: band.id,
      bandName: band.name,
      fetched: 0,
      newPosts: 0,
      duplicates: 0,
      failed: 0,
      errors: [],
    }

    try {
      console.log(`[Collection] Collecting from band: ${band.name}`)

      // Band API 토큰 확인
      if (!band.apiConfig?.accessToken) {
        throw new Error('Band API 토큰이 설정되지 않았습니다')
      }

      // Band API 호출하여 게시물 가져오기
      const bandPosts = await fetchBandPosts(
        band.apiConfig.accessToken,
        band.bandKey,
        config.limit || 20
      )

      bandResult.fetched = bandPosts.length

      // 각 게시물 처리
      for (const post of bandPosts) {
        try {
          // 중복 체크
          const existing = await prisma.post.findUnique({
            where: {
              wholesaleBandId_externalId: {
                wholesaleBandId: band.id,
                externalId: post.post_key,
              },
            },
          })

          if (existing) {
            bandResult.duplicates++
            continue
          }

          // 새 게시물 저장
          // Note: Band API v2는 photos 필드 사용 (v2.1의 photo와 다름)
          await prisma.post.create({
            data: {
              userId,
              wholesaleBandId: band.id,
              externalId: post.post_key,
              title: extractTitle(post.content),
              content: post.content,
              author: post.author?.name || null,
              images: {
                create: (post.photos || []).map((photo: any, index: number) => ({
                  name: `image_${index}`,
                  imageUrl: photo.url,
                  sortOrder: index,
                })),
              },
            },
          })

          bandResult.newPosts++
        } catch (postError: any) {
          bandResult.failed++
          bandResult.errors.push(postError.message)
        }
      }

      totalNewPosts += bandResult.newPosts
      totalDuplicates += bandResult.duplicates

      console.log(
        `[Collection] ${band.name}: ${bandResult.newPosts} new, ${bandResult.duplicates} duplicates`
      )

      successBands++
    } catch (bandError: any) {
      console.error(`[Collection] Error collecting from ${band.name}:`, bandError)
      errors.push({
        itemId: band.id,
        message: bandError.message,
        timestamp: new Date(),
      })
      bandResult.errors.push(bandError.message)
      failedBands++
    }

    bandResults.push(bandResult)
    processedBands++

    // 진행 상황 업데이트
    if (workflowLogId) {
      await updateWorkflowProgress(workflowLogId, wholesaleBands.length, successBands, failedBands)
    }
  }

  const totalItems = bandResults.reduce((sum, r) => sum + r.fetched, 0)
  const successCount = totalNewPosts
  const failedCount = bandResults.reduce((sum, r) => sum + r.failed, 0)

  return {
    success: errors.length === 0,
    totalItems,
    successCount,
    failedCount,
    details: {
      bandResults,
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

  return items
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
