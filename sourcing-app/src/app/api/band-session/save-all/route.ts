export const dynamic = 'force-dynamic'

/**
 * Band 세션 일괄 저장 API
 * Chrome Extension에서 모든 소매 채널에 세션을 저장합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { verifyToken } from '@/modules/auth/auth.service'

// CORS 헤더 (Chrome Extension에서 접근 허용)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/**
 * OPTIONS: CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/**
 * POST: 모든 소매 채널에 세션 저장
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '인증 토큰이 없습니다.' },
        { status: 401, headers: corsHeaders }
      )
    }

    const token = authHeader.substring(7) // 'Bearer ' 제거
    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다.' },
        { status: 401, headers: corsHeaders }
      )
    }

    // 요청 본문에서 쿠키 데이터 추출
    const body = await request.json()
    const { cookieString } = body

    if (!cookieString) {
      return NextResponse.json(
        { success: false, error: '쿠키 데이터가 없습니다.' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 사용자의 모든 소매 채널 조회
    const retailChannels = await prisma.channel.findMany({
      where: {
        userId: payload.userId,
        kind: 'RETAIL',
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (retailChannels.length === 0) {
      return NextResponse.json(
        { success: false, error: '등록된 소매 채널이 없습니다.' },
        { status: 404, headers: corsHeaders }
      )
    }

    // band_session 쿠키의 실제 만료일 사용 (세션 쿠키면 null)
    const cookies: Array<{ name: string; expires: number }> = JSON.parse(cookieString)
    const bandSessionCookie = cookies.find(c => c.name === 'band_session')
    const expiresAt = bandSessionCookie && bandSessionCookie.expires > 0
      ? new Date(bandSessionCookie.expires * 1000)
      : null


    // 모든 소매 채널에 세션 저장
    const updateResult = await prisma.channel.updateMany({
      where: {
        userId: payload.userId,
        kind: 'RETAIL',
      },
      data: {
        bandSessionCookie: cookieString,
        sessionExpiresAt: expiresAt,
      },
    })

    console.log(`[BandSession] 일괄 세션 저장 완료: userId=${payload.userId}, channelCount=${updateResult.count}`)

    return NextResponse.json(
      {
        success: true,
        message: '모든 소매 채널에 세션이 저장되었습니다.',
        data: {
          channelCount: updateResult.count,
          channels: retailChannels.map(c => ({ id: c.id, name: c.name })),
          expiresAt: expiresAt.toISOString(),
        },
      },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('[BandSession] 일괄 세션 저장 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message || '세션 저장에 실패했습니다.' },
      { status: 500, headers: corsHeaders }
    )
  }
}
