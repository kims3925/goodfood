export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 정산 이력 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const shopId = searchParams.get('shopId')

    // 필터 조건
    const where: any = {
      userId: user.userId,
    }
    if (status) {
      where.status = status
    }
    if (shopId) {
      where.shopId = parseInt(shopId)
    }

    // 정산 목록 조회
    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              coverUrl: true,
              theme: {
                select: { logoUrl: true },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.settlement.count({ where }),
    ])

    // 상태별 통계 조회
    const statsResult = await prisma.settlement.groupBy({
      by: ['status'],
      where: { userId: user.userId },
      _count: true,
      _sum: {
        totalAmount: true,
        totalOrders: true,
      },
    })

    // 통계 포맷팅
    const stats = {
      PENDING: { count: 0, totalAmount: 0, totalOrders: 0 },
      COMPLETED: { count: 0, totalAmount: 0, totalOrders: 0 },
      CANCELLED: { count: 0, totalAmount: 0, totalOrders: 0 },
    }
    for (const stat of statsResult) {
      const statusKey = stat.status as keyof typeof stats
      stats[statusKey] = {
        count: stat._count,
        totalAmount: Number(stat._sum.totalAmount || 0),
        totalOrders: stat._sum.totalOrders || 0,
      }
    }

    // 응답 데이터 포맷팅
    const formattedSettlements = settlements.map(settlement => ({
      id: settlement.id,
      shop: {
        id: settlement.shop.id,
        name: settlement.shop.name,
        coverUrl: settlement.shop.coverUrl,
        logoUrl: settlement.shop.theme?.logoUrl || null,
      },
      periodStart: settlement.periodStart.toISOString(),
      periodEnd: settlement.periodEnd.toISOString(),
      totalOrders: settlement.totalOrders,
      totalAmount: Number(settlement.totalAmount),
      status: settlement.status,
      memo: settlement.memo,
      settledAt: settlement.settledAt?.toISOString() || null,
      createdAt: settlement.createdAt.toISOString(),
      orderCount: settlement._count.items,
    }))

    return NextResponse.json({
      success: true,
      data: {
        settlements: formattedSettlements,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats,
      },
    })
  } catch (error) {
    console.error('정산 이력 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 이력을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
