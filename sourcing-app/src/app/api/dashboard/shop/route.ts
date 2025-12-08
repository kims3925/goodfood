import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// 기간별 날짜 범위 계산
function getDateRange(
  period: string,
  startDateStr?: string | null,
  endDateStr?: string | null
): { start: Date; end: Date; prevStart: Date; prevEnd: Date; days: number } {
  const now = new Date()

  // 커스텀 날짜 범위가 있는 경우
  if (period === 'custom' && startDateStr && endDateStr) {
    const start = new Date(startDateStr)
    start.setHours(0, 0, 0, 0)

    const end = new Date(endDateStr)
    end.setHours(23, 59, 59, 999)

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // 이전 기간 (비교용)
    const prevEnd = new Date(start)
    prevEnd.setDate(prevEnd.getDate() - 1)
    prevEnd.setHours(23, 59, 59, 999)

    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - days + 1)
    prevStart.setHours(0, 0, 0, 0)

    return { start, end, prevStart, prevEnd, days }
  }

  // 프리셋 기간
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  let days = 7
  if (period === 'today') days = 1
  else if (period === '30days') days = 30

  const start = new Date(now)
  start.setDate(start.getDate() - days + 1)
  start.setHours(0, 0, 0, 0)

  // 이전 기간 (비교용)
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  prevEnd.setHours(23, 59, 59, 999)

  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - days + 1)
  prevStart.setHours(0, 0, 0, 0)

  return { start, end, prevStart, prevEnd, days }
}

// 변화율 계산
function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

// 상대 시간 포맷
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  return `${days}일 전`
}

