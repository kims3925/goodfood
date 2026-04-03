export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export async function GET() {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [
      totalUsers,
      activeUsers,
      totalShops,
      activeShops,
      totalOrders,
      todayOrders,
      totalProducts,
      todayCollected,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, role: { in: ['MANAGER', 'ADMIN'] } } }),
      prisma.shop.count({ where: { deletedAt: null } }),
      prisma.shop.count({ where: { deletedAt: null, isActive: true } }),
      prisma.order.count(),
      prisma.order.count({ where: { orderedAt: { gte: todayStart } } }),
      prisma.shopProduct.count({ where: { deletedAt: null } }),
      prisma.collectedProduct.count({ where: { createdAt: { gte: todayStart } } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalShops,
        activeShops,
        totalOrders,
        todayOrders,
        totalProducts,
        todayCollected,
        agentTeams: 5,
        activeAgents: 3,
      },
    })
  } catch (error) {
    console.error('플랫폼 통계 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '통계 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
