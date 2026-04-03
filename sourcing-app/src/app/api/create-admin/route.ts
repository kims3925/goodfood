export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'
import { hashPassword } from '@/modules/auth/auth.service'

export async function POST(request: NextRequest) {
  try {
    // NextAuth 세션 검증
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }
    if ((session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    // 운영 환경에서는 비활성화
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: '운영 환경에서는 이 API를 사용할 수 없습니다.' },
        { status: 403 }
      )
    }

    // 개발 환경에서도 ADMIN_SETUP_KEY가 있으면 검증
    const setupKey = request.headers.get('x-admin-setup-key')
    const expectedKey = process.env.ADMIN_SETUP_KEY
    if (expectedKey && setupKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: '인증 키가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    const { email, password } = await request.json()

    // 이미 존재하는지 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: '이미 존재하는 계정입니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 해싱
    const hashedPassword = await hashPassword(password)

    // 관리자 계정 생성
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: '관리자',
        role: 'ADMIN',
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('관리자 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '관리자 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
