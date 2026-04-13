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
    const includeExisting = searchParams.get('includeExisting') === 'true' // 기존 소싱분 포함 여부
    const channelIdsParam = searchParams.get('channelIds') // 특정 채널만 조회 (쉼표 구분)
    const days = daysParam ? parseInt(daysParam) : (todayOnly ? 1 : 0)

    // 현재 BAND만 지원
    if (platform !== ChannelPlatform.BAND) {
      return NextResponse.json({
        success: true,
        data: [],
        message: `${platform} 플랫폼은 아직 지원되지 않습니다.`,
      })
    }

    // 사용자의 도매채널 조회 (해당 플랫폼만, 특정 채널 필터 가능)
    const channelFilter: any = {
      userId: userId,
      isActive: true,
      kind: ChannelKind.WHOLESALE,
      platform: platform,
    }
    if (channelIdsParam) {
      const channelIds = channelIdsParam.split(',').map(Number).filter(Boolean)
      if (channelIds.length > 0) {
        channelFilter.id = { in: channelIds }
      }
    }
    const wholesaleChannels = await prisma.channel.findMany({
      where: channelFilter,
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

    // 모든 도매채널에서 게시물 조회 (페이지네이션으로 전체 가져오기)
    const allPosts: any[] = []
    const MAX_PAGES = 20 // 무한루프 방지 (최대 20페이지 × 100개 = 2000개)

    for (const channel of wholesaleChannels) {
      try {
        const bandApiUrl = `https://openapi.band.us/v2/band/posts`
        let afterParam = ''
        let pageCount = 0

        // 페이지네이션 루프: after 커서로 다음 페이지 조회
        while (pageCount < MAX_PAGES) {
          const params = new URLSearchParams({
            access_token: accessToken,
            band_key: channel.channelKey,
            locale: 'ko_KR',
            limit: '100',
          })
          if (afterParam) params.set('after', afterParam)

          const response = await fetch(`${bandApiUrl}?${params}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })

          if (!response.ok) {
            console.error(`Band API 오류 (${channel.name}):`, await response.text())
            break
          }

          const data = await response.json()

          if (!data.result_data?.items?.length) break

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
          pageCount++

          // 다음 페이지가 있는지 확인
          const paging = data.result_data.paging
          if (paging?.next_params?.after) {
            afterParam = paging.next_params.after
          } else {
            break // 더 이상 페이지 없음
          }
        }

        console.log(`[Post Available] ${channel.name}: ${pageCount}페이지, 총 ${allPosts.length}개 조회`)
      } catch (error) {
        console.error(`채널 ${channel.name}의 게시물 조회 실패:`, error)
      }
    }

    // 이미 등록된 게시물 제외 (includeExisting이면 포함하되 마킹)
    let filteredPosts: any[]
    if (includeExisting) {
      // 기존 소싱분 포함 - isExisting 플래그 추가
      filteredPosts = allPosts.map(post => ({
        ...post,
        isExisting: existingPostKeys.has(post.post_key),
      }))
    } else {
      filteredPosts = allPosts.filter(
        (post) => !existingPostKeys.has(post.post_key)
      )
    }

    const totalAvailable = filteredPosts.length

    // 날짜+시간 범위 필터링 (startDate/endDate 우선, 없으면 days)
    if (startDateParam || endDateParam) {
      // 클라이언트가 "2026-04-10T00:00" (KST) 형식으로 보냄
      // new Date()가 로컬 타임존(KST)으로 파싱하므로 그대로 getTime()으로 UTC ms 변환
      const startMs = startDateParam ? new Date(startDateParam).getTime() : 0
      const endMs = endDateParam ? new Date(endDateParam).getTime() : Number.MAX_SAFE_INTEGER

      filteredPosts = filteredPosts.filter((post) => {
        if (!post.created_at) return false
        const postTime = post.created_at
        // Band API created_at: 초 또는 밀리초 단위 UTC timestamp
        const postTimeMs = postTime > 9999999999999 ? postTime : (postTime > 9999999999 ? postTime : postTime * 1000)
        return postTimeMs >= startMs && postTimeMs <= endMs
      })

      console.log(`[Post Available] 전체: ${totalAvailable}개, 범위 필터: ${filteredPosts.length}개 (${startDateParam ?? '없음'} ~ ${endDateParam ?? '없음'}, startMs=${startMs}, endMs=${endMs})`)
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
