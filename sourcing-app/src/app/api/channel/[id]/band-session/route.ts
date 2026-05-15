export const dynamic = 'force-dynamic'

/**
 * Band 세션 관리 API
 * Chrome Extension에서 세션 쿠키 저장/조회/삭제
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

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
    return NextResponse.json(
      { success: false, error: '잘못된 채널 ID입니다.' },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        bandSessionCookie: true,
        sessionExpiresAt: true,
      },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '채널을 찾을 수 없습니다.' },
        { status: 404, headers: corsHeaders }
      )
    }

    const hasSession = !!channel.bandSessionCookie
    const expiresAt = channel.sessionExpiresAt
    // expiresAt이 null이면 만료일 없는 세션 쿠키 → 유효로 처리
    const isValid = hasSession && (!expiresAt || new Date(expiresAt) > new Date())

    return NextResponse.json({
      success: true,
      data: {
        hasSession,
        isValid,
        expiresAt,
      },
    }, { headers: corsHeaders })
  } catch (error: any) {
    console.error('세션 상태 조회 실패:', error)
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
    const { cookieString, sessionExpiresAt: providedExpiresAt } = body

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

    // 만료일 결정 우선순위 (Phase 4):
    //   1) 클라이언트 제공값 (Extension 이 실제 cookie expires 헤더에서 추출)
    //   2) cookieString 안의 band_session 쿠키 expires (epoch seconds)
    //   3) 기본 +14 일 (Band 일반 cycle)
    let expiresAt: Date | null = null
    if (providedExpiresAt) {
      const parsed = new Date(providedExpiresAt)
      if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
        expiresAt = parsed
      }
    }
    if (!expiresAt) {
      try {
        const parsed: Array<{ name: string; expires?: number }> = JSON.parse(cookieString)
        if (Array.isArray(parsed)) {
          const band = parsed.find((c) => c?.name === 'band_session')
          if (band && typeof band.expires === 'number' && band.expires > 0) {
            const fromCookie = new Date(band.expires * 1000)
            if (fromCookie.getTime() > Date.now()) {
              expiresAt = fromCookie
            }
          }
        }
      } catch {
        // cookieString 이 JSON 이 아니면 무시 (옛 raw cookie 문자열 호환)
      }
    }
    if (!expiresAt) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 14)
    }

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
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        bandSessionCookie: null,
        sessionExpiresAt: null,
      },
    })

    console.log(`[BandSession] 세션 삭제 완료: channelId=${channelId}`)

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
