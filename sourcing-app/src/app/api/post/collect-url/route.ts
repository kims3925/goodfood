export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { postService } from '@/modules/sourcing/domain/src/post'

/**
 * Band API 목록에서 특정 post_key에 해당하는 게시물 검색
 * /v2/band/posts를 페이지네이션하며 찾음
 */
async function findPostByKey(accessToken: string, bandKey: string, targetPostKey: string) {
  const MAX_PAGES = 30
  let afterParam = ''
  let totalSearched = 0

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
      console.log(`[Post Collect URL] API 응답 실패: status=${response.status}, bandKey=${bandKey}`)
      return null
    }

    const data = await response.json()
    if (data.result_code !== 1) {
      console.log(`[Post Collect URL] API 에러: result_code=${data.result_code}, message=${data.message}`)
      return null
    }

    const items = data.result_data?.items
    if (!items?.length) {
      console.log(`[Post Collect URL] 게시물 없음: bandKey=${bandKey}, page=${page}`)
      return null
    }

    totalSearched += items.length

    // 첫 페이지에서 post_key 샘플 로깅
    if (page === 0) {
      const sampleKeys = items.slice(0, 5).map((item: any) => String(item.post_key))
      console.log(`[Post Collect URL] 검색 중: bandKey=${bandKey}, 찾는키=${targetPostKey}, 샘플post_keys=[${sampleKeys.join(', ')}]`)
    }

    // post_key를 문자열로 비교
    const found = items.find((item: any) => String(item.post_key) === targetPostKey)
    if (found) {
      console.log(`[Post Collect URL] 발견! page=${page}, totalSearched=${totalSearched}`)
      return found
    }

    // 다음 페이지
    const paging = data.result_data.paging
    if (paging?.next_params?.after) {
      afterParam = paging.next_params.after
    } else {
      break
    }
  }

  console.log(`[Post Collect URL] 미발견: bandKey=${bandKey}, postKey=${targetPostKey}, totalSearched=${totalSearched}`)
  return null
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

    // 1단계: 선택한 채널의 channelKey로 검색
    console.log(`[Post Collect URL] 1단계: 선택 채널(${selectedChannel.name}, key=${selectedChannel.channelKey})에서 postKey=${postKey} 검색`)
    fetchedPost = await findPostByKey(accessToken, selectedChannel.channelKey, postKey)

    // 2단계: 실패 시 URL의 밴드 번호를 band_key로 직접 시도
    if (!fetchedPost && selectedChannel.channelKey !== bandNumber) {
      console.log(`[Post Collect URL] 2단계: URL 밴드번호(${bandNumber})를 band_key로 검색`)
      fetchedPost = await findPostByKey(accessToken, bandNumber, postKey)

      if (fetchedPost) {
        // 해당 밴드 번호로 채널을 찾거나 새로 등록
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
        console.log(`[Post Collect URL] 3단계: 다른 채널(${ch.name}, key=${ch.channelKey})에서 검색`)
        fetchedPost = await findPostByKey(accessToken, ch.channelKey, postKey)
        if (fetchedPost) {
          matchedChannel = ch
          break
        }
      }
    }

    if (!fetchedPost) {
      return NextResponse.json(
        {
          success: false,
          error: `게시물(${postKey})을 찾을 수 없습니다. 선택한 채널(${selectedChannel.name}, key=${selectedChannel.channelKey})과 URL의 밴드(${bandNumber})를 모두 검색했습니다. Band API 연동 앱에 해당 밴드가 포함되어 있는지 확인해주세요.`,
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
