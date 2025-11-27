import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@/lib/prisma'

/**
 * GET /api/settlement
 *
 * 소싱처별/소매밴드별 주문 정산 데이터 조회
 *
 * Query Parameters:
 * - platform?: string - 소싱처 필터 (BAND, ALIEXPRESS)
 * - retailBandId?: number - 특정 소매밴드 필터
 * - startDate?: string - 시작 날짜 (YYYY-MM-DD)
 * - endDate?: string - 종료 날짜 (YYYY-MM-DD)
 * - dataSource?: string - 데이터 소스 ('order' | 'orderTest')
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
    const platform = searchParams.get('platform')
    const retailBandId = searchParams.get('retailBandId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const dataSource = searchParams.get('dataSource') || 'order' // 기본값: order

    // 사용자의 소매밴드 목록 조회 (소싱처 정보 포함)
    const retailBands = await prisma.retailBand.findMany({
      where: {
        userId,
        isActive: true,
        ...(retailBandId ? { id: parseInt(retailBandId) } : {}),
        ...(platform ? { apiConfig: { platform: platform as any } } : {}),
      },
      include: {
        apiConfig: {
          select: { platform: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    // 날짜 필터 설정
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    // 데이터 소스에 따라 다른 테이블 조회
    let orders: any[] = []

    if (dataSource === 'orderTest') {
      // OrderTest 테이블 (웹훅 주문)
      const orderTestData = await prisma.orderTest.findMany({
        where: {
          userId,
          retailBandId: retailBandId ? parseInt(retailBandId) : { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
        include: {
          retailBand: true,
          product: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      // OrderTest를 Order 형식으로 변환
      orders = orderTestData.map(ot => ({
        id: ot.id,
        retailBandId: ot.retailBandId,
        orderNumber: `WH-${ot.id.toString().padStart(6, '0')}`, // 웹훅 주문 번호
        recipientName: ot.customerName,
        totalAmount: ot.totalPrice || 0,
        status: 'WEBHOOK', // 웹훅 주문 상태
        orderedAt: ot.createdAt,
        items: [{
          productName: ot.productName,
          quantity: 1,
          totalPrice: ot.totalPrice || 0,
        }],
        retailBand: ot.retailBand,
      }))
    } else {
      // Order 테이블 (더미/실제 주문)
      const orderData = await prisma.order.findMany({
        where: {
          userId,
          retailBandId: retailBandId ? parseInt(retailBandId) : { not: null },
          ...(Object.keys(dateFilter).length > 0 ? { orderedAt: dateFilter } : {}),
        },
        include: {
          retailBand: true,
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { orderedAt: 'desc' },
      })

      orders = orderData
    }

    // 소매밴드별로 주문 그룹화 (소싱처 정보 포함)
    const retailBandMap = new Map<number, {
      id: number
      name: string
      coverUrl: string | null
      platform: string
      orders: any[]
      orderCount: number
      totalAmount: number
    }>()

    // 초기화
    retailBands.forEach(band => {
      retailBandMap.set(band.id, {
        id: band.id,
        name: band.name,
        coverUrl: band.coverUrl,
        platform: band.apiConfig?.platform || 'UNKNOWN',
        orders: [],
        orderCount: 0,
        totalAmount: 0,
      })
    })

    // 주문 분류
    orders.forEach(order => {
      if (!order.retailBandId) return

      const bandData = retailBandMap.get(order.retailBandId)
      if (bandData) {
        const totalAmount = Number(order.totalAmount) || 0
        bandData.orders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          recipientName: order.recipientName,
          totalAmount,
          status: order.status,
          orderedAt: order.orderedAt,
          items: order.items.map(item => ({
            productName: item.productName,
            quantity: item.quantity,
            totalPrice: Number(item.totalPrice),
          })),
        })
        bandData.orderCount++
        bandData.totalAmount += totalAmount
      }
    })

    // 미분류 주문 (소매밴드 없는 주문)
    let unclassifiedOrders: any[] = []

    if (dataSource === 'orderTest') {
      const unclassifiedTestOrders = await prisma.orderTest.findMany({
        where: {
          userId,
          retailBandId: null,
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        },
        orderBy: { createdAt: 'desc' },
      })

      unclassifiedOrders = unclassifiedTestOrders.map(ot => ({
        id: ot.id,
        orderNumber: `WH-${ot.id.toString().padStart(6, '0')}`,
        recipientName: ot.customerName,
        totalAmount: ot.totalPrice || 0,
        status: 'WEBHOOK',
        orderedAt: ot.createdAt,
      }))
    } else {
      const unclassifiedOrderData = await prisma.order.findMany({
        where: {
          userId,
          retailBandId: null,
          ...(Object.keys(dateFilter).length > 0 ? { orderedAt: dateFilter } : {}),
        },
        include: {
          items: true,
        },
        orderBy: { orderedAt: 'desc' },
      })

      unclassifiedOrders = unclassifiedOrderData.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        recipientName: order.recipientName,
        totalAmount: Number(order.totalAmount),
        status: order.status,
        orderedAt: order.orderedAt,
      }))
    }

    // 결과 정리
    const retailBandResults = Array.from(retailBandMap.values())
      .filter(band => band.orderCount > 0 || retailBandId)
      .sort((a, b) => b.totalAmount - a.totalAmount)

    // 소싱처별로 그룹화
    const platformGroups: Record<string, {
      platform: string
      platformName: string
      retailBands: typeof retailBandResults
      orderCount: number
      totalAmount: number
    }> = {}

    const platformNames: Record<string, string> = {
      BAND: '밴드',
      ALIEXPRESS: '알리익스프레스',
      UNKNOWN: '기타',
    }

    retailBandResults.forEach(band => {
      const platform = band.platform
      if (!platformGroups[platform]) {
        platformGroups[platform] = {
          platform,
          platformName: platformNames[platform] || platform,
          retailBands: [],
          orderCount: 0,
          totalAmount: 0,
        }
      }
      platformGroups[platform].retailBands.push(band)
      platformGroups[platform].orderCount += band.orderCount
      platformGroups[platform].totalAmount += band.totalAmount
    })

    // 전체 통계
    const totalOrders = retailBandResults.reduce((sum, b) => sum + b.orderCount, 0)
    const totalAmount = retailBandResults.reduce((sum, b) => sum + b.totalAmount, 0)

    return NextResponse.json({
      success: true,
      data: {
        platforms: Object.values(platformGroups).sort((a, b) => b.totalAmount - a.totalAmount),
        retailBands: retailBandResults,
        unclassified: {
          orders: unclassifiedOrders,
          orderCount: unclassifiedOrders.length,
          totalAmount: unclassifiedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        },
        dataSource, // 현재 데이터 소스 반환
        summary: {
          totalOrders: totalOrders + unclassifiedOrders.length,
          totalAmount: totalAmount + unclassifiedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
          classifiedOrders: totalOrders,
          classifiedAmount: totalAmount,
        },
      },
    })
  } catch (error) {
    console.error('정산 데이터 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settlement
 *
 * 정산 생성
 *
 * Body:
 * - retailBandId: number - 소매밴드 ID
 * - periodStart: string - 정산 시작일 (YYYY-MM-DD)
 * - periodEnd: string - 정산 종료일 (YYYY-MM-DD)
 * - memo?: string - 메모
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const body = await request.json()
    const { retailBandId, periodStart, periodEnd, memo } = body

    if (!retailBandId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { success: false, error: '소매밴드, 시작일, 종료일은 필수입니다.' },
        { status: 400 }
      )
    }

    const startDate = new Date(periodStart)
    const endDate = new Date(periodEnd)
    endDate.setHours(23, 59, 59, 999)

    // 소매밴드 확인
    const retailBand = await prisma.retailBand.findFirst({
      where: { id: retailBandId, userId },
    })

    if (!retailBand) {
      return NextResponse.json(
        { success: false, error: '소매밴드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 중복 정산 확인
    const existingSettlement = await prisma.settlement.findFirst({
      where: {
        userId,
        retailBandId,
        periodStart: startDate,
        periodEnd: endDate,
      },
    })

    if (existingSettlement) {
      return NextResponse.json(
        { success: false, error: '동일 기간의 정산이 이미 존재합니다.' },
        { status: 400 }
      )
    }

    // 해당 기간의 미정산 주문 조회 (Order 테이블 사용)
    const orders = await prisma.order.findMany({
      where: {
        userId,
        retailBandId,
        orderedAt: {
          gte: startDate,
          lte: endDate,
        },
        // 이미 정산된 주문 제외
        settlementOrders: {
          none: {},
        },
      },
    })

    if (orders.length === 0) {
      return NextResponse.json(
        { success: false, error: '해당 기간에 정산할 주문이 없습니다.' },
        { status: 400 }
      )
    }

    // 정산 생성
    const totalAmount = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)

    const settlement = await prisma.settlement.create({
      data: {
        userId,
        retailBandId,
        periodStart: startDate,
        periodEnd: endDate,
        totalOrders: orders.length,
        totalAmount: Math.round(totalAmount),
        status: 'PENDING',
        memo: memo || null,
        orders: {
          create: orders.map(order => ({
            orderId: order.id,
            amount: Math.round(Number(order.totalAmount)),
          })),
        },
      },
      include: {
        retailBand: {
          select: { id: true, name: true },
        },
        _count: {
          select: { orders: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `정산이 생성되었습니다. (${orders.length}건, ${totalAmount.toLocaleString()}원)`,
      data: settlement,
    })
  } catch (error) {
    console.error('정산 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
