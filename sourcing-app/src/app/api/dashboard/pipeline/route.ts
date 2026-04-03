export const dynamic = 'force-dynamic'

/**
 * Pipeline Dashboard API
 * 전체 파이프라인 통합 대시보드 데이터 조회
 * - 소싱 자동화 현황
 * - 주문/발주 현황
 * - 정산 현황
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { getAutomationStats } from '@/modules/automation'
import { getHourlyWorkflowStats } from '@/modules/automation/workflow-service'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const userId = currentUser.userId

    // 날짜 범위 설정
    const now = new Date()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // 7일 전
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 6)
    weekAgo.setHours(0, 0, 0, 0)

    // === 1. 소싱 자동화 현황 ===
    const [automationStats, hourlyStats, automationConfig, recentWorkflows] = await Promise.all([
      getAutomationStats(userId, todayStart, todayEnd),
      getHourlyWorkflowStats(userId, todayStart, todayEnd),
      prisma.automationConfig.findUnique({
        where: { userId },
      }),
      prisma.workflowLog.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 5,
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      }),
    ])

    // === 2. 주문/발주 현황 ===
    // 회원 주문 상태별 카운트
    const memberOrderStatusCounts = await prisma.order.groupBy({
      by: ['status'],
      where: {
        items: { some: { shopProduct: { userId } } },
        cancelledAt: null,
      },
      _count: { id: true },
    })

    // 비회원 주문 상태별 카운트
    const guestOrderStatusCounts = await prisma.guestOrder.groupBy({
      by: ['status'],
      where: {
        items: { some: { shopProduct: { userId } } },
        cancelledAt: null,
      },
      _count: { id: true },
    })

    // 주문 상태 합산
    const orderStatusMap: Record<string, number> = {}
    for (const item of memberOrderStatusCounts) {
      orderStatusMap[item.status] = (orderStatusMap[item.status] || 0) + item._count.id
    }
    for (const item of guestOrderStatusCounts) {
      orderStatusMap[item.status] = (orderStatusMap[item.status] || 0) + item._count.id
    }

    // 도매 발주 상태별 카운트
    const memberWholesaleStatusCounts = await prisma.order.groupBy({
      by: ['wholesaleOrderStatus'],
      where: {
        items: { some: { shopProduct: { userId } } },
        status: { in: ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] },
      },
      _count: { id: true },
    })

    const guestWholesaleStatusCounts = await prisma.guestOrder.groupBy({
      by: ['wholesaleOrderStatus'],
      where: {
        items: { some: { shopProduct: { userId } } },
        status: { in: ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] },
      },
      _count: { id: true },
    })

    const wholesaleStatusMap: Record<string, number> = {}
    for (const item of memberWholesaleStatusCounts) {
      const key = item.wholesaleOrderStatus || 'NONE'
      wholesaleStatusMap[key] = (wholesaleStatusMap[key] || 0) + item._count.id
    }
    for (const item of guestWholesaleStatusCounts) {
      const key = item.wholesaleOrderStatus || 'NONE'
      wholesaleStatusMap[key] = (wholesaleStatusMap[key] || 0) + item._count.id
    }

    // 오늘 신규 주문 수
    const todayNewOrders = await Promise.all([
      prisma.order.count({
        where: {
          items: { some: { shopProduct: { userId } } },
          orderedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.guestOrder.count({
        where: {
          items: { some: { shopProduct: { userId } } },
          orderedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]).then(([a, b]) => a + b)

    // 최근 7일 일별 주문 추이
    const dailyOrderTrend = await getDailyOrderTrend(userId, weekAgo, todayEnd)

    // === 3. 정산 현황 ===
    const [pendingSettlementCount, recentSettlements] = await Promise.all([
      // 배송완료 but 미정산 주문 수
      Promise.all([
        prisma.order.count({
          where: {
            items: { some: { shopProduct: { userId } } },
            status: 'DELIVERED',
            // 정산되지 않은 주문: SettlementItem에 연결되지 않은 주문
          },
        }),
        prisma.guestOrder.count({
          where: {
            items: { some: { shopProduct: { userId } } },
            status: 'DELIVERED',
          },
        }),
      ]).then(([a, b]) => a + b),
      // 최근 정산 이력
      prisma.settlement.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          shop: { select: { id: true, name: true } },
        },
      }),
    ])

    // === 4. 도매 채널 현황 ===
    const wholesaleChannels = await prisma.channel.findMany({
      where: {
        userId,
        kind: 'WHOLESALE',
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        coverUrl: true,
      },
    })

    // === 응답 조합 ===
    return NextResponse.json({
      success: true,
      data: {
        // 소싱 자동화
        sourcing: {
          stats: {
            todayCollected: automationStats.todayCollected,
            pendingTransform: automationStats.pendingTransform,
            readyToPublish: automationStats.readyToPublish,
            todayPublished: automationStats.todayPublished,
          },
          hourlyStats,
          config: automationConfig
            ? {
                isEnabled: automationConfig.isEnabled,
                lastRunAt: automationConfig.lastRunAt,
                nextRunAt: automationConfig.nextRunAt,
                cronExpression: automationConfig.cronExpression,
              }
            : null,
          recentWorkflows: recentWorkflows.map((wf) => ({
            id: wf.id,
            workflowType: wf.workflowType,
            status: wf.status,
            startedAt: wf.startedAt,
            completedAt: wf.completedAt,
            totalItems: wf.totalItems,
            processedItems: wf.processedItems,
            successCount: wf.successCount,
            failedCount: wf.failedCount,
            steps: wf.steps.map((s) => ({
              stepType: s.stepType,
              status: s.status,
              progress: s.totalItems > 0
                ? Math.round((s.processedItems / s.totalItems) * 100)
                : 0,
            })),
          })),
        },

        // 주문/발주
        orders: {
          statusCounts: orderStatusMap,
          wholesaleStatusCounts: wholesaleStatusMap,
          todayNewOrders,
          dailyTrend: dailyOrderTrend,
        },

        // 정산
        settlement: {
          pendingCount: pendingSettlementCount,
          recentSettlements: recentSettlements.map((s) => ({
            id: s.id,
            shopName: s.shop.name,
            periodStart: s.periodStart,
            periodEnd: s.periodEnd,
            totalOrders: s.totalOrders,
            totalAmount: Number(s.totalAmount),
            status: s.status,
            settledAt: s.settledAt,
          })),
        },

        // 도매 채널
        wholesaleChannels,
      },
    })
  } catch (error) {
    console.error('파이프라인 대시보드 데이터 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '대시보드 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * 최근 7일 일별 주문 수 추이
 */
async function getDailyOrderTrend(
  userId: number,
  startDate: Date,
  endDate: Date
): Promise<{ date: string; orders: number }[]> {
  const days: { date: string; orders: number }[] = []
  const current = new Date(startDate)

  while (current <= endDate) {
    const dayStart = new Date(current)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(current)
    dayEnd.setHours(23, 59, 59, 999)

    const [memberCount, guestCount] = await Promise.all([
      prisma.order.count({
        where: {
          items: { some: { shopProduct: { userId } } },
          orderedAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.guestOrder.count({
        where: {
          items: { some: { shopProduct: { userId } } },
          orderedAt: { gte: dayStart, lte: dayEnd },
        },
      }),
    ])

    days.push({
      date: `${(current.getMonth() + 1).toString().padStart(2, '0')}/${current.getDate().toString().padStart(2, '0')}`,
      orders: memberCount + guestCount,
    })

    current.setDate(current.getDate() + 1)
  }

  return days
}
