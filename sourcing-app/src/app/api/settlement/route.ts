import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@/lib/prisma'
import { SettlementStatus } from '@bandauto/db'

/**
 * GET /api/settlement
 *
 * 소매밴드별 주문 정산 데이터 조회
 *
 * Query Parameters:
 * - retailBandId?: number - 특정 소매밴드 필터
 * - startDate?: string - 시작 날짜 (YYYY-MM-DD)
 * - endDate?: string - 종료 날짜 (YYYY-MM-DD)
 *
 * Response:
 * - success: boolean
 * - data: {
 *     retailBands: Array<{
 *       id: number
 *       name: string
 *       orderCount: number
 *       totalAmount: number
 *       orders: Array<Order>
 *     }>
 *     summary: {
 *       totalOrders: number
 *       totalAmount: number
 *     }
 *   }
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 사용자의 소매밴드 목록 조회
    const retailBands = await prisma.retailBand.findMany({
      where: {
        userId,
        isActive: true,
        ...(retailBandId ? { id: parseInt(retailBandId) } : {}),
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

    // 발행 이력 조회 (상품 → 소매밴드 매핑)
    const publishHistories = await prisma.publishHistory.findMany({
      where: {
        userId,
        status: 'SUCCESS',
        ...(retailBandId ? { retailBandId: parseInt(retailBandId) } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { publishedAt: dateFilter } : {}),
      },
      include: {
        product: true,
        retailBand: true,
      },
    })

    // 발행된 상품 ID 목록
    const publishedProductIds = publishHistories.map(ph => ph.productId)

    // 주문서 조회 (발행된 상품과 매칭된 주문)
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        userId,
        productId: { in: publishedProductIds.length > 0 ? publishedProductIds : [-1] },
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      include: {
        product: {
          include: {
            publishHistories: {
              where: {
                status: 'SUCCESS',
              },
              include: {
                retailBand: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 소매밴드별로 주문 그룹화
    const retailBandMap = new Map<number, {
      id: number
      name: string
      coverUrl: string | null
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
        orders: [],
        orderCount: 0,
        totalAmount: 0,
      })
    })

    // 주문 분류
    orders.forEach(order => {
      if (!order.product?.publishHistories) return

      order.product.publishHistories.forEach(ph => {
        const bandData = retailBandMap.get(ph.retailBandId)
        if (bandData) {
          bandData.orders.push({
            id: order.id,
            productId: order.productId,
            productName: order.productName,
            matchedProductName: order.product?.name || null,
            thumbnailUrl: order.product?.thumbnailUrl || null,
            totalPrice: order.totalPrice,
            customerName: order.customerName,
            createdAt: order.createdAt,
          })
          bandData.orderCount++
          bandData.totalAmount += order.totalPrice || 0
        }
      })
    })

    // 미분류 주문 (발행되지 않은 상품의 주문)
    const unclassifiedOrders = await prisma.purchaseOrder.findMany({
      where: {
        userId,
        OR: [
          { productId: null },
          {
            product: {
              publishHistories: {
                none: {
                  status: 'SUCCESS',
                }
              }
            }
          }
        ],
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // 결과 정리
    const retailBandResults = Array.from(retailBandMap.values())
      .filter(band => band.orderCount > 0 || retailBandId)
      .sort((a, b) => b.totalAmount - a.totalAmount)

    // 전체 통계
    const totalOrders = retailBandResults.reduce((sum, b) => sum + b.orderCount, 0)
    const totalAmount = retailBandResults.reduce((sum, b) => sum + b.totalAmount, 0)

    return NextResponse.json({
      success: true,
      data: {
        retailBands: retailBandResults,
        unclassified: {
          orders: unclassifiedOrders.map(order => ({
            id: order.id,
            productId: order.productId,
            productName: order.productName,
            matchedProductName: order.product?.name || null,
            thumbnailUrl: order.product?.thumbnailUrl || null,
            totalPrice: order.totalPrice,
            customerName: order.customerName,
            createdAt: order.createdAt,
          })),
          orderCount: unclassifiedOrders.length,
          totalAmount: unclassifiedOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0),
        },
        summary: {
          totalOrders: totalOrders + unclassifiedOrders.length,
          totalAmount: totalAmount + unclassifiedOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0),
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

    // 해당 기간의 미정산 주문 조회
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        userId,
        retailBandId,
        createdAt: {
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
    const totalAmount = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0)

    const settlement = await prisma.settlement.create({
      data: {
        userId,
        retailBandId,
        periodStart: startDate,
        periodEnd: endDate,
        totalOrders: orders.length,
        totalAmount,
        status: 'PENDING',
        memo: memo || null,
        orders: {
          create: orders.map(order => ({
            purchaseOrderId: order.id,
            amount: order.totalPrice || 0,
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
