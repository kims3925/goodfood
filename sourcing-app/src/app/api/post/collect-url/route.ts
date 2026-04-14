export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { postService } from '@/modules/sourcing/domain/src/post'

/**
 * Band API로 단일 게시물 조회 (1회 API 호출)
 */
async function fetchSinglePost(accessToken: string, bandKey: string, postKey: string) {
  const apiUrl = new URL('https://openapi.band.us/v2/band/post')
  apiUrl.searchParams.set('access_token', accessToken)
  apiUrl.searchParams.set('band_key', bandKey)
  apiUrl.searchParams.set('post_key', postKey)

  const response = await fetch(apiUrl.toString())
  if (!response.ok) return { post: null, error: `HTTP ${response.status}` }

  const data = await response.json()
  if (data.result_code === 1 && data.result_data?.post) {
    return { post: data.result_data.post, error: null }
  }
  return { post: null, error: `result_code=${data.result_code}` }
}

/**
 * Band API 목록에서 최근 게시물만 검색 (최대 3페이지 = 300개)
 */
async function findPostInList(accessToken: string, bandKey: string, targetPostKey: string) {
  const MAX_PAGES = 3
  let afterParam = ''

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      access_token: accessToken,
      band_key: bandKey,
      locale: 'ko_KR',
      limit: '100',
    })
    if (afterParam) params.set('after', afterParam)

    const response = await fetch(`https://openapi.band.us/v2/band/posts?${params}`)
    if (!response.ok) return null

    const data = await response.json()
    if (data.result_code === 1001) return null // 쿼터 초과 시 즉시 중단
    if (data.result_code !== 1 || !data.result_data?.items?.length) return null

    const found = data.result_data.items.find((item: any) => String(item.post_key) === targetPostKey)
    if (found) return found

    const paging = data.result_data.paging
    if (paging?.next_params?.after) {
      afterParam = paging.next_params.after
    } else {
      break
    }
  }
  return null
}

/**
 * POST: Band URL로 단일 게시물 수집
 * Body: { url: string, channelId: number }
 *
 * 1) 단일 게시물 API로 직접 조회 (1회 호출)
 * 2) 실패 시 최근 게시물 목록에서 검색 (최대 3페이지)
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
    const channel = await prisma.channel.findFirst({
      where: {
        id: Number(channelId),
        userId,
        isActive: true,
        kind: ChannelKind.WHOLESALE,
        platform: ChannelPlatform.BAND,
      },
    })

    if (!channel) {
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
      select: { accessToken: true },
    })

    if (!apiConfig?.accessToken) {
      return NextResponse.json(
        { success: false, error: 'Band API 설정을 찾을 수 없습니다.' },
        { status: 400 }
      )
    }

    const accessToken = apiConfig.accessToken
    let fetchedPost: any = null

    // 1단계: 단일 게시물 API로 직접 조회 (채널의 band_key 사용)
    const result1 = await fetchSinglePost(accessToken, channel.channelKey, postKey)
    if (result1.post) {
      fetchedPost = result1.post
    }

    // 2단계: 실패 시 URL의 밴드 번호로 시도
    if (!fetchedPost && channel.channelKey !== bandNumber) {
      const result2 = await fetchSinglePost(accessToken, bandNumber, postKey)
      if (result2.post) {
        fetchedPost = result2.post
      }
    }

    // 3단계: 단일 조회 실패 시 목록에서 검색 (선택 채널만, 최대 3페이지)
    if (!fetchedPost) {
      fetchedPost = await findPostInList(accessToken, channel.channelKey, postKey)
    }

    if (!fetchedPost) {
      return NextResponse.json(
        {
          success: false,
          error: `게시물(${postKey})을 찾을 수 없습니다. 단일조회(key=${channel.channelKey}) 결과: ${result1.error}. Band API 쿼터가 초과되었을 수 있습니다. 잠시 후 다시 시도해주세요.`,
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
        channelId: channel.id,
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
      message: `게시물이 수집되었습니다. (채널: ${channel.name})`,
    })
  } catch (error) {
    console.error('[Post Collect URL] 오류:', error)
    return NextResponse.json(
      { success: false, error: '게시물 수집 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
