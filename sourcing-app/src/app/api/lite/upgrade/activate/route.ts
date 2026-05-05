/**
 * POST /api/lite/upgrade/activate
 * Lite Manager — Pro 7일 체험권 활성화 (F5)
 *
 * 자격: pro_unlock 미션 완료 OR 다른 트리거 메트 (서버 재검증)
 * 동작: User.mode = 'pro', proStartAt = now
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const REVENUE_STATUSES = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const

async function checkEligibility(userId: number): Promise<boolean> {
  const [proUnlock, orderAgg] = await Promise.all([
    prisma.userMission.findFirst({
      where: { userId, completed: true, mission: { code: 'pro_unlock' } },
    }),
    prisma.order.aggregate({
      where: {
        shop: { userId },
        status: { in: REVENUE_STATUSES as any },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
  ])

  if (proUnlock) return true
  if (Number(orderAgg._sum.totalAmount || 0) >= 100_000) return true
  if (orderAgg._count.id >= 10) return true
  return false
}

export async function POST(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const userId = user.userId

    const eligible = await checkEligibility(userId)
    if (!eligible) {
      return NextResponse.json(
        { success: false, error: '아직 Pro 체험 자격이 없습니다. 미션을 더 달성해주세요.' },
        { status: 400 }
      )
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        mode: 'pro',
        proStartAt: new Date(),
      },
      select: { id: true, mode: true, proStartAt: true },
    })

    return NextResponse.json({
      success: true,
      data: { user: updated, redirectTo: '/sourcing/dashboard' },
      note: 'Pro 7일 체험이 시작되었습니다. 풀 매니저 패널에서 자동화를 활용하세요.',
    })
  } catch (error: any) {
    console.error('[Lite Upgrade Activate]', error)
    return NextResponse.json({ success: false, error: error?.message || '오류' }, { status: 500 })
  }
}
