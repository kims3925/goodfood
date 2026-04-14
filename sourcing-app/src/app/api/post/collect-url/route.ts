export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { postService } from '@/modules/sourcing/domain/src/post'

/**
 * Band API로 단일 게시물 조회
 */
async function fetchBandPost(accessToken: string, bandKey: string, postKey: string) {
  const apiUrl = new URL('https://openapi.band.us/v2/band/post')
  apiUrl.searchParams.set('access_token', accessToken)
  apiUrl.searchParams.set('band_key', bandKey)
  apiUrl.searchParams.set('post_key', postKey)

  const response = await fetch(apiUrl.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) return null

  const data = await response.json()
  if (data.result_code === 1 && data.result_data?.post) {
    return data.result_data.post
  }
  return null
}

/**
 * Band API로 밴드 정보 조회하여 이름 가져오기
 */
async function fetchBandName(accessToken: string, bandKey: string): Promise<string> {
  try {
    const apiUrl = new URL('https://openapi.band.us/v2.1/bands')
    apiUrl.searchParams.set('access_token', accessToken)

    const response = await fetch(apiUrl.toString())
    if (!response.ok) return `밴드 ${bandKey}`

    const data = await response.json()
    if (data.result_code === 1 && data.result_data?.bands) {
      const band = data.result_data.bands.find((b: any) => b.band_key === bandKey)
      if (band) return band.name
    }
  } catch {
    // 이름 조회 실패 시 기본값 사용
  }
  return `밴드 ${bandKey}`
}

/**
 * POST: Band URL로 단일 게시물 수집
 * Body: { url: string }
 * URL 형식: https://band.us/band/{bandNumber}/post/{postKey}
 *
 * 1) 등록된 도매채널에서 먼저 검색
 * 2) 없으면 URL의 밴드 번호를 band_key로 직접 API 호출
 * 3) 해당 밴드가 채널로 미등록이면 자동으로 도매채널 등록
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
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL을 입력해주세요.' },
        { status: 400 }
      )
    }

    // URL 파싱: https://band.us/band/{bandNumber}/post/{postKey}
    const urlMatch = url.match(/band\.us\/band\/(\d+)\/post\/(\w+)/)
    if (!urlMatch) {
      return NextResponse.json(
        { success: false, error: '올바른 밴드 게시물 URL 형식이 아닙니다. (예: https://band.us/band/12345/post/67890)' },
        { status: 400 }
      )
    }

    const bandNumber = urlMatch[1]
    const postKey = urlMatch[2]

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

    // 사용자의 도매채널 조회
    const wholesaleChannels = await prisma.channel.findMany({
      where: {
        userId,
        isActive: true,
        kind: ChannelKind.WHOLESALE,
        platform: ChannelPlatform.BAND,
      },
    })

    let fetchedPost: any = null
    let matchedChannel: typeof wholesaleChannels[0] | null = null

    // 1단계: 등록된 도매채널에서 검색
    // channelKey가 bandNumber와 일치하는 채널 우선
    const sortedChannels = [...wholesaleChannels].sort((a, b) => {
      if (a.channelKey === bandNumber) return -1
      if (b.channelKey === bandNumber) return 1
      return 0
    })

    for (const channel of sortedChannels) {
      const post = await fetchBandPost(accessToken, channel.channelKey, postKey)
      if (post) {
        fetchedPost = post
        matchedChannel = channel
        break
      }
    }

    // 2단계: 등록된 채널에서 못 찾으면, URL의 밴드 번호를 직접 band_key로 사용
    if (!fetchedPost) {
      const alreadyTried = wholesaleChannels.some(ch => ch.channelKey === bandNumber)
      if (!alreadyTried) {
        fetchedPost = await fetchBandPost(accessToken, bandNumber, postKey)
      }

      if (fetchedPost) {
        // 해당 밴드에 대한 도매채널 자동 등록
        const bandName = await fetchBandName(accessToken, bandNumber)
        matchedChannel = await prisma.channel.upsert({
          where: {
            userId_channelKey: {
              userId,
              channelKey: bandNumber,
            },
          },
          update: {},
          create: {
            userId,
            kind: ChannelKind.WHOLESALE,
            platform: ChannelPlatform.BAND,
            channelKey: bandNumber,
            name: bandName,
            isActive: true,
          },
        })
        console.log(`[Post Collect URL] 도매채널 자동 등록: ${bandName} (${bandNumber})`)
      }
    }

    if (!fetchedPost || !matchedChannel) {
      return NextResponse.json(
        { success: false, error: '게시물을 찾을 수 없습니다. Band API 접근 권한이 있는 밴드의 게시물인지 확인해주세요.' },
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
        externalId: fetchedPost.post_key || postKey,
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
      message: '게시물이 수집되었습니다.',
    })
  } catch (error) {
    console.error('[Post Collect URL] 오류:', error)
    return NextResponse.json(
      { success: false, error: '게시물 수집 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
