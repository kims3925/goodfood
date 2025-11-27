import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@/lib/prisma'

/**
 * GET /api/settlement/history
 *
 * 정산 이력 조회
 *
 * Query Parameters:
 * - retailBandId?: number - 특정 소매밴드 필터
 * - status?: 'PENDING' | 'COMPLETED' | 'CANCELLED'
 * - page?: number - 페이지 (기본 1)
 * - limit?: number - 페이지당 항목 수 (기본 10)
 */
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

    const { searchParams } = new URL(request.url)
    const retailBandId = searchParams.get('retailBandId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // 필터 조건
    const where: any = {
      userId,
    }

    if (retailBandId) {
      where.retailBandId = parseInt(retailBandId)
    }

    if (status && ['PENDING', 'COMPLETED', 'CANCELLED'].includes(status)) {
      where.status = status
    }

    // 전체 개수
    const total = await prisma.settlement.count({ where })

    // 정산 이력 조회
    const settlements = await prisma.settlement.findMany({
      where,
      include: {
        retailBand: {
          select: { id: true, name: true, coverUrl: true },
        },
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    // 통계
    const stats = await prisma.settlement.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
      _sum: {
        totalAmount: true,
        totalOrders: true,
      },
    })

    const statsMap = {
      PENDING: { count: 0, totalAmount: 0, totalOrders: 0 },
      COMPLETED: { count: 0, totalAmount: 0, totalOrders: 0 },
      CANCELLED: { count: 0, totalAmount: 0, totalOrders: 0 },
    }

    stats.forEach(s => {
      statsMap[s.status as keyof typeof statsMap] = {
        count: s._count,
        totalAmount: s._sum.totalAmount || 0,
        totalOrders: s._sum.totalOrders || 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        settlements: settlements.map(s => ({
          id: s.id,
          retailBand: s.retailBand,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          totalOrders: s.totalOrders,
          totalAmount: s.totalAmount,
          status: s.status,
          memo: s.memo,
          settledAt: s.settledAt,
          createdAt: s.createdAt,
          orderCount: s._count.orders,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: statsMap,
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
