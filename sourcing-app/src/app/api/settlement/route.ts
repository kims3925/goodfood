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

    // 쇼핑몰 주문 조회 (Shop별로 그룹화)
    const shopOrders = await prisma.order.findMany({
      where: {
        userId: user.userId,
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
          unclassifiedItems.push({
            id: item.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.recipientName,
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
        const thumbnailUrl = item.thumbnailUrl ||
          item.publishedProduct?.product?.collectedProduct?.post?.images?.[0]?.url || null

        shopData.items.push({
          id: item.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.recipientName,
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
    const { shopId, channelId, periodStart, periodEnd, memo } = body

    if (!shopId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 해당 기간의 주문 데이터 집계
    const start = new Date(periodStart)
    const end = new Date(periodEnd)
    end.setHours(23, 59, 59, 999)

    // Shop 기준 주문 조회
    const shopOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          userId: user.userId,
          shopId: parseInt(shopId),
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
        shopId: parseInt(shopId),
        channelId: channelId ? parseInt(channelId) : null,
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