// 날짜 포맷 (MM/DD)
function formatDate(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

// GET: 대시보드 통합 데이터 조회
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
    const period = searchParams.get('period') || '7days'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const { start, end, prevStart, prevEnd, days } = getDateRange(period, startDate, endDate)

    // 현재 기간 주문 조회
    const currentOrders = await prisma.order.findMany({
      where: {
        userId: user.userId,
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        orderedAt: { gte: start, lte: end },
      },
      include: {
        shop: true,
        items: {
          include: {
            publishedProduct: true,
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    })

    // 이전 기간 주문 조회 (비교용)
    const previousOrders = await prisma.order.findMany({
      where: {
        userId: user.userId,
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        orderedAt: { gte: prevStart, lte: prevEnd },
      },
    })

    // 전체 주문 상태 조회 (상태 분포용)
    const allOrders = await prisma.order.findMany({
      where: {
        userId: user.userId,
        orderedAt: { gte: start, lte: end },
      },
    })

    // === KPI 통계 계산 ===
    const currentRevenue = currentOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
    const previousRevenue = previousOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)

    const currentOrderCount = currentOrders.length
    const previousOrderCount = previousOrders.length

    // 고유 고객 수 (전화번호 기준)
    const currentCustomers = new Set(currentOrders.map(o => o.recipientPhone)).size
    const previousCustomers = new Set(previousOrders.map(o => o.recipientPhone)).size

    // 전환율 (임시: 주문 대비 결제 완료 비율)
    const paidOrders = allOrders.filter(o => ['PAID', 'SHIPPED', 'DELIVERED'].includes(o.status)).length
    const totalOrders = allOrders.length
    const conversionRate = totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 1000) / 10 : 0

    const stats = {
      revenue: {
        value: currentRevenue,
        change: calculateChange(currentRevenue, previousRevenue),
      },
      orders: {
        value: currentOrderCount,
        change: calculateChange(currentOrderCount, previousOrderCount),
      },
      customers: {
        value: currentCustomers,
        change: calculateChange(currentCustomers, previousCustomers),
      },
      conversionRate: {
        value: conversionRate,
        change: 0, // 전환율 변화는 복잡하므로 일단 0
      },
    }

    // === 매출 추이 차트 ===
    const revenueByDay = new Map<string, number>()

    // 기간 내 모든 날짜 초기화
    for (let i = 0; i < days; i++) {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      revenueByDay.set(formatDate(date), 0)
    }

    // 주문 데이터로 매출 집계
    for (const order of currentOrders) {
      const dateKey = formatDate(order.orderedAt)
      const current = revenueByDay.get(dateKey) || 0
      revenueByDay.set(dateKey, current + Number(order.totalAmount))
    }

    const revenueChart = Array.from(revenueByDay.entries()).map(([date, amount]) => ({
      date,
      amount,
    }))

    // === 주문 상태 분포 ===
    const statusColors: Record<string, string> = {
      PENDING: '#F59E0B',
      PAID: '#6366F1',
      SHIPPED: '#3B82F6',
      DELIVERED: '#10B981',
      CANCELLED: '#EF4444',
      REFUNDED: '#9CA3AF',
    }

    const statusNames: Record<string, string> = {
      PENDING: '결제대기',
      PAID: '결제완료',
      SHIPPED: '배송중',
      DELIVERED: '배송완료',
      CANCELLED: '취소',
      REFUNDED: '환불',
    }

    const statusCounts = allOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const orderStatusChart = Object.entries(statusCounts)
      .filter(([_, count]) => count > 0)
      .map(([status, value]) => ({
        name: statusNames[status] || status,
        value,
        color: statusColors[status] || '#9CA3AF',
      }))

    // === 최근 주문 5건 ===
    const recentOrdersData = await prisma.order.findMany({
      where: {
        userId: user.userId,
      },
      orderBy: { orderedAt: 'desc' },
      take: 5,
    })

    const recentOrders = recentOrdersData.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.recipientName ? order.recipientName.substring(0, 1) + '**' : '미지정',
      amount: Number(order.totalAmount),
      status: order.status,
      time: formatRelativeTime(order.orderedAt),
    }))

    // === 인기 상품 TOP 5 ===
    const orderItems = currentOrders.flatMap(o => o.items)

    const productSales = orderItems.reduce((acc, item) => {
      const key = item.productName
      if (!acc[key]) {
        acc[key] = {
          name: item.productName,
          sales: 0,
          revenue: 0,
          thumbnailUrl: item.thumbnailUrl,
        }
      }
      acc[key].sales += item.quantity
      acc[key].revenue += Number(item.totalPrice)
      return acc
    }, {} as Record<string, { name: string; sales: number; revenue: number; thumbnailUrl: string | null }>)

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5)
      .map((product, index) => ({
        rank: index + 1,
        name: product.name,
        sales: product.sales,
        revenue: product.revenue,
        thumbnailUrl: product.thumbnailUrl,
      }))

    // === 쇼핑몰별 매출 ===
    const shopColors = ['#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899']

    const shopRevenues = currentOrders.reduce((acc, order) => {
      const shopId = order.shopId || 0
      const shopName = order.shop?.name || '미분류'

      if (!acc[shopId]) {
        acc[shopId] = {
          id: shopId,
          name: shopName,
          revenue: 0,
        }
      }
      acc[shopId].revenue += Number(order.totalAmount)
      return acc
    }, {} as Record<number, { id: number; name: string; revenue: number }>)

    const totalShopRevenue = Object.values(shopRevenues).reduce((sum, s) => sum + s.revenue, 0)

    const shopRevenue = Object.values(shopRevenues)
      .sort((a, b) => b.revenue - a.revenue)
      .map((shop, index) => ({
        id: shop.id,
        name: shop.name,
        revenue: shop.revenue,
        percentage: totalShopRevenue > 0
          ? Math.round((shop.revenue / totalShopRevenue) * 100)
          : 0,
        color: shopColors[index % shopColors.length],
      }))

    return NextResponse.json({
      success: true,
      data: {
        stats,
        revenueChart,
        orderStatusChart,
        recentOrders,
        topProducts,
        shopRevenue,
      },
    })
  } catch (error) {
    console.error('대시보드 데이터 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '대시보드 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
