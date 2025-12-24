export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { hashPassword } from '@/modules/auth/auth.service'

export async function POST(request: NextRequest) {
  try {
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
