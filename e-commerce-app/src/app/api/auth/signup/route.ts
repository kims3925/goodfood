import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/common/utils/src/database/client'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, phone } = await request.json()

    // 유효성 검사
    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: '필수 정보를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 길이 검사
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 8자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 중복 이메일 검사
    const existingCustomer = await prisma.customer.findUnique({
      where: { email },
    })

    if (existingCustomer) {
      return NextResponse.json(
        { success: false, error: '이미 가입된 이메일입니다.' },
        { status: 409 }
      )
    }

    // 비밀번호 해시화
    const passwordHash = await bcrypt.hash(password, 12)

    // 회원 생성
    const customer = await prisma.customer.create({
      data: {
        email,
        passwordHash,
        name,
        phone: phone || null,
      },
    })

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      user: {
        id: customer.id.toString(),
        email: customer.email,
        name: customer.name,
      },
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { success: false, error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
