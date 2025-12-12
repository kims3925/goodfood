/**
 * Playwright 이미지 발행 테스트 API
 * POST /api/test/playwright-publish
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { bandPlaywrightService } from '@/modules/band-playwright'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { channelId, content, imageUrls } = body

    // 유효성 검사
    if (!channelId) {
      return NextResponse.json(
        { success: false, error: '채널 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!content) {
      return NextResponse.json(
        { success: false, error: '게시물 내용이 필요합니다.' },
        { status: 400 }
      )
    }

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: '이미지 URL이 필요합니다.' },
        { status: 400 }
      )
    }

    // 채널 정보 조회
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId: currentUser.userId,
      },
      select: {
        id: true,
        name: true,
        channelKey: true,
        bandSessionCookie: true,
        sessionExpiresAt: true,
      },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 세션 확인
    if (!channel.bandSessionCookie) {
      return NextResponse.json(
        { success: false, error: 'Band 세션이 없습니다. 먼저 Band 세션을 등록해주세요.' },
        { status: 400 }
      )
    }

    // 세션 만료 확인
    if (channel.sessionExpiresAt && new Date(channel.sessionExpiresAt) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Band 세션이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 400 }
      )
    }

    console.log(`[PlaywrightPublishTest] Starting publish to channel: ${channel.name}`)
    console.log(`[PlaywrightPublishTest] Content length: ${content.length}`)
    console.log(`[PlaywrightPublishTest] Image count: ${imageUrls.length}`)

    // Playwright로 발행
    const result = await bandPlaywrightService.publishWithImages({
      channelId: channel.id,
      bandKey: channel.channelKey,
      bandName: channel.name,
      content,
      imageUrls,
    })

    if (result.success) {
      console.log(`[PlaywrightPublishTest] Success! postKey: ${result.postKey}`)
      return NextResponse.json({
        success: true,
        message: '이미지 발행이 완료되었습니다.',
        data: {
          postKey: result.postKey,
          imageCount: result.imageCount,
          channelName: channel.name,
        },
      })
    } else {
      console.error(`[PlaywrightPublishTest] Failed: ${result.error}`)
      return NextResponse.json({
        success: false,
        error: result.error || '발행에 실패했습니다.',
      })
    }
  } catch (error: any) {
    console.error('[PlaywrightPublishTest] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '발행 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/test/playwright-publish
 * 채널 목록 및 세션 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 세션이 있는 채널 목록 조회
    const channels = await prisma.channel.findMany({
      where: {
        userId: currentUser.userId,
        bandSessionCookie: { not: null },
      },
      select: {
        id: true,
        name: true,
        channelKey: true,
        kind: true,
        sessionExpiresAt: true,
      },
      orderBy: { name: 'asc' },
    })

    const formattedChannels = channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      kind: ch.kind,
      hasSession: true,
      sessionExpired: ch.sessionExpiresAt ? new Date(ch.sessionExpiresAt) < new Date() : false,
      expiresAt: ch.sessionExpiresAt,
    }))

    return NextResponse.json({
      success: true,
      data: formattedChannels,
    })
  } catch (error: any) {
    console.error('[PlaywrightPublishTest] GET Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
