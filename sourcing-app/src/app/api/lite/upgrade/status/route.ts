/**
 * GET /api/lite/upgrade/status
 * Lite Manager — Pro 전환 자격 + 트리거 상태 (F5 백엔드)
 *
 * 응답:
 *  - eligible: boolean
 *  - triggers: 자격을 부여한 조건들 (매트릭스)
 *  - userMode: 'lite' | 'pro'
 *  - missionsCompleted / total
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const REVENUE_STATUSES = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const userId = user.userId

    const [userRow, shops] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { mode: true, liteStartAt: true, proStartAt: true },
      }),
      prisma.shop.findMany({ where: { userId, isActive: true }, select: { id: true } }),
    ])

    const shopIds = shops.map((s) => s.id)

    let totalRevenue = 0
    let totalOrders = 0
    let recent3DaysOver5man = false
    let dailyAvgRevenue = 0

    if (shopIds.length > 0) {
      const orderAgg = await prisma.order.aggregate({
        where: { shopId: { in: shopIds }, status: { in: REVENUE_STATUSES as any } },
        _count: { id: true },
        _sum: { totalAmount: true },
      })
      totalRevenue = Number(orderAgg._sum.totalAmount || 0)
      totalOrders = orderAgg._count.id

      // 최근 3일 매출 5만원 이상 일이 3일 연속인지
      const orders = await prisma.order.findMany({
        where: {
          shopId: { in: shopIds },
          status: { in: REVENUE_STATUSES as any },
          orderedAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        },
        select: { totalAmount: true, orderedAt: true },
      })
      const dayRev = new Map<string, number>()
      const kstOffsetMs = 9 * 60 * 60 * 1000
      for (const o of orders) {
        const day = new Date(o.orderedAt.getTime() + kstOffsetMs).toISOString().slice(0, 10)
        dayRev.set(day, (dayRev.get(day) || 0) + Number(o.totalAmount))
      }
      const days = Array.from(dayRev.values())
      recent3DaysOver5man = days.length >= 3 && days.every((rev) => rev >= 50_000)
      dailyAvgRevenue = days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : 0
    }

    // 미션 진행
    const completedMissionsExceptUnlock = await prisma.userMission.count({
      where: {
        userId,
        completed: true,
        mission: { code: { not: 'pro_unlock' } },
      },
    })
    const totalMissionsExceptUnlock = await prisma.mission.count({
      where: { isActive: true, code: { not: 'pro_unlock' } },
    })

    const triggers = {
      mission_5: {
        label: '미션 4종 모두 달성',
        met: completedMissionsExceptUnlock >= totalMissionsExceptUnlock,
        value: `${completedMissionsExceptUnlock} / ${totalMissionsExceptUnlock}`,
      },
      revenue_100k: {
        label: '누적 매출 10만원',
        met: totalRevenue >= 100_000,
        value: `₩${totalRevenue.toLocaleString('ko-KR')}`,
      },
      daily_5man_3days: {
        label: '일 매출 5만원 3일 연속',
        met: recent3DaysOver5man,
        value: `최근 3일 평균 ₩${Math.round(dailyAvgRevenue).toLocaleString('ko-KR')}`,
      },
      orders_10: {
        label: '누적 주문 10건',
        met: totalOrders >= 10,
        value: `${totalOrders}건`,
      },
    }

    const eligible = Object.values(triggers).some((t) => t.met)

    return NextResponse.json({
      success: true,
      data: {
        userMode: userRow?.mode || 'lite',
        liteStartAt: userRow?.liteStartAt?.toISOString() || null,
        proStartAt: userRow?.proStartAt?.toISOString() || null,
        eligible,
        triggers,
        stats: {
          totalRevenue,
          totalOrders,
          completedMissions: completedMissionsExceptUnlock,
          totalMissions: totalMissionsExceptUnlock,
        },
      },
    })
  } catch (error: any) {
    console.error('[Lite Upgrade Status]', error)
    return NextResponse.json({ success: false, error: error?.message || '오류' }, { status: 500 })
  }
}
