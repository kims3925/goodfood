export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/channel/wholesale
 * 도매 채널 목록 조회 (카톡 발주용)
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const channels = await prisma.channel.findMany({
      where: {
        userId: user.userId,
        kind: 'WHOLESALE',
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        platform: true,
        kind: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: channels,
    })
  } catch (error) {
    console.error('도매 채널 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '도매 채널 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
