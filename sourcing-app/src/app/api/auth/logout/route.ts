export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

// POST: 로그아웃
export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: '로그아웃되었습니다.',
    })

    // 쿠키 삭제 (응답 객체에 직접 설정)
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

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
