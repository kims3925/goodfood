/**
 * GET /api/lite/rankings?period=today|week|month
 * Lite Manager — 랭킹 보드 (D5)
 *
 * 익명화된 매출 순위 (셀러 식별 불가). Lite 전체 셀러 비교.
 * 본인 위치는 강조 표시.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const REVENUE_STATUSES = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const

function startOfTodayKST(): Date {
  const now = new Date()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffsetMs)
  kstNow.setUTCHours(0, 0, 0, 0)
  return new Date(kstNow.getTime() - kstOffsetMs)
}

function maskNickname(seed: number): string {
  // userId 기반 결정적 닉네임 생성 — "셀러A1B" 같은 익명
  const suffix = (seed % 999).toString().padStart(3, '0')
  const letter = String.fromCharCode(65 + (seed % 26))
  return `셀러 ${letter}${suffix}`
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'today') as 'today' | 'week' | 'month'

    let since: Date
    if (period === 'week') {
      const today = startOfTodayKST()
      const day = (today.getUTCDay() + 9) % 7
      const monday = new Date(today)
      monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7))
      since = monday
    } else if (period === 'month') {
      const today = startOfTodayKST()
      const kstOffsetMs = 9 * 60 * 60 * 1000
      const kstToday = new Date(today.getTime() + kstOffsetMs)
      kstToday.setUTCDate(1)
      since = new Date(kstToday.getTime() - kstOffsetMs)
    } else {
      since = startOfTodayKST()
    }

    // 모든 셀러의 운영 shop 별 매출 집계 — Shop.isActive=true 필터링
    const activeShops = await prisma.shop.findMany({
      where: { isActive: true },
      select: { id: true, userId: true },
    })
    const shopUserMap = new Map(activeShops.map((s) => [s.id, s.userId]))

    const orders = await prisma.order.findMany({
      where: {
        status: { in: REVENUE_STATUSES as any },
        orderedAt: { gte: since },
        shopId: { in: activeShops.map((s) => s.id) },
      },
      select: {
        totalAmount: true,
        shopId: true,
      },
    })

    const sellerAgg = new Map<number, { revenue: number; orders: number }>()
    for (const o of orders) {
      const sid = o.shopId != null ? shopUserMap.get(o.shopId) : null
      if (sid == null) continue
      const slot = sellerAgg.get(sid) || { revenue: 0, orders: 0 }
      slot.revenue += Number(o.totalAmount)
      slot.orders += 1
      sellerAgg.set(sid, slot)
    }

    const ranked = Array.from(sellerAgg.entries())
      .map(([userId, agg]) => ({ userId, ...agg }))
      .sort((a, b) => b.revenue - a.revenue)

    const total = ranked.length
    const myIndex = ranked.findIndex((r) => r.userId === user.userId)

    // 상위 10 + 내 주변 5 (없으면 그냥 상위 10만)
    const top10 = ranked.slice(0, 10).map((r, i) => ({
      rank: i + 1,
      nickname: maskNickname(r.userId),
      revenue: r.revenue,
      orders: r.orders,
      isMe: r.userId === user.userId,
    }))

    let nearMe: typeof top10 = []
    if (myIndex >= 10) {
      const start = Math.max(10, myIndex - 2)
      const end = Math.min(ranked.length, myIndex + 3)
      nearMe = ranked.slice(start, end).map((r, i) => ({
        rank: start + i + 1,
        nickname: maskNickname(r.userId),
        revenue: r.revenue,
        orders: r.orders,
        isMe: r.userId === user.userId,
      }))
    }

    const myRank = myIndex >= 0 ? myIndex + 1 : null
    const myStats = myIndex >= 0 ? ranked[myIndex] : null

    // 백분위 — 상위 N% 표시
    const myPercentile =
      myRank != null && total > 0 ? Math.round((myRank / total) * 100) : null

    return NextResponse.json({
      success: true,
      data: {
        period,
        total,
        top10,
        nearMe,
        my: {
          rank: myRank,
          percentile: myPercentile,
          revenue: myStats?.revenue ?? 0,
          orders: myStats?.orders ?? 0,
        },
      },
    })
  } catch (error: any) {
    console.error('[Lite Rankings]', error)
    return NextResponse.json({ success: false, error: error?.message || '오류' }, { status: 500 })
  }
}
