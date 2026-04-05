export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { hashPassword } from '@/modules/auth/auth.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      email,
      password,
      phone,
      sellerType,
      companyName,
      businessNumber,
      onlineSalesNumber,
    } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: '이름, 이메일, 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 8자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    if (sellerType === 'SELLER' && !companyName) {
      return NextResponse.json(
        { success: false, error: '판매자 등록 시 회사명/상호는 필수입니다.' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone: phone || null,
        role: 'MANAGER',
        sellerType: sellerType || null,
        companyName: companyName || null,
        businessNumber: businessNumber || null,
        onlineSalesNumber: onlineSalesNumber || null,
        signupCompletedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sellerType: sellerType || null,
      },
    })
  } catch (error) {
    console.error('회원가입 실패:', error)
    return NextResponse.json(
      { success: false, error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
