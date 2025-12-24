export const dynamic = 'force-dynamic'

/**
 * Signup API
 * 회원가입 처리
 * AuthService 사용
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthService } from '@/modules/auth/services/auth.service'

const authService = getAuthService()

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, phone, shopId } = await request.json()

    const user = await authService.signup({ email, password, name, phone, shopId })

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      user,
    })
  } catch (error: any) {
    console.error('Signup error:', error)

    // ValidationError
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    // BusinessLogicError (중복 이메일 등)
    if (error.name === 'BusinessLogicError') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: false, error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
