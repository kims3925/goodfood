export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET: Band API post_key 형식 확인용 테스트 엔드포인트
 * 쿼터 최소화를 위해 단일 게시물 + 목록 1건만 조회
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
    }

    const bandKey = request.nextUrl.searchParams.get('bandKey') || 'AAAMvZteE5OjyYnjS64rQuH3'
    const postKey = request.nextUrl.searchParams.get('postKey') || '172625'

    const apiConfig = await prisma.sourcingApiConfig.findFirst({
      where: { userId: currentUser.userId, platform: 'BAND', isActive: true },
      select: { accessToken: true },
    })

    if (!apiConfig?.accessToken) {
      return NextResponse.json({ error: 'No token' }, { status: 400 })
    }

    const token = apiConfig.accessToken
    const results: any = {}

    // 1. 단일 게시물 API 테스트
    try {
      const singleUrl = `https://openapi.band.us/v2/band/post?access_token=${token}&band_key=${bandKey}&post_key=${postKey}`
      const singleRes = await fetch(singleUrl)
      const singleData = await singleRes.json()
      results.singlePost = {
        result_code: singleData.result_code,
        hasPost: !!singleData.result_data?.post,
        post_key: singleData.result_data?.post?.post_key ?? null,
        post_key_type: typeof singleData.result_data?.post?.post_key,
      }
    } catch (e: any) {
      results.singlePost = { error: e.message }
    }

    // 2. 게시물 목록 API 테스트 (1페이지, 5개만)
    try {
      const listUrl = `https://openapi.band.us/v2/band/posts?access_token=${token}&band_key=${bandKey}&locale=ko_KR&limit=5`
      const listRes = await fetch(listUrl)
      const listData = await listRes.json()
      results.postsList = {
        result_code: listData.result_code,
        count: listData.result_data?.items?.length ?? 0,
        sampleKeys: (listData.result_data?.items ?? []).slice(0, 5).map((i: any) => ({
          post_key: i.post_key,
          type: typeof i.post_key,
        })),
      }
    } catch (e: any) {
      results.postsList = { error: e.message }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
