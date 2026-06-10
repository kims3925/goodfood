export const dynamic = 'force-dynamic'

/**
 * 밴드 로그인 계정 설정 API
 * 이 사용자의 발행/삭제 작업에 사용할 밴드 로그인 네이버 ID 를 설정한다.
 * 세션 저장(save-all) 시 이 값과 확장이 보낸 계정이 일치해야 저장이 허용된다.
 *
 * Chrome Extension(팝업)도 GET 으로 호출하므로 Bearer 토큰 인증 + CORS 를 지원한다.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser, verifyToken } from '@/modules/auth/auth.service'

// CORS 헤더 (Chrome Extension에서 접근 허용 — save-all 과 동일 패턴)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Extension-Key',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/** 확장 키 → Bearer 토큰 → 세션 쿠키(웹) 순으로 사용자 식별 */
async function resolveUserId(request: NextRequest): Promise<number | null> {
  const extKey = request.headers.get('X-Extension-Key')
  if (extKey) {
    const keyUser = await prisma.user.findUnique({
      where: { extensionApiKey: extKey },
      select: { id: true },
    })
    return keyUser?.id ?? null
  }
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyToken(authHeader.substring(7))
    return payload?.userId ?? null
  }
  const me = await getCurrentUser()
  return me?.userId ?? null
}

// GET: 현재 사용자의 밴드 로그인 계정 설정 조회
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401, headers: corsHeaders }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { bandLoginEmail: true },
    })
    return NextResponse.json(
      { success: true, data: { bandLoginEmail: user?.bandLoginEmail ?? null } },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('[BandAccount] 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message || '조회 중 오류 발생' },
      { status: 500, headers: corsHeaders }
    )
  }
}

// PUT: 밴드 로그인 계정 설정 저장 (빈 값 = 설정 해제)
export async function PUT(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401, headers: corsHeaders }
      )
    }

    const { bandLoginEmail } = await request.json()
    const email = (bandLoginEmail ?? '').trim().toLowerCase() || null
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: '이메일 형식이 아닙니다.' },
        { status: 400, headers: corsHeaders }
      )
    }

    await prisma.user.update({ where: { id: userId }, data: { bandLoginEmail: email } })
    return NextResponse.json(
      { success: true, data: { bandLoginEmail: email } },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('[BandAccount] 저장 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message || '저장 중 오류 발생' },
      { status: 500, headers: corsHeaders }
    )
  }
}
