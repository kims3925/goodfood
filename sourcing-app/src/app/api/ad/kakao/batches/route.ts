/**
 * GET /api/ad/kakao/batches
 *
 * 사용자의 최근 카카오 광고 배치 이력 (최근 30일).
 * 각 배치의 카드 목록도 같이 포함 (이력 탭에서 펼쳐 보기 위함).
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10) || 30, 100)
  const includeCards = searchParams.get('includeCards') !== 'false'

  const batches = await prisma.kakaoAdBatch.findMany({
    where: { userId: user.userId },
    orderBy: { date: 'desc' },
    take: limit,
    include: includeCards
      ? {
          cards: {
            orderBy: { id: 'asc' },
            select: {
              id: true,
              productId: true,
              productName: true,
              title: true,
              titleColor: true,
              priceText: true,
              sendStatus: true,
              aiGenerated: true,
              createdAt: true,
            },
          },
        }
      : undefined,
  })

  return NextResponse.json({
    success: true,
    batches: batches.map((b: any) => ({
      id: b.id,
      date: b.date,
      cardCount: b.cardCount,
      sentCount: b.sentCount,
      failedCount: b.failedCount,
      totalDurationSec: b.totalDurationSec,
      createdAt: b.createdAt,
      cards: b.cards || [],
    })),
  })
}
