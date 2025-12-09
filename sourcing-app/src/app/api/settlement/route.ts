import { NextRequest, NextResponse } from 'next/server'
import { prisma, ChannelKind } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 정산 데이터 조회 (Shop별 집계)
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const shopId = searchParams.get('shopId')

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

    // Shop 목록 조회 (연결된 Channel 포함)
    const shopWhere: any = {
      userId: user.userId,
      isActive: true,
    }
    if (shopId) {
      shopWhere.id = parseInt(shopId)
    }

    const shops = await prisma.shop.findMany({
      where: shopWhere,
      include: {
        theme: {
          select: { logoUrl: true },
        },
        channels: {
          where: {
            kind: ChannelKind.RETAIL,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            platform: true,
          },
        },
      },
    })

    // Shop별 데이터 맵 초기화
    const shopDataMap = new Map<number, {
      id: number
      name: string
      subdomain: string
      coverUrl: string | null
      logoUrl: string | null
      channelId: number | null  // 연결된 소매 채널 ID (정산용)
      channelName: string | null
      items: any[]
      itemCount: number
      totalQuantity: number
      totalAmount: number
    }>()

    for (const shop of shops) {
      const retailChannel = shop.channels[0] // 첫 번째 소매 채널 사용
      shopDataMap.set(shop.id, {
        id: shop.id,
        name: shop.name,
        subdomain: shop.subdomain,
        coverUrl: shop.coverUrl,
        logoUrl: shop.theme?.logoUrl || null,
        channelId: retailChannel?.id || null,
        channelName: retailChannel?.name || null,
        items: [],
        itemCount: 0,
        totalQuantity: 0,
        totalAmount: 0,
      })
    }

    // 이미 정산된 주문 아이템 ID 조회 (중복 방지)
    const existingSettlementItems = await prisma.settlementItem.findMany({
      where: {
        settlement: {
          userId: user.userId,
          status: { not: 'CANCELLED' },
        },
      },
      select: { orderItemId: true },
    })
    const settledOrderItemIds = new Set(existingSettlementItems.map(i => i.orderItemId))

    // 쇼핑몰 주문 조회 (Shop별로 그룹화)
    // Shop 소유자의 주문을 조회 (Order.userId는 주문한 고객, Shop.userId가 소유자)
    const shopOrders = await prisma.order.findMany({
      where: {
        shop: { userId: user.userId },  // Shop 소유자 기준으로 필터링
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        shopId: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { orderedAt: dateFilter } : {}),
      },
      include: {
        shop: {
          select: { id: true, name: true, subdomain: true },
        },
        items: {
          include: {
            publishedProduct: {
              include: {
                product: {
                  include: {
                    collectedProduct: {
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
        },
      },
      orderBy: { orderedAt: 'desc' },
    })

    // 미분류 주문 (shopId가 없는 경우)
    const unclassifiedItems: any[] = []

    // 쇼핑몰 주문 아이템 처리
    for (const order of shopOrders) {
      const orderShopId = order.shopId

      if (!orderShopId) {
        // shopId가 없는 주문은 미분류
        for (const item of order.items) {
          // 이미 정산된 아이템 제외
          if (settledOrderItemIds.has(item.id)) continue

          unclassifiedItems.push({
            id: item.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.shippingAddress?.recipientName || '알 수 없음',
            productName: item.productName,
            thumbnailUrl: item.thumbnailUrl || null,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            status: order.status,
            orderedAt: order.orderedAt.toISOString(),
            shopId: null,
            shopName: null,
          })
        }
        continue
      }

      let shopData = shopDataMap.get(orderShopId)

      // Shop이 맵에 없으면 (다른 유저의 Shop이거나 비활성화된 경우) 새로 추가
      if (!shopData && order.shop) {
        shopData = {
          id: order.shop.id,
          name: order.shop.name,
          subdomain: order.shop.subdomain,
          coverUrl: null,
          logoUrl: null,
          channelId: null,
          channelName: null,
          items: [],
          itemCount: 0,
          totalQuantity: 0,
          totalAmount: 0,
        }
        shopDataMap.set(orderShopId, shopData)
      }

      if (!shopData) continue

      for (const item of order.items) {
        // 이미 정산된 아이템 제외
        if (settledOrderItemIds.has(item.id)) continue

        const thumbnailUrl = item.thumbnailUrl ||
          item.publishedProduct?.product?.collectedProduct?.post?.images?.[0]?.url || null

        shopData.items.push({
          id: item.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.shippingAddress?.recipientName || '알 수 없음',
          productName: item.productName,
          thumbnailUrl,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          status: order.status,
          orderedAt: order.orderedAt.toISOString(),
          shopId: orderShopId,
          shopName: shopData.name,
        })

        shopData.itemCount++
        shopData.totalQuantity += item.quantity
        shopData.totalAmount += Number(item.totalPrice)
      }
    }

    // 결과 정리 (주문이 있는 Shop만)
    const shopDataArray = Array.from(shopDataMap.values()).filter(s => s.itemCount > 0)

    // 통계 계산
    const summary = {
      totalItems: shopDataArray.reduce((sum, s) => sum + s.itemCount, 0) + unclassifiedItems.length,
      totalQuantity: shopDataArray.reduce((sum, s) => sum + s.totalQuantity, 0) +
                     unclassifiedItems.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: shopDataArray.reduce((sum, s) => sum + s.totalAmount, 0) +
                   unclassifiedItems.reduce((sum, i) => sum + i.totalPrice, 0),
      classifiedItems: shopDataArray.reduce((sum, s) => sum + s.itemCount, 0),
      classifiedAmount: shopDataArray.reduce((sum, s) => sum + s.totalAmount, 0),
      shopCount: shopDataArray.length,
    }

    return NextResponse.json({
      success: true,
      data: {
        shops: shopDataArray,
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

// POST: 정산 생성 (Shop 기준)
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
    const { shopId, periodStart, periodEnd, memo } = body

    if (!shopId) {
      return NextResponse.json(
        { success: false, error: '쇼핑몰 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // Shop 소유권 확인
    const shop = await prisma.shop.findFirst({
      where: {
        id: parseInt(shopId),
        userId: user.userId,
      },
    })

    if (!shop) {
      return NextResponse.json(
        { success: false, error: '쇼핑몰을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 날짜 필터 설정 (없으면 전체 기간)
    const filterStart = periodStart ? new Date(periodStart) : undefined
    const filterEnd = periodEnd ? new Date(periodEnd) : undefined
    if (filterEnd) filterEnd.setHours(23, 59, 59, 999)

    // 이미 정산된 주문 아이템 ID 조회 (중복 방지)
    const existingSettlementItems = await prisma.settlementItem.findMany({
      where: {
        settlement: {
          userId: user.userId,
          shopId: parseInt(shopId),
          status: { not: 'CANCELLED' },
        },
      },
      select: { orderItemId: true },
    })
    const settledOrderItemIds = new Set(existingSettlementItems.map(i => i.orderItemId))

    // Shop 기준 주문 조회 (아직 정산되지 않은 주문만)
    // Shop 소유권은 위에서 이미 확인됨, Order.userId는 주문한 고객이므로 제거
    const orders = await prisma.order.findMany({
      where: {
        shopId: parseInt(shopId),
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        ...(filterStart || filterEnd ? {
          orderedAt: {
            ...(filterStart ? { gte: filterStart } : {}),
            ...(filterEnd ? { lte: filterEnd } : {}),
          }
        } : {}),
      },
      include: {
        items: true,
      },
      orderBy: { orderedAt: 'asc' },
    })

    // 정산 대상 주문 아이템 필터링 (이미 정산된 아이템 제외)
    const settlementItems: Array<{
      orderItemId: number
      orderId: number
      quantity: number
      unitPrice: number
      totalPrice: number
    }> = []

    for (const order of orders) {
      for (const item of order.items) {
        if (!settledOrderItemIds.has(item.id)) {
          settlementItems.push({
            orderItemId: item.id,
            orderId: order.id,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
          })
        }
      }
    }

    if (settlementItems.length === 0) {
      return NextResponse.json(
        { success: false, error: '정산할 주문이 없습니다. 해당 기간에 새로운 주문이 없거나 이미 정산되었습니다.' },
        { status: 400 }
      )
    }

    // 실제 정산 기간 계산 (포함된 주문들의 날짜 범위)
    const includedOrderIds = new Set(settlementItems.map(item => item.orderId))
    const includedOrders = orders.filter(o => includedOrderIds.has(o.id))
    const actualPeriodStart = includedOrders.length > 0
      ? includedOrders[0].orderedAt
      : new Date()
    const actualPeriodEnd = includedOrders.length > 0
      ? includedOrders[includedOrders.length - 1].orderedAt
      : new Date()

    const totalOrders = settlementItems.length
    const totalAmount = settlementItems.reduce((sum, item) => sum + item.totalPrice, 0)

    // 트랜잭션으로 정산 및 정산 아이템 생성
    const settlement = await prisma.$transaction(async (tx) => {
      // 정산 생성 (자동 완료 처리)
      const newSettlement = await tx.settlement.create({
        data: {
          userId: user.userId,
          shopId: parseInt(shopId),
          periodStart: actualPeriodStart,
          periodEnd: actualPeriodEnd,
          totalOrders,
          totalAmount,
          memo: memo || null,
          status: 'COMPLETED',
          settledAt: new Date(),
        },
      })

      // 정산 아이템 생성
      await tx.settlementItem.createMany({
        data: settlementItems.map(item => ({
          settlementId: newSettlement.id,
          orderItemId: item.orderItemId,
          orderId: item.orderId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      })

      return newSettlement
    })

    return NextResponse.json({
      success: true,
      data: {
        id: settlement.id,
        shopId: settlement.shopId,
        periodStart: settlement.periodStart.toISOString(),
        periodEnd: settlement.periodEnd.toISOString(),
        totalOrders: settlement.totalOrders,
        totalAmount: Number(settlement.totalAmount),
        status: settlement.status,
        memo: settlement.memo,
        message: '정산이 생성되었습니다.',
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
