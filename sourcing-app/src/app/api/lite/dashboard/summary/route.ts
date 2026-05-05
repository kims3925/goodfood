/**
 * GET /api/lite/dashboard/summary
 * Lite Manager — 대시보드 집계 (A4 + D1-D4 백엔드)
 *
 * 응답:
 *  - revenue: { today, thisWeek, thisMonth }: { totalAmount, orderCount, avgOrder, marginPct }
 *  - hourlyChart: [24]Hour {hour, revenue, orderCount}  (오늘 0~23시)
 *  - topProducts: [3]{productId, name, qty, revenue}    (이번 달 TOP)
 *  - estimatedMargin: { gross, fee, net, marginPct }     (이번 달 추정)
 *
 * 캐싱: in-memory 60초 (Phase 2 minimal — Redis 는 부하 테스트 후 검토)
 *
 * 데이터 소스 — 셀러의 운영 Shop 의 PAID 이상 주문만 집계
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { sumMargin } from '@/lib/lite-margin'

// 매출로 인정하는 주문 상태 — PENDING 은 결제 미완료라 제외
const REVENUE_STATUSES = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const

// in-memory 캐시 (단일 노드, 60초)
interface CacheEntry {
  expiresAt: number
  data: any
}
const cache = new Map<number, CacheEntry>()
const CACHE_TTL_MS = 60_000

function startOfTodayKST(): Date {
  // KST = UTC+9. 오늘 00:00 KST = UTC 어제 15:00.
  const now = new Date()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffsetMs)
  kstNow.setUTCHours(0, 0, 0, 0)
  return new Date(kstNow.getTime() - kstOffsetMs)
}

function startOfWeekKST(): Date {
  const today = startOfTodayKST()
  const day = (today.getUTCDay() + 9) % 7 // KST 요일 보정 — 일=0
  const monday = new Date(today)
  monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7)) // 월요일 시작
  return monday
}

function startOfMonthKST(): Date {
  const today = startOfTodayKST()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstToday = new Date(today.getTime() + kstOffsetMs)
  kstToday.setUTCDate(1)
  return new Date(kstToday.getTime() - kstOffsetMs)
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const userId = user.userId

    // 캐시 hit
    const cached = cache.get(userId)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ success: true, data: cached.data, cached: true })
    }

    // 셀러의 운영 shop 결정
    const shops = await prisma.shop.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    })
    const shopIds = shops.map((s) => s.id)
    if (shopIds.length === 0) {
      const empty = {
        revenue: {
          today: { totalAmount: 0, orderCount: 0, avgOrder: 0, marginPct: null },
          thisWeek: { totalAmount: 0, orderCount: 0, avgOrder: 0, marginPct: null },
          thisMonth: { totalAmount: 0, orderCount: 0, avgOrder: 0, marginPct: null },
        },
        hourlyChart: Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, orderCount: 0 })),
        topProducts: [],
        estimatedMargin: { gross: 0, fee: 0, net: null, marginPct: null },
        message: '아직 운영 중인 쇼핑몰이 없습니다',
      }
      cache.set(userId, { expiresAt: Date.now() + CACHE_TTL_MS, data: empty })
      return NextResponse.json({ success: true, data: empty })
    }

    const todayStart = startOfTodayKST()
    const weekStart = startOfWeekKST()
    const monthStart = startOfMonthKST()

    // 한 번에 이번 달 주문 + 아이템 fetch (한 달 분량 — 적당)
    const orders = await prisma.order.findMany({
      where: {
        shopId: { in: shopIds },
        status: { in: REVENUE_STATUSES as any },
        orderedAt: { gte: monthStart },
      },
      select: {
        id: true,
        totalAmount: true,
        orderedAt: true,
        items: {
          select: {
            shopProductId: true,
            productName: true,
            unitPrice: true,
            quantity: true,
            shopProduct: {
              select: {
                productId: true,
                product: {
                  select: { id: true, name: true, wholesalePrice: true, variants: { select: { wholesalePrice: true }, take: 1 } },
                },
              },
            },
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    })

    // 시간대별 (오늘만)
    const hourlyMap = new Map<number, { revenue: number; orderCount: number }>()
    for (let h = 0; h < 24; h++) hourlyMap.set(h, { revenue: 0, orderCount: 0 })

    // 매출 합산 윈도우별
    let todayItems: any[] = []
    let weekItems: any[] = []
    let monthItems: any[] = []
    let todayCount = 0
    let weekCount = 0
    let monthCount = 0
    let todayRevenue = 0
    let weekRevenue = 0
    let monthRevenue = 0

    // TOP3 누적 (이번 달)
    const productAgg = new Map<number, { name: string; qty: number; revenue: number }>()

    for (const order of orders) {
      const amount = Number(order.totalAmount)
      const oAt = new Date(order.orderedAt)

      monthCount++
      monthRevenue += amount
      monthItems.push(...order.items)

      if (oAt >= weekStart) {
        weekCount++
        weekRevenue += amount
        weekItems.push(...order.items)
      }

      if (oAt >= todayStart) {
        todayCount++
        todayRevenue += amount
        todayItems.push(...order.items)
        // 시간대별 (KST hour)
        const kst = new Date(oAt.getTime() + 9 * 60 * 60 * 1000)
        const hour = kst.getUTCHours()
        const slot = hourlyMap.get(hour)!
        slot.revenue += amount
        slot.orderCount += 1
      }

      // TOP 상품 (이번 달)
      for (const item of order.items) {
        const productId = item.shopProduct?.productId
        if (productId == null) continue
        const productName = item.shopProduct?.product?.name || item.productName
        const slot = productAgg.get(productId) || { name: productName, qty: 0, revenue: 0 }
        slot.qty += item.quantity
        slot.revenue += Number(item.unitPrice) * item.quantity
        productAgg.set(productId, slot)
      }
    }

    // 마진 추정 (윈도우별)
    const buildMarginInput = (items: typeof monthItems) =>
      items.map((it) => ({
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        wholesalePrice:
          it.shopProduct?.product?.variants?.[0]?.wholesalePrice ??
          it.shopProduct?.product?.wholesalePrice ??
          null,
      }))

    const todayMargin = sumMargin(buildMarginInput(todayItems))
    const weekMargin = sumMargin(buildMarginInput(weekItems))
    const monthMargin = sumMargin(buildMarginInput(monthItems))

    const topProducts = Array.from(productAgg.entries())
      .map(([productId, agg]) => ({ productId, ...agg }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)

    const data = {
      revenue: {
        today: {
          totalAmount: todayRevenue,
          orderCount: todayCount,
          avgOrder: todayCount > 0 ? Math.round(todayRevenue / todayCount) : 0,
          marginPct: todayMargin.marginPct,
          net: todayMargin.net,
        },
        thisWeek: {
          totalAmount: weekRevenue,
          orderCount: weekCount,
          avgOrder: weekCount > 0 ? Math.round(weekRevenue / weekCount) : 0,
          marginPct: weekMargin.marginPct,
          net: weekMargin.net,
        },
        thisMonth: {
          totalAmount: monthRevenue,
          orderCount: monthCount,
          avgOrder: monthCount > 0 ? Math.round(monthRevenue / monthCount) : 0,
          marginPct: monthMargin.marginPct,
          net: monthMargin.net,
        },
      },
      hourlyChart: Array.from(hourlyMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([hour, slot]) => ({ hour, revenue: slot.revenue, orderCount: slot.orderCount })),
      topProducts,
      estimatedMargin: {
        gross: monthMargin.sellingPrice - (monthMargin.wholesalePrice ?? 0),
        fee: monthMargin.fee,
        net: monthMargin.net,
        marginPct: monthMargin.marginPct,
      },
    }

    cache.set(userId, { expiresAt: Date.now() + CACHE_TTL_MS, data })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[Lite Dashboard Summary] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '대시보드 조회 중 오류' },
      { status: 500 }
    )
  }
}
