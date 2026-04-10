export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 도매채널에서 수집 가능한 게시물 목록 조회 (오늘 날짜만 - KST 기준)
export async function GET(request: NextRequest) {
  try {
    // 세션에서 userId 가져오기
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    // 플랫폼 파라미터 가져오기 (기본값: BAND)
    const searchParams = request.nextUrl.searchParams
    const platformParam = searchParams.get('platform') as ChannelPlatform | null
    const platform = platformParam || ChannelPlatform.BAND
    const todayOnly = searchParams.get('todayOnly') === 'true'
    const daysParam = searchParams.get('days')
    const searchQuery = searchParams.get('search') || ''
    const startDateParam = searchParams.get('startDate') // ISO 형식 (예: 2026-04-10T00:00:00)
    const endDateParam = searchParams.get('endDate')
    const days = daysParam ? parseInt(daysParam) : (todayOnly ? 1 : 0)

    // 현재 BAND만 지원
    if (platform !== ChannelPlatform.BAND) {
      return NextResponse.json({
        success: true,
        data: [],
        message: `${platform} 플랫폼은 아직 지원되지 않습니다.`,
      })
    }

    // 사용자의 도매채널 조회 (해당 플랫폼만)
    const wholesaleChannels = await prisma.channel.findMany({
      where: {
        userId: userId,
        isActive: true,
        kind: ChannelKind.WHOLESALE,
        platform: platform,
      },
    })

    if (wholesaleChannels.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: '등록된 도매채널이 없습니다.',
      })
    }

    // 사용자의 API 설정 조회 (플랫폼 맵핑: BAND -> BAND)
    const apiPlatform = platform === ChannelPlatform.BAND ? 'BAND' : 'ALIEXPRESS'
    const apiConfig = await prisma.sourcingApiConfig.findFirst({
      where: {
        userId: userId,
        platform: apiPlatform,
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        accessToken: true,
        isActive: true,
      },
    })

    if (!apiConfig || !apiConfig.accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Band API 설정을 찾을 수 없습니다. 환경 설정에서 API를 먼저 설정해주세요.',
        },
        { status: 400 }
      )
    }

    const accessToken = apiConfig.accessToken

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Band API Access Token이 설정되지 않았습니다.',
        },
        { status: 400 }
      )
    }

    // 사용자가 이미 등록한 게시물의 externalId 목록 조회
    const existingPosts = await prisma.collectedPost.findMany({
      where: {
        userId: userId,
      },
      select: {
        externalId: true,
      },
    })
    const existingPostKeys = new Set(existingPosts.map((post) => post.externalId))

    // 모든 도매채널에서 게시물 조회
    const allPosts: any[] = []

    for (const channel of wholesaleChannels) {
      try {
        // Band API 호출
        const bandApiUrl = `https://openapi.band.us/v2/band/posts`
        const apiUrl = `${bandApiUrl}?access_token=${accessToken}&band_key=${channel.channelKey}&locale=ko_KR&limit=100`

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          console.error(`Band API 오류 (${channel.name}):`, await response.text())
          continue
        }

        const data = await response.json()

        if (data.result_data && data.result_data.items) {
          // 게시물 데이터 변환 (채널 정보 포함)
          const posts = data.result_data.items.map((item: any) => ({
            post_key: item.post_key,
            title: item.content ? item.content.substring(0, 100) : '(제목 없음)',
            content: item.content || '',
            author: item.author?.name || '알 수 없음',
            created_at: item.created_at || null,
            images: item.photos ? item.photos.map((photo: any) => photo.url) : [],
            comments: [],
            channel: {
              id: channel.id,
              name: channel.name,
              channelKey: channel.channelKey,
              coverUrl: channel.coverUrl,
            },
          }))

          allPosts.push(...posts)
        }
      } catch (error) {
        console.error(`채널 ${channel.name}의 게시물 조회 실패:`, error)
      }
    }

    // 이미 등록된 게시물 제외
    let filteredPosts = allPosts.filter(
      (post) => !existingPostKeys.has(post.post_key)
    )

    const totalAvailable = filteredPosts.length

    // 날짜+시간 범위 필터링 (startDate/endDate 우선, 없으면 days)
    if (startDateParam || endDateParam) {
      // KST 기준 ISO 문자열을 UTC ms로 변환
      // 클라이언트가 "2026-04-10T00:00" 형식으로 보내면 KST 시간으로 해석
      const kstOffset = 9 * 60 * 60 * 1000
      const startMs = startDateParam ? new Date(startDateParam).getTime() - kstOffset : 0
      const endMs = endDateParam ? new Date(endDateParam).getTime() - kstOffset : Number.MAX_SAFE_INTEGER

      filteredPosts = filteredPosts.filter((post) => {
        if (!post.created_at) return false
        const postTime = post.created_at
        const postTimeMs = postTime > 9999999999999 ? postTime : (postTime > 9999999999 ? postTime : postTime * 1000)
        return postTimeMs >= startMs && postTimeMs <= endMs
      })

      console.log(`[Post Available] 전체: ${totalAvailable}개, 범위 필터: ${filteredPosts.length}개 (${startDateParam ?? '제한없음'} ~ ${endDateParam ?? '제한없음'})`)
    } else if (days > 0) {
      const kstOffset = 9 * 60 * 60 * 1000
      const now = new Date()
      const kstNow = new Date(now.getTime() + kstOffset)

      // KST 기준 N일 전 00:00:00
      const startDate = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - (days - 1)) - kstOffset)
      const startMs = startDate.getTime()

      filteredPosts = filteredPosts.filter((post) => {
        if (!post.created_at) return false
        const postTime = post.created_at
        const postTimeMs = postTime > 9999999999999 ? postTime : (postTime > 9999999999 ? postTime : postTime * 1000)
        return postTimeMs >= startMs
      })

      console.log(`[Post Available] 전체: ${totalAvailable}개, 최근 ${days}일: ${filteredPosts.length}개`)
    }

    // 키워드 필터링
    if (searchQuery) {
      const keyword = searchQuery.toLowerCase()
      filteredPosts = filteredPosts.filter((post) =>
        post.title.toLowerCase().includes(keyword) ||
        post.content.toLowerCase().includes(keyword)
      )
      console.log(`[Post Available] 키워드 "${searchQuery}" 필터 후: ${filteredPosts.length}개`)
    }

    return NextResponse.json({
      success: true,
      data: filteredPosts,
      todayOnly,
      totalAvailable, // 오늘 필터 전 전체 개수
      todayCount: filteredPosts.length, // 오늘 게시물 개수
    })
  } catch (error) {
    console.error('게시물 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '게시물 목록을 불러오는데 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
