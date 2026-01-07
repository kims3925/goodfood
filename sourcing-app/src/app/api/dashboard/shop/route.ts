export const dynamic = 'force-dynamic'

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

    // 현재 기간 회원 주문 조회 (Product 배송비 정보 포함)
    const currentMemberOrders = await prisma.order.findMany({
      where: {
        shop: { userId: user.userId },
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        orderedAt: { gte: start, lte: end },
      },
      include: {
        shop: true,
        shippingAddress: true,
        items: {
          include: {
            variant: {
              select: { bundleUnit: true },
            },
            publishedProduct: {
              include: {
                product: {
                  select: {
                    id: true,
                    shippingFee: true,
                    bundleMaxQty: true,
                    bundleShippingType: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    })

    // 현재 기간 비회원 주문 조회 (Product 배송비 정보 포함)
    const currentGuestOrders = await prisma.guestOrder.findMany({
      where: {
        shop: { userId: user.userId },
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        orderedAt: { gte: start, lte: end },
      },
      include: {
        shop: true,
        shippingAddress: true,
        items: {
          include: {
            variant: {
              select: { bundleUnit: true },
            },
            publishedProduct: {
              include: {
                product: {
                  select: {
                    id: true,
                    shippingFee: true,
                    bundleMaxQty: true,
                    bundleShippingType: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    })

    // 이전 기간 회원 주문 조회 (비교용 - Product 배송비 정보 포함)
    const previousMemberOrders = await prisma.order.findMany({
      where: {
        shop: { userId: user.userId },
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        orderedAt: { gte: prevStart, lte: prevEnd },
      },
      include: {
        shippingAddress: true,
        items: {
          include: {
            variant: { select: { bundleUnit: true } },
            publishedProduct: {
              include: {
                product: {
                  select: { id: true, shippingFee: true, bundleMaxQty: true, bundleShippingType: true },
                },
              },
            },
          },
        },
      },
    })

    // 이전 기간 비회원 주문 조회 (비교용 - Product 배송비 정보 포함)
    const previousGuestOrders = await prisma.guestOrder.findMany({
      where: {
        shop: { userId: user.userId },
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        orderedAt: { gte: prevStart, lte: prevEnd },
      },
      include: {
        shippingAddress: true,
        items: {
          include: {
            variant: { select: { bundleUnit: true } },
            publishedProduct: {
              include: {
                product: {
                  select: { id: true, shippingFee: true, bundleMaxQty: true, bundleShippingType: true },
                },
              },
            },
          },
        },
      },
    })

    // 전체 회원 주문 상태 조회 (상태 분포용)
    const allMemberOrders = await prisma.order.findMany({
      where: {
        shop: { userId: user.userId },
        orderedAt: { gte: start, lte: end },
      },
    })

    // 전체 비회원 주문 상태 조회 (상태 분포용)
    const allGuestOrders = await prisma.guestOrder.findMany({
      where: {
        shop: { userId: user.userId },
        orderedAt: { gte: start, lte: end },
      },
    })

    // === KPI 통계 계산 (회원 + 비회원) ===
    const currentMemberRevenue = currentMemberOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
    const currentGuestRevenue = currentGuestOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
    const currentRevenue = currentMemberRevenue + currentGuestRevenue

    const previousMemberRevenue = previousMemberOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
    const previousGuestRevenue = previousGuestOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
    const previousRevenue = previousMemberRevenue + previousGuestRevenue

    const currentOrderCount = currentMemberOrders.length + currentGuestOrders.length
    const previousOrderCount = previousMemberOrders.length + previousGuestOrders.length

    // 고유 고객 수 (전화번호 기준 - 회원 + 비회원)
    const currentMemberPhones = currentMemberOrders.map(o => o.shippingAddress?.recipientPhone).filter(Boolean)
    const currentGuestPhones = currentGuestOrders.map(o => o.guestPhone).filter(Boolean)
    const currentCustomers = new Set([...currentMemberPhones, ...currentGuestPhones]).size

    const previousMemberPhones = previousMemberOrders.map(o => o.shippingAddress?.recipientPhone).filter(Boolean)
    const previousGuestPhones = previousGuestOrders.map(o => o.guestPhone).filter(Boolean)
    const previousCustomers = new Set([...previousMemberPhones, ...previousGuestPhones]).size

    // === 마진 계산 (회원 + 비회원) - Product 기반 배송비 사용 ===
    // 마진 = (판매금액 - 도매금액) - Product 기반 배송비

    // Product 기반 배송비 계산 함수 (합배송 로직 적용)
    const calculateOrderShippingFee = (items: any[]): number => {
      // 상품별 배송비 정보 집계
      const productShippingMap = new Map<number, {
        shippingFee: number
        bundleMaxQty: number
        bundleShippingType: string
        totalBundleUnits: number
        itemCount: number
      }>()

      for (const item of items) {
        const product = item.publishedProduct?.product
        if (!product) continue

        const productId = product.id
        const shippingFee = product.shippingFee || 0
        const bundleMaxQty = product.bundleMaxQty || 1
        const bundleShippingType = product.bundleShippingType || 'NONE'
        const bundleUnit = item.variant?.bundleUnit || 1

        if (!productShippingMap.has(productId)) {
          productShippingMap.set(productId, {
            shippingFee,
            bundleMaxQty,
            bundleShippingType,
            totalBundleUnits: 0,
            itemCount: 0,
          })
        }

        const info = productShippingMap.get(productId)!
        info.totalBundleUnits += item.quantity * bundleUnit
        info.itemCount++
      }

      // 상품별 실제 배송비 계산
      let totalShippingFee = 0
      for (const [_, info] of productShippingMap) {
        if (info.shippingFee > 0) {
          if (info.bundleShippingType === 'NONE') {
            // 합배송 없음: 아이템 수 × 배송비
            totalShippingFee += info.itemCount * info.shippingFee
          } else {
            // 합배송 적용: ceil(총 배송단위 / 합배송 최대수량) × 배송비
            const shippingCount = Math.ceil(info.totalBundleUnits / info.bundleMaxQty)
            totalShippingFee += shippingCount * info.shippingFee
          }
        }
      }

      return totalShippingFee
    }

    // 회원 주문 마진 계산
    let memberProductMargin = 0  // 상품 마진 (판매가 - 도매가)
    let memberShippingFee = 0    // Product 기반 배송비
    let memberTotalRevenue = 0
    for (const order of currentMemberOrders) {
      memberShippingFee += calculateOrderShippingFee(order.items)
      for (const item of order.items) {
        const unitPrice = Number(item.unitPrice)
        const wholesalePrice = (item as unknown as { wholesalePrice?: number }).wholesalePrice || 0
        memberProductMargin += (unitPrice - wholesalePrice) * item.quantity
        memberTotalRevenue += unitPrice * item.quantity
      }
    }

    // 비회원 주문 마진 계산
    let guestProductMargin = 0
    let guestShippingFee = 0
    let guestTotalRevenue = 0
    for (const order of currentGuestOrders) {
      guestShippingFee += calculateOrderShippingFee(order.items)
      for (const item of order.items) {
        const unitPrice = Number(item.unitPrice)
        const wholesalePrice = (item as unknown as { wholesalePrice?: number }).wholesalePrice || 0
        guestProductMargin += (unitPrice - wholesalePrice) * item.quantity
        guestTotalRevenue += unitPrice * item.quantity
      }
    }

    // 총 마진 = 상품마진 - 배송비
    const totalProductMargin = memberProductMargin + guestProductMargin
    const totalShippingFee = memberShippingFee + guestShippingFee
    const totalMargin = totalProductMargin - totalShippingFee
    const totalItemRevenue = memberTotalRevenue + guestTotalRevenue
    const marginRate = totalItemRevenue > 0 ? Math.round((totalMargin / totalItemRevenue) * 1000) / 10 : 0

    // 이전 기간 마진 계산 (비교용)
    let prevProductMargin = 0
    let prevShippingFee = 0
    for (const order of previousMemberOrders) {
      prevShippingFee += calculateOrderShippingFee(order.items)
      for (const item of order.items) {
        const unitPrice = Number(item.unitPrice)
        const wholesalePrice = (item as unknown as { wholesalePrice?: number }).wholesalePrice || 0
        prevProductMargin += (unitPrice - wholesalePrice) * item.quantity
      }
    }
    for (const order of previousGuestOrders) {
      prevShippingFee += calculateOrderShippingFee(order.items)
      for (const item of order.items) {
        const unitPrice = Number(item.unitPrice)
        const wholesalePrice = (item as unknown as { wholesalePrice?: number }).wholesalePrice || 0
        prevProductMargin += (unitPrice - wholesalePrice) * item.quantity
      }
    }
    const prevTotalMargin = prevProductMargin - prevShippingFee

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
      marginRate: {
        value: marginRate,
        change: 0, // 마진율 변화는 복잡하므로 일단 0
      },
      totalMargin: {
        value: totalMargin,
        change: calculateChange(totalMargin, prevTotalMargin),
      },
    }

    // === 매출 추이 차트 (회원 + 비회원) ===
    const revenueByDay = new Map<string, number>()

    // 기간 내 모든 날짜 초기화
    for (let i = 0; i < days; i++) {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      revenueByDay.set(formatDate(date), 0)
    }

    // 회원 주문 데이터로 매출 집계
    for (const order of currentMemberOrders) {
      const dateKey = formatDate(order.orderedAt)
      const current = revenueByDay.get(dateKey) || 0
      revenueByDay.set(dateKey, current + Number(order.totalAmount))
    }

    // 비회원 주문 데이터로 매출 집계
    for (const order of currentGuestOrders) {
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

    // 회원 + 비회원 주문 상태 합산
    const statusCounts: Record<string, number> = {}
    for (const order of allMemberOrders) {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1
    }
    for (const order of allGuestOrders) {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1
    }

    const orderStatusChart = Object.entries(statusCounts)
      .filter(([_, count]) => count > 0)
      .map(([status, value]) => ({
        name: statusNames[status] || status,
        value,
        color: statusColors[status] || '#9CA3AF',
      }))

    // === 최근 주문 5건 (회원 + 비회원) ===
    // 회원 주문 조회
    const memberOrdersData = await prisma.order.findMany({
      where: {
        shop: { userId: user.userId },
      },
      include: {
        user: {
          select: { name: true },
        },
        shippingAddress: {
          select: { recipientName: true },
        },
      },
      orderBy: { orderedAt: 'desc' },
      take: 5,
    })

    // 비회원 주문 조회 (GuestOrder)
    const guestOrdersData = await prisma.guestOrder.findMany({
      where: {
        shop: { userId: user.userId },
      },
      include: {
        shippingAddress: {
          select: { recipientName: true },
        },
      },
      orderBy: { orderedAt: 'desc' },
      take: 5,
    })

    // 회원 주문 매핑
    const memberOrders = memberOrdersData.map(order => {
      const customerName = order.user?.name || order.shippingAddress?.recipientName || '미지정'
      const maskedName = customerName.length > 1
        ? customerName.substring(0, 1) + '*'.repeat(Math.min(customerName.length - 1, 2))
        : customerName

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customer: maskedName,
        amount: Number(order.totalAmount),
        status: order.status,
        time: formatRelativeTime(order.orderedAt),
        orderedAt: order.orderedAt,
        isGuest: false,
      }
    })

    // 비회원 주문 매핑
    const guestOrders = guestOrdersData.map(order => {
      const customerName = order.guestName || order.shippingAddress?.recipientName || '미지정'
      const maskedName = customerName.length > 1
        ? customerName.substring(0, 1) + '*'.repeat(Math.min(customerName.length - 1, 2))
        : customerName

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customer: maskedName,
        amount: Number(order.totalAmount),
        status: order.status,
        time: formatRelativeTime(order.orderedAt),
        orderedAt: order.orderedAt,
        isGuest: true,
      }
    })

    // 회원 + 비회원 주문 합쳐서 최신순 정렬 후 5건만
    const recentOrders = [...memberOrders, ...guestOrders]
      .sort((a, b) => b.orderedAt.getTime() - a.orderedAt.getTime())
      .slice(0, 5)
      .map(({ orderedAt, ...rest }) => rest) // orderedAt 필드 제거

    // === 인기 상품 TOP 5 (회원 + 비회원) ===
    const memberOrderItems = currentMemberOrders.flatMap(o => o.items)
    const guestOrderItems = currentGuestOrders.flatMap(o => o.items)

    const productSales: Record<string, { name: string; sales: number; revenue: number; thumbnailUrl: string | null }> = {}

    // 회원 주문 아이템 집계
    for (const item of memberOrderItems) {
      const key = item.productName
      if (!productSales[key]) {
        productSales[key] = {
          name: item.productName,
          sales: 0,
          revenue: 0,
          thumbnailUrl: item.thumbnailUrl,
        }
      }
      productSales[key].sales += item.quantity
      productSales[key].revenue += Number(item.totalPrice)
    }

    // 비회원 주문 아이템 집계
    for (const item of guestOrderItems) {
      const key = item.productName
      if (!productSales[key]) {
        productSales[key] = {
          name: item.productName,
          sales: 0,
          revenue: 0,
          thumbnailUrl: item.thumbnailUrl,
        }
      }
      productSales[key].sales += item.quantity
      productSales[key].revenue += Number(item.totalPrice)
    }

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

    // === 쇼핑몰별 매출 (회원 + 비회원) ===
    const shopColors = ['#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899']

    const shopRevenues: Record<number, { id: number; name: string; revenue: number }> = {}

    // 회원 주문으로 쇼핑몰별 매출 집계
    for (const order of currentMemberOrders) {
      const shopId = order.shopId || 0
      const shopName = order.shop?.name || '미분류'

      if (!shopRevenues[shopId]) {
        shopRevenues[shopId] = {
          id: shopId,
          name: shopName,
          revenue: 0,
        }
      }
      shopRevenues[shopId].revenue += Number(order.totalAmount)
    }

    // 비회원 주문으로 쇼핑몰별 매출 집계
    for (const order of currentGuestOrders) {
      const shopId = order.shopId || 0
      const shopName = order.shop?.name || '미분류'

      if (!shopRevenues[shopId]) {
        shopRevenues[shopId] = {
          id: shopId,
          name: shopName,
          revenue: 0,
        }
      }
      shopRevenues[shopId].revenue += Number(order.totalAmount)
    }

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
