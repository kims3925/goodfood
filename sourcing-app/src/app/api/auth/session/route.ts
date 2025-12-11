import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'

// GET: 현재 세션 정보 조회
export async function GET() {
  try {
    const tokenPayload = await getCurrentUser()

    if (!tokenPayload) {
      return NextResponse.json({
        success: false,
        user: null,
      })
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: {
        id: tokenPayload.userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        user: null,
      })
    }

    return NextResponse.json({
      success: true,
      user,
    })
  } catch (error) {
    console.error('세션 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        user: null,
        error: '세션 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
