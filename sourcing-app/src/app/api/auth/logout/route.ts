import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/modules/auth/auth.service'

// POST: 로그아웃
export async function POST() {
  try {
    await clearAuthCookie()

    return NextResponse.json({
      success: true,
      message: '로그아웃되었습니다.',
    })
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
