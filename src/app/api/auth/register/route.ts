import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import prisma from '@/lib/database/client'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다.'),
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다.').optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // 입력값 검증
    const validatedData = registerSchema.parse(body)
    
    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: {
        email: validatedData.email,
      },
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      )
    }
    
    // 비밀번호 해시화
    const hashedPassword = await hash(validatedData.password, 12)
    
    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })
    
    return NextResponse.json({
      message: '회원가입이 완료되었습니다.',
      user,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}