export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { postService } from '@/modules/sourcing/domain/src/post'

/**
 * POST: Band URL로 단일 게시물 수집
 * Body: { url: string }
 * URL 형식: https://band.us/band/{bandNumber}/post/{postKey}
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

    // 사용자의 도매채널 중 해당 밴드 번호와 일치하는 채널 찾기
    const wholesaleChannels = await prisma.channel.findMany({
      where: {
        userId,
        isActive: true,
        kind: ChannelKind.WHOLESALE,
        platform: ChannelPlatform.BAND,
      },
    })

    if (wholesaleChannels.length === 0) {
      return NextResponse.json(
        { success: false, error: '등록된 도매채널이 없습니다.' },
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

    // channelKey가 bandNumber와 일치하는 채널을 우선 시도, 없으면 전체 채널 순회
    const sortedChannels = wholesaleChannels.sort((a, b) => {
      if (a.channelKey === bandNumber) return -1
      if (b.channelKey === bandNumber) return 1
      return 0
    })

    let fetchedPost: any = null
    let matchedChannel: typeof sortedChannels[0] | null = null

    for (const channel of sortedChannels) {
      try {
        const apiUrl = new URL('https://openapi.band.us/v2/band/post')
        apiUrl.searchParams.set('access_token', accessToken)
        apiUrl.searchParams.set('band_key', channel.channelKey)
        apiUrl.searchParams.set('post_key', postKey)

        const response = await fetch(apiUrl.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) continue

        const data = await response.json()
        if (data.result_code === 1 && data.result_data?.post) {
          fetchedPost = data.result_data.post
          matchedChannel = channel
          break
        }
      } catch {
        continue
      }
    }

    if (!fetchedPost || !matchedChannel) {
      return NextResponse.json(
        { success: false, error: '게시물을 찾을 수 없습니다. 등록된 도매채널에 해당 게시물이 존재하는지 확인해주세요.' },
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
