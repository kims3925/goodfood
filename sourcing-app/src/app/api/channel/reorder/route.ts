export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'

// PUT: 채널 순서 변경
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { orderedIds } = await request.json()

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '순서 데이터가 필요합니다.' },
        { status: 400 }
      )
    }

    // 트랜잭션으로 일괄 업데이트
    await prisma.$transaction(
      orderedIds.map((id: number, index: number) =>
        prisma.channel.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('채널 순서 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '채널 순서 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
