import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@modules/common/utils/src/database/client'
import bcrypt from 'bcryptjs'

// 회원 정보 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user,
    })
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    return NextResponse.json(
      { success: false, error: '회원 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 회원 정보 수정
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const { name, phone, currentPassword, newPassword } = await request.json()

    // 현재 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 비밀번호 변경 시 현재 비밀번호 확인
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: '현재 비밀번호를 입력해주세요' },
          { status: 400 }
        )
      }

      if (!user.password) {
        return NextResponse.json(
          { success: false, error: '비밀번호가 설정되지 않은 계정입니다' },
          { status: 400 }
        )
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password)

      if (!isPasswordValid) {
        return NextResponse.json(
          { success: false, error: '현재 비밀번호가 일치하지 않습니다' },
          { status: 400 }
        )
      }

      // 새 비밀번호 암호화
      const hashedPassword = await bcrypt.hash(newPassword, 10)

      await prisma.user.update({
        where: { id: userId },
        data: {
          name,
          phone,
          password: hashedPassword,
        },
      })
    } else {
      // 비밀번호 변경 없이 정보만 수정
      await prisma.user.update({
        where: { id: userId },
        data: {
          name,
          phone,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: '회원 정보가 수정되었습니다',
    })
  } catch (error) {
    console.error('Failed to update profile:', error)
    return NextResponse.json(
      { success: false, error: '회원 정보 수정에 실패했습니다' },
      { status: 500 }
    )
  }
}
