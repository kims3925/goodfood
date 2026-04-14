export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { postService } from '@/modules/sourcing/domain/src/post'

/**
 * Band API 목록에서 특정 post_key에 해당하는 게시물 검색
 * /v2/band/posts를 페이지네이션하며 찾음
 */
interface SearchDebugInfo {
  bandKey: string
  totalSearched: number
  pagesSearched: number
  samplePostKeys: string[]
  apiError?: string
}

async function findPostByKey(accessToken: string, bandKey: string, targetPostKey: string): Promise<{ post: any; debug: SearchDebugInfo } | null> {
  const MAX_PAGES = 30
  let afterParam = ''
  let totalSearched = 0
  let samplePostKeys: string[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      access_token: accessToken,
      band_key: bandKey,
      locale: 'ko_KR',
      limit: '100',
    })
    if (afterParam) params.set('after', afterParam)

    const response = await fetch(`https://openapi.band.us/v2/band/posts?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return { post: null, debug: { bandKey, totalSearched, pagesSearched: page, samplePostKeys, apiError: `HTTP ${response.status}` } } as any
    }

    const data = await response.json()
    if (data.result_code !== 1) {
      return { post: null, debug: { bandKey, totalSearched, pagesSearched: page, samplePostKeys, apiError: `result_code=${data.result_code}: ${data.message || ''}` } } as any
    }

    const items = data.result_data?.items
    if (!items?.length) break

    totalSearched += items.length

    // 첫 페이지에서 post_key 샘플 저장
    if (page === 0) {
      samplePostKeys = items.slice(0, 5).map((item: any) => String(item.post_key))
    }

    // post_key를 문자열로 비교
    const found = items.find((item: any) => String(item.post_key) === targetPostKey)
    if (found) {
      return { post: found, debug: { bandKey, totalSearched, pagesSearched: page + 1, samplePostKeys } }
    }

    // 다음 페이지
    const paging = data.result_data.paging
    if (paging?.next_params?.after) {
      afterParam = paging.next_params.after
    } else {
      break
    }
  }

  return { post: null, debug: { bandKey, totalSearched, pagesSearched: Math.min(MAX_PAGES, totalSearched > 0 ? Math.ceil(totalSearched / 100) : 0), samplePostKeys } } as any
}

/**
 * POST: Band URL로 단일 게시물 수집
 * Body: { url: string, channelId: number }
 * URL 형식: https://band.us/band/{bandNumber}/post/{postKey}
 *
 * 1) 선택한 채널의 channelKey로 검색
 * 2) 실패 시 URL의 밴드 번호를 band_key로 검색
 * 3) 실패 시 사용자의 모든 도매채널에서 검색
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const body = await request.json()
    const { url, channelId } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: '도매밴드를 선택해주세요.' },
        { status: 400 }
      )
    }

    // URL 파싱
    const urlMatch = url.match(/band\.us\/band\/(\d+)\/post\/(\w+)/)
    if (!urlMatch) {
      return NextResponse.json(
        { success: false, error: '올바른 밴드 게시물 URL 형식이 아닙니다. (예: https://band.us/band/12345/post/67890)' },
        { status: 400 }
      )
    }

    const bandNumber = urlMatch[1]
    const postKey = urlMatch[2]

    // 선택된 채널 조회
    const selectedChannel = await prisma.channel.findFirst({
      where: {
        id: Number(channelId),
        userId,
        isActive: true,
        kind: ChannelKind.WHOLESALE,
        platform: ChannelPlatform.BAND,
      },
    })

    if (!selectedChannel) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 도매채널입니다.' },
        { status: 400 }
      )
    }

    // Band API 설정 조회
    const apiConfig = await prisma.sourcingApiConfig.findFirst({
      where: {
        userId,
        platform: 'BAND',
        isActive: true,
      },
      select: {
        accessToken: true,
      },
    })

    if (!apiConfig?.accessToken) {
      return NextResponse.json(
        { success: false, error: 'Band API 설정을 찾을 수 없습니다. 환경 설정에서 API를 먼저 설정해주세요.' },
        { status: 400 }
      )
    }

    const accessToken = apiConfig.accessToken
    let fetchedPost: any = null
    let matchedChannel = selectedChannel
    const debugInfo: any[] = []

    // 1단계: 선택한 채널의 channelKey로 검색
    const result1 = await findPostByKey(accessToken, selectedChannel.channelKey, postKey)
    debugInfo.push({ step: 1, channel: selectedChannel.name, ...result1?.debug })
    if (result1?.post) {
      fetchedPost = result1.post
    }

    // 2단계: 실패 시 URL의 밴드 번호를 band_key로 직접 시도
    if (!fetchedPost && selectedChannel.channelKey !== bandNumber) {
      const result2 = await findPostByKey(accessToken, bandNumber, postKey)
      debugInfo.push({ step: 2, channel: `URL밴드(${bandNumber})`, ...result2?.debug })
      if (result2?.post) {
        fetchedPost = result2.post
        const existingChannel = await prisma.channel.findFirst({
          where: { userId, channelKey: bandNumber, isActive: true },
        })
        matchedChannel = existingChannel || selectedChannel
      }
    }

    // 3단계: 실패 시 사용자의 다른 모든 도매채널에서 검색
    if (!fetchedPost) {
      const otherChannels = await prisma.channel.findMany({
        where: {
          userId,
          isActive: true,
          kind: ChannelKind.WHOLESALE,
          platform: ChannelPlatform.BAND,
          id: { not: selectedChannel.id },
          channelKey: { not: bandNumber },
        },
      })

      for (const ch of otherChannels) {
        const result3 = await findPostByKey(accessToken, ch.channelKey, postKey)
        debugInfo.push({ step: 3, channel: ch.name, ...result3?.debug })
        if (result3?.post) {
          fetchedPost = result3.post
          matchedChannel = ch
          break
        }
      }
    }

    if (!fetchedPost) {
      const debugSummary = debugInfo.map((d: any) =>
        `[${d.step}단계] ${d.channel}: ${d.totalSearched}개 검색, 샘플키=[${(d.samplePostKeys || []).join(', ')}]${d.apiError ? ' 에러:' + d.apiError : ''}`
      ).join(' | ')
      return NextResponse.json(
        {
          success: false,
          error: `게시물(${postKey})을 찾을 수 없습니다. ${debugSummary}`,
        },
        { status: 404 }
      )
    }

    // 게시물 생성
    const title = fetchedPost.content
      ? fetchedPost.content.substring(0, 100)
      : '(제목 없음)'
    const content = fetchedPost.content || ''
    const author = fetchedPost.author?.name || '알 수 없음'
    const images = fetchedPost.photos
      ? fetchedPost.photos.map((photo: any) => photo.url)
      : []

    try {
      await postService.create({
        userId,
        channelId: matchedChannel.id,
        externalId: String(fetchedPost.post_key || postKey),
        title,
        content,
        author,
        images,
      })
    } catch (error: any) {
      if (error.message === '이미 등록된 게시물입니다.') {
        return NextResponse.json(
          { success: false, error: '이미 수집된 게시물입니다.' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `게시물이 수집되었습니다. (채널: ${matchedChannel.name})`,
    })
  } catch (error) {
    console.error('[Post Collect URL] 오류:', error)
    return NextResponse.json(
      { success: false, error: '게시물 수집 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
