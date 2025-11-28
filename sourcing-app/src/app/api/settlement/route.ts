import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 정산 데이터 조회 (Order 집계)
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
    const platform = searchParams.get('platform')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const retailBandId = searchParams.get('retailBandId')

    // 소매밴드 조회
    const retailBandWhere: any = {
      userId: user.userId,
      isActive: true,
    }
    if (retailBandId) {
      retailBandWhere.id = parseInt(retailBandId)
    }

    const retailBands = await prisma.retailBand.findMany({
      where: retailBandWhere,
      include: {
        apiConfig: true,
      },
    })

    // 날짜 필터
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    // 결과 데이터 구성
    const retailBandDataMap = new Map<number, {
      id: number
      name: string
      coverUrl: string | null
      platform: string
      items: any[]
      itemCount: number
      shopCount: number
      webhookCount: number
      totalQuantity: number
      totalAmount: number
    }>()

    // 초기화
    for (const band of retailBands) {
      retailBandDataMap.set(band.id, {
        id: band.id,
        name: band.name,
        coverUrl: band.coverUrl,
        platform: band.apiConfig?.platform || 'BAND',
        items: [],
        itemCount: 0,
        shopCount: 0,
        webhookCount: 0,
        totalQuantity: 0,
        totalAmount: 0,
      })
    }

    // 쇼핑몰 주문 조회 (Order + OrderItem + ProductPublish)
    const shopOrders = await prisma.order.findMany({
      where: {
        userId: user.userId,
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        ...(Object.keys(dateFilter).length > 0 ? { orderedAt: dateFilter } : {}),
      },
      include: {
        items: {
          include: {
            productPublish: {
              include: {
                retailBand: true,
                product: {
                  include: {
                    post: {
                      include: {
                        images: { take: 1, orderBy: { sortOrder: 'asc' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    })

    // 미분류 주문 (ProductPublish의 retailBandId가 없는 경우)
    const unclassifiedItems: any[] = []

    // 쇼핑몰 주문 아이템 처리
    for (const order of shopOrders) {
      for (const item of order.items) {
        const bandId = item.productPublish?.retailBandId

        if (!bandId) {
          // 미분류
          unclassifiedItems.push({
            id: item.id,
            orderId: order.id,
            channel: 'SHOP' as const,
            orderNumber: order.orderNumber,
            customerName: order.recipientName,
            productName: item.productName,
            thumbnailUrl: item.thumbnailUrl || null,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            status: order.status,
            orderedAt: order.orderedAt.toISOString(),
            retailBandId: null,
            retailBandName: null,
          })
          continue
        }

        const bandData = retailBandDataMap.get(bandId)
        if (!bandData) continue

        // 플랫폼 필터
        if (platform && bandData.platform !== platform) continue

        const thumbnailUrl = item.thumbnailUrl ||
          item.productPublish?.product?.post?.images?.[0]?.imageUrl || null

        bandData.items.push({
          id: item.id,
          orderId: order.id,
          channel: 'SHOP' as const,
          orderNumber: order.orderNumber,
          customerName: order.recipientName,
          productName: item.productName,
          thumbnailUrl,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          status: order.status,
          orderedAt: order.orderedAt.toISOString(),
          retailBandId: bandId,
          retailBandName: bandData.name,
        })

        bandData.itemCount++
        bandData.shopCount++
        bandData.totalQuantity += item.quantity
        bandData.totalAmount += Number(item.totalPrice)
      }
    }

    // 결과 정리
    const retailBandData = Array.from(retailBandDataMap.values()).filter(b => b.itemCount > 0)

    // 플랫폼별 그룹핑
    const platformGroups = new Map<string, {
      platform: string
      platformName: string
      retailBands: typeof retailBandData
      itemCount: number
      totalQuantity: number
      totalAmount: number
    }>()

    for (const band of retailBandData) {
      if (!platformGroups.has(band.platform)) {
        platformGroups.set(band.platform, {
          platform: band.platform,
          platformName: band.platform === 'BAND' ? '네이버 밴드' :
                        band.platform === 'ALIEXPRESS' ? '알리익스프레스' : band.platform,
          retailBands: [],
          itemCount: 0,
          totalQuantity: 0,
          totalAmount: 0,
        })
      }

      const group = platformGroups.get(band.platform)!
      group.retailBands.push(band)
      group.itemCount += band.itemCount
      group.totalQuantity += band.totalQuantity
      group.totalAmount += band.totalAmount
    }

    // 플랫폼 필터 적용
    let platforms = Array.from(platformGroups.values())
    if (platform) {
      platforms = platforms.filter(p => p.platform === platform)
    }

    // 통계 계산
    const summary = {
      totalItems: retailBandData.reduce((sum, b) => sum + b.itemCount, 0) + unclassifiedItems.length,
      totalQuantity: retailBandData.reduce((sum, b) => sum + b.totalQuantity, 0) +
                     unclassifiedItems.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: retailBandData.reduce((sum, b) => sum + b.totalAmount, 0) +
                   unclassifiedItems.reduce((sum, i) => sum + i.totalPrice, 0),
      classifiedItems: retailBandData.reduce((sum, b) => sum + b.itemCount, 0),
      classifiedAmount: retailBandData.reduce((sum, b) => sum + b.totalAmount, 0),
      shopCount: retailBandData.reduce((sum, b) => sum + b.shopCount, 0) + unclassifiedItems.length,
      webhookCount: 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        platforms,
        retailBands: retailBandData,
        unclassified: {
          items: unclassifiedItems,
          itemCount: unclassifiedItems.length,
          totalQuantity: unclassifiedItems.reduce((sum, i) => sum + i.quantity, 0),
          totalAmount: unclassifiedItems.reduce((sum, i) => sum + i.totalPrice, 0),
        },
        summary,
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

// POST: 정산 생성 (현재는 데이터만 반환)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { retailBandId, periodStart, periodEnd, memo } = body

    if (!retailBandId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 해당 기간의 주문 데이터 집계
    const start = new Date(periodStart)
    const end = new Date(periodEnd)
    end.setHours(23, 59, 59, 999)

    // 쇼핑몰 주문
    const shopOrderItems = await prisma.orderItem.findMany({
      where: {
        productPublish: {
          retailBandId: parseInt(retailBandId),
          userId: user.userId,
        },
        order: {
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          orderedAt: { gte: start, lte: end },
        },
      },
    })

    const totalOrders = shopOrderItems.length
    const totalAmount = shopOrderItems.reduce((sum, item) => sum + Number(item.totalPrice), 0)

    // 현재는 Settlement 테이블이 없으므로 계산된 데이터만 반환
    return NextResponse.json({
      success: true,
      data: {
        retailBandId: parseInt(retailBandId),
        periodStart,
        periodEnd,
        totalOrders,
        totalAmount,
        memo,
        message: '정산 데이터가 계산되었습니다.',
      },
    })
  } catch (error) {
    console.error('정산 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '정산 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
