import { NextRequest, NextResponse } from 'next/server'
import { prisma, ChannelKind } from '@bandauto/db'
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
    const channelId = searchParams.get('channelId')

    // 소매 채널 조회 (RETAIL kind만)
    const channelWhere: any = {
      userId: user.userId,
      isActive: true,
      kind: ChannelKind.RETAIL,
    }
    if (channelId) {
      channelWhere.id = parseInt(channelId)
    }

    const channels = await prisma.channel.findMany({
      where: channelWhere,
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
    const channelDataMap = new Map<number, {
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
    for (const channel of channels) {
      channelDataMap.set(channel.id, {
        id: channel.id,
        name: channel.name,
        coverUrl: channel.coverUrl,
        platform: channel.platform || channel.apiConfig?.platform || 'BAND',
        items: [],
        itemCount: 0,
        shopCount: 0,
        webhookCount: 0,
        totalQuantity: 0,
        totalAmount: 0,
      })
    }

    // 쇼핑몰 주문 조회 (Order + OrderItem + PublishedProduct)
    const shopOrders = await prisma.order.findMany({
      where: {
        userId: user.userId,
        status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        ...(Object.keys(dateFilter).length > 0 ? { orderedAt: dateFilter } : {}),
      },
      include: {
        items: {
          include: {
            publishedProduct: {
              include: {
                channel: true,
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

    // 미분류 주문 (PublishedProduct의 channelId가 없는 경우)
    const unclassifiedItems: any[] = []

    // 쇼핑몰 주문 아이템 처리
    for (const order of shopOrders) {
      for (const item of order.items) {
        const itemChannelId = item.publishedProduct?.channelId

        if (!itemChannelId) {
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
            channelId: null,
            channelName: null,
          })
          continue
        }

        const channelData = channelDataMap.get(itemChannelId)
        if (!channelData) continue

        // 플랫폼 필터
        if (platform && channelData.platform !== platform) continue

        const thumbnailUrl = item.thumbnailUrl ||
          item.publishedProduct?.product?.collectedProduct?.post?.images?.[0]?.imageUrl || null

        channelData.items.push({
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
          channelId: itemChannelId,
          channelName: channelData.name,
        })

        channelData.itemCount++
        channelData.shopCount++
        channelData.totalQuantity += item.quantity
        channelData.totalAmount += Number(item.totalPrice)
      }
    }

    // 결과 정리
    const channelDataArray = Array.from(channelDataMap.values()).filter(c => c.itemCount > 0)

    // 플랫폼별 그룹핑
    const platformGroups = new Map<string, {
      platform: string
      platformName: string
      channels: typeof channelDataArray
      itemCount: number
      totalQuantity: number
      totalAmount: number
    }>()

    for (const channel of channelDataArray) {
      if (!platformGroups.has(channel.platform)) {
        platformGroups.set(channel.platform, {
          platform: channel.platform,
          platformName: channel.platform === 'BAND' ? '네이버 밴드' :
                        channel.platform === 'ALIEXPRESS' ? '알리익스프레스' :
                        channel.platform === 'SHOP' ? '쇼핑몰' : channel.platform,
          channels: [],
          itemCount: 0,
          totalQuantity: 0,
          totalAmount: 0,
        })
      }

      const group = platformGroups.get(channel.platform)!
      group.channels.push(channel)
      group.itemCount += channel.itemCount
      group.totalQuantity += channel.totalQuantity
      group.totalAmount += channel.totalAmount
    }

    // 플랫폼 필터 적용
    let platforms = Array.from(platformGroups.values())
    if (platform) {
      platforms = platforms.filter(p => p.platform === platform)
    }

    // 통계 계산
    const summary = {
      totalItems: channelDataArray.reduce((sum, c) => sum + c.itemCount, 0) + unclassifiedItems.length,
      totalQuantity: channelDataArray.reduce((sum, c) => sum + c.totalQuantity, 0) +
                     unclassifiedItems.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: channelDataArray.reduce((sum, c) => sum + c.totalAmount, 0) +
                   unclassifiedItems.reduce((sum, i) => sum + i.totalPrice, 0),
      classifiedItems: channelDataArray.reduce((sum, c) => sum + c.itemCount, 0),
      classifiedAmount: channelDataArray.reduce((sum, c) => sum + c.totalAmount, 0),
      shopCount: channelDataArray.reduce((sum, c) => sum + c.shopCount, 0) + unclassifiedItems.length,
      webhookCount: 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        platforms,
        channels: channelDataArray,
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
    const { channelId, periodStart, periodEnd, memo } = body

    if (!channelId || !periodStart || !periodEnd) {
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
        publishedProduct: {
          channelId: parseInt(channelId),
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
        channelId: parseInt(channelId),
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
