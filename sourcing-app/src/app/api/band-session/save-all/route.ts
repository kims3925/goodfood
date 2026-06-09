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
    const { cookieString, sessionExpiresAt: providedExpiresAt, bandAccountEmail } = body

    if (!cookieString) {
      return NextResponse.json(
        { success: false, error: '쿠키 데이터가 없습니다.' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 밴드 로그인 계정 검증 (2026-06-10)
    // User.bandLoginEmail 이 설정된 사용자는 확장에서 보낸 계정과 일치해야 저장 허용.
    // 미설정(null) 이면 검증 생략 — 기존 동작 보존 (하위호환).
    const me = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { bandLoginEmail: true },
    })
    const expected = me?.bandLoginEmail?.toLowerCase() ?? null
    const provided = (bandAccountEmail ?? '').trim().toLowerCase() || null

    if (expected) {
      if (!provided) {
        return NextResponse.json(
          { success: false, error: `이 계정은 밴드 로그인 계정이 [${expected}] 로 설정되어 있습니다. 확장 프로그램에서 현재 밴드 로그인 계정을 확인 후 다시 저장해주세요.` },
          { status: 409, headers: corsHeaders }
        )
      }
      if (provided !== expected) {
        return NextResponse.json(
          { success: false, error: `밴드 로그인 계정 불일치: 설정=[${expected}], 현재 브라우저=[${provided}]. ${expected} 로 band.us 에 로그인한 브라우저에서 저장해주세요.` },
          { status: 409, headers: corsHeaders }
        )
      }
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

    // 만료일 결정 우선순위 (Phase 4):
    //   1) 클라이언트 제공값 (Extension 이 실제 cookie 헤더에서 추출)
    //   2) cookieString 안의 band_session 쿠키 expires (epoch seconds)
    //   3) 기본 +14 일 (Band 일반 cycle — 세션쿠키 only 면 null 대신 사용)
    let expiresAt: Date | null = null
    if (providedExpiresAt) {
      const parsed = new Date(providedExpiresAt)
      if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
        expiresAt = parsed
      }
    }
    if (!expiresAt) {
      try {
        const cookies: Array<{ name: string; expires?: number }> = JSON.parse(cookieString)
        const bandSessionCookie = cookies.find((c) => c?.name === 'band_session')
        if (bandSessionCookie && typeof bandSessionCookie.expires === 'number' && bandSessionCookie.expires > 0) {
          const fromCookie = new Date(bandSessionCookie.expires * 1000)
          if (fromCookie.getTime() > Date.now()) {
            expiresAt = fromCookie
          }
        }
      } catch {
        // 옛 raw cookie 문자열 호환 (JSON 이 아니면 무시)
      }
    }
    if (!expiresAt) {
      // 만료일 정보가 전혀 없으면 (세션 쿠키) Band 일반 cycle 인 14일로 설정.
      // 세션 헬스 워치독이 D-3/D-1 알림을 발생시키는 데 필요.
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 14)
    }

    // 모든 소매 채널에 세션 일괄 업데이트
    const updateResult = await prisma.channel.updateMany({
      where: {
        id: { in: retailChannels.map((ch) => ch.id) },
      },
      data: {
        bandSessionCookie: cookieString,
        sessionExpiresAt: expiresAt,
        // 이 세션이 어느 밴드 계정 것인지 기록 (계정 검증 통과값 또는 설정값)
        sessionAccountEmail: provided ?? expected,
      },
    })

    console.log(
      `[BandSession] 일괄 세션 저장 완료: userId=${payload.userId}, 채널 ${updateResult.count}개, 계정=${provided ?? expected ?? '(미상)'}, 만료=${expiresAt.toISOString()}`
    )

    return NextResponse.json(
      {
        success: true,
        message: `${updateResult.count}개 채널에 세션이 저장되었습니다.`,
        data: {
          updatedCount: updateResult.count,
          channels: retailChannels.map((ch) => ({ id: ch.id, name: ch.name })),
          expiresAt: expiresAt.toISOString(),
        },
      },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('[BandSession] 일괄 세션 저장 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message || '세션 저장 중 오류 발생' },
      { status: 500, headers: corsHeaders }
    )
  }
}
