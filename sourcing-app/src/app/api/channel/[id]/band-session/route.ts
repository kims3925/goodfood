/**
 * Band 수동 세션 관리 API
 * 2FA가 설정된 계정을 위한 수동 로그인 지원
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { manualLoginService } from '@/modules/band-playwright/band-manual-login.service'

// CORS 헤더 (Chrome Extension에서 접근 허용)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * OPTIONS: CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/**
 * GET: 세션 상태 조회
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json({ success: false, error: '잘못된 채널 ID입니다.' }, { status: 400 })
  }

  try {
    // URL에서 sessionId 확인 (진행 중인 로그인 상태 확인용)
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      // 진행 중인 로그인 세션 상태 확인
      const status = manualLoginService.getSessionStatus(sessionId)
      return NextResponse.json({ success: true, data: status })
    }

    // 채널의 저장된 세션 상태 확인
    const sessionStatus = await manualLoginService.getChannelSessionStatus(channelId)
    return NextResponse.json({ success: true, data: sessionStatus })
  } catch (error: any) {
    console.error('세션 상태 조회 실패:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * POST: 수동 로그인 시작
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json({ success: false, error: '잘못된 채널 ID입니다.' }, { status: 400 })
  }

  try {
    const result = await manualLoginService.startManualLogin(channelId)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: result.sessionId,
        message: '브라우저가 열렸습니다. Band에 로그인해주세요.',
      },
    })
  } catch (error: any) {
    console.error('수동 로그인 시작 실패:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * PUT: 쿠키 직접 저장 (서버 환경용, CORS 허용)
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json({ success: false, error: '잘못된 채널 ID입니다.' }, { status: 400, headers: corsHeaders })
  }

  try {
    const body = await request.json()
    const { cookieString } = body

    if (!cookieString || typeof cookieString !== 'string') {
      return NextResponse.json({ success: false, error: '쿠키 문자열이 필요합니다.' }, { status: 400, headers: corsHeaders })
    }

    const result = await manualLoginService.saveSessionCookieDirect(channelId, cookieString)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400, headers: corsHeaders })
    }

    return NextResponse.json({
      success: true,
      message: '세션 쿠키가 저장되었습니다.',
    }, { headers: corsHeaders })
  } catch (error: any) {
    console.error('쿠키 직접 저장 실패:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders })
  }
}

/**
 * DELETE: 세션 삭제
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json(
      { success: false, error: '잘못된 채널 ID입니다.' },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    // URL에서 sessionId 확인 (진행 중인 로그인 취소용)
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      // 진행 중인 로그인 취소
      await manualLoginService.cancelSession(sessionId)
      return NextResponse.json(
        { success: true, message: '로그인이 취소되었습니다.' },
        { headers: corsHeaders }
      )
    }

    // 저장된 세션 삭제
    await manualLoginService.deleteSession(channelId)
    return NextResponse.json(
      { success: true, message: '세션이 삭제되었습니다.' },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('세션 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * PUT: Chrome Extension에서 쿠키 직접 저장
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const channelId = parseInt(params.id, 10)

  if (isNaN(channelId)) {
    return NextResponse.json(
      { success: false, error: '잘못된 채널 ID입니다.' },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    const body = await request.json()
    const { cookieString } = body

    if (!cookieString) {
      return NextResponse.json(
        { success: false, error: '쿠키 데이터가 없습니다.' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 채널 존재 확인
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없습니다.' },
        { status: 404, headers: corsHeaders }
      )
    }

    // 쿠키 저장 (14일 만료)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 14)

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        bandSessionCookie: cookieString,
        sessionExpiresAt: expiresAt,
      },
    })

    console.log(`[BandSession] 세션 저장 완료: channelId=${channelId}, name=${channel.name}`)

    return NextResponse.json(
      {
        success: true,
        message: '세션이 저장되었습니다.',
        data: {
          channelId,
          channelName: channel.name,
          expiresAt: expiresAt.toISOString(),
        },
      },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('세션 저장 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}
