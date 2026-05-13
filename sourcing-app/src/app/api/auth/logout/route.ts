export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAMES } from '@/modules/auth/auth.service'

// POST: 로그아웃
// admin/manager/legacy 세 쿠키를 모두 삭제하여 어느 세션을 누가 호출하더라도
// 잔여 토큰이 남아 다음 세션을 오염시키는 일이 없도록 한다.
export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: '로그아웃되었습니다.',
    })

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 0,
      path: '/',
    }

    response.cookies.set(AUTH_COOKIE_NAMES.ADMIN, '', cookieOptions)
    response.cookies.set(AUTH_COOKIE_NAMES.MANAGER, '', cookieOptions)
    response.cookies.set(AUTH_COOKIE_NAMES.LEGACY, '', cookieOptions)

    return response
  } catch (error) {
    console.error('로그아웃 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '로그아웃 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
