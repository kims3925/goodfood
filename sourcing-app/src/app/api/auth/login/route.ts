export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import {
  verifyPassword,
  createToken,
  getTokenNameForRole,
  AUTH_COOKIE_NAMES,
} from '@/modules/auth/auth.service'

// POST: 로그인
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // 입력 검증
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: '이메일과 비밀번호를 입력해주세요.',
        },
        { status: 400 }
      )
    }

    // 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: '이메일 또는 비밀번호가 올바르지 않습니다.',
        },
        { status: 401 }
      )
    }

    // 역할 검사: ADMIN, MANAGER만 로그인 허용
    console.log('로그인 시도 - 사용자 역할:', user.role, '이메일:', user.email)
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      console.log('역할 검사 실패:', user.role)
      return NextResponse.json(
        {
          success: false,
          error: '소싱앱 접근 권한이 없습니다.',
        },
        { status: 403 }
      )
    }

    // 비밀번호 검증
    if (!user.password) {
      return NextResponse.json(
        {
          success: false,
          error: '이메일 또는 비밀번호가 올바르지 않습니다.',
        },
        { status: 401 }
      )
    }
    const isPasswordValid = await verifyPassword(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: '이메일 또는 비밀번호가 올바르지 않습니다.',
        },
        { status: 401 }
      )
    }

    // JWT 토큰 생성
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // 응답 생성 후 쿠키 설정
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })

    // 쿠키 설정 — role 에 따라 admin/manager 쿠키를 분리하여
    // 같은 브라우저에서 두 세션이 공존할 수 있도록 한다.
    const cookieName = getTokenNameForRole(user.role)
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    })

    // 옛 단일 쿠키('auth-token')가 남아 있으면 새 분리 쿠키와 충돌할 수 있으므로 제거.
    // (분리 전 발급된 쿠키가 verifyToken 으로는 통과하지만 role 매칭이 어긋날 수 있음)
    response.cookies.set(AUTH_COOKIE_NAMES.LEGACY, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('로그인 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '로그인 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
