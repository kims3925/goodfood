import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

/**
 * 도매처 발주 데이터 조회 API (테스트용)
 *
 * 현재 스키마에서 도매처 추적 경로:
 * OrderItem → PublishedProduct → Product → CollectedProduct → CollectedPost → Channel(kind=WHOLESALE)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 1. 결제 완료된 주문의 OrderItem 조회 (도매처 정보 포함)
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: 'PAID',
          paidAt: { not: null },
          ...(startDate || endDate ? {
            orderedAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
            },
          } : {}),
        },
      },
      include: {
        order: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
            channel: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        publishedProduct: {
          include: {
            product: {
              include: {
                collectedProduct: {
                  include: {
                    post: {
                      include: {
                        channel: {
                          select: {
                            id: true,
                            name: true,
                            coverUrl: true,
                            kind: true,
                            platform: true,
                          },
                        },
                      },
                    },
                  },
                },
                variants: {
                  select: {
                    id: true,
                    wholesalePrice: true,
                  },
                },
              },
            },
          },
        },
        variant: {
          select: {
            id: true,
            wholesalePrice: true,
          },
        },
        referrerChannel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        order: {
          orderedAt: 'desc',
        },
      },
    })

    // 2. 도매처(WHOLESALE 채널)별로 그룹화
    const wholesaleChannelMap = new Map<number, {
      wholesaleChannelId: number
      wholesaleChannelName: string
      wholesaleChannelCoverUrl: string | null
      platform: string
      items: Array<{
        orderItemId: number
        orderId: number
        orderNumber: string
        orderedAt: string
        paidAt: string | null
        retailChannelId: number | null
        retailChannelName: string | null
        productId: number
        productName: string
        optionSummary: string | null
        thumbnailUrl: string | null
        quantity: number
        unitPrice: number
        totalPrice: number
        wholesalePrice: number | null
        wholesaleTotalPrice: number | null
        customerName: string
        orderStatus: string
      }>
      totalOrders: Set<number>
      totalItems: number
      totalQuantity: number
      totalRetailAmount: number
      totalWholesaleAmount: number
    }>()

    for (const item of orderItems) {
      // 도매처 채널 추적
      const wholesaleChannel = item.publishedProduct?.product?.collectedProduct?.post?.channel

      // WHOLESALE 채널이 아니면 스킵 (또는 별도 처리)
      if (!wholesaleChannel || wholesaleChannel.kind !== 'WHOLESALE') {
        continue
      }

      const channelId = wholesaleChannel.id

      // 도매가 결정: variant.wholesalePrice > product.variants[0].wholesalePrice > unitPrice
      let wholesalePrice: number | null = null
      if (item.variant?.wholesalePrice) {
        wholesalePrice = item.variant.wholesalePrice
      } else if (item.publishedProduct?.product?.variants?.[0]?.wholesalePrice) {
        wholesalePrice = item.publishedProduct.product.variants[0].wholesalePrice
      }

      const orderData = {
        orderItemId: item.id,
        orderId: item.orderId,
        orderNumber: item.order.orderNumber,
        orderedAt: item.order.orderedAt.toISOString(),
        paidAt: item.order.paidAt?.toISOString() || null,
        retailChannelId: item.referrerChannel?.id || item.order.channel?.id || null,
        retailChannelName: item.referrerChannel?.name || item.order.channel?.name || null,
        productId: item.publishedProduct?.product?.id || 0,
        productName: item.productName,
        optionSummary: item.optionSummary,
        thumbnailUrl: item.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        wholesalePrice: wholesalePrice,
        wholesaleTotalPrice: wholesalePrice ? wholesalePrice * item.quantity : null,
        customerName: item.order.user?.name || '고객',
        orderStatus: item.order.status,
      }

      if (wholesaleChannelMap.has(channelId)) {
        const existing = wholesaleChannelMap.get(channelId)!
        existing.items.push(orderData)
        existing.totalOrders.add(item.orderId)
        existing.totalItems++
        existing.totalQuantity += item.quantity
        existing.totalRetailAmount += Number(item.totalPrice)
        existing.totalWholesaleAmount += orderData.wholesaleTotalPrice || Number(item.totalPrice)
      } else {
        wholesaleChannelMap.set(channelId, {
          wholesaleChannelId: channelId,
          wholesaleChannelName: wholesaleChannel.name,
          wholesaleChannelCoverUrl: wholesaleChannel.coverUrl,
          platform: wholesaleChannel.platform,
          items: [orderData],
          totalOrders: new Set([item.orderId]),
          totalItems: 1,
          totalQuantity: item.quantity,
          totalRetailAmount: Number(item.totalPrice),
          totalWholesaleAmount: orderData.wholesaleTotalPrice || Number(item.totalPrice),
        })
      }
    }

    // 3. 응답 데이터 변환
    const wholesaleChannels = Array.from(wholesaleChannelMap.values()).map(channel => ({
      wholesaleChannelId: channel.wholesaleChannelId,
      wholesaleChannelName: channel.wholesaleChannelName,
      wholesaleChannelCoverUrl: channel.wholesaleChannelCoverUrl,
      platform: channel.platform,
      totalOrders: channel.totalOrders.size,
      totalItems: channel.totalItems,
      totalQuantity: channel.totalQuantity,
      totalRetailAmount: channel.totalRetailAmount,
      totalWholesaleAmount: channel.totalWholesaleAmount,
      items: channel.items,
    }))

    // 금액 순으로 정렬
    wholesaleChannels.sort((a, b) => b.totalWholesaleAmount - a.totalWholesaleAmount)

    // 4. 전체 요약
    const summary = {
      totalWholesaleChannels: wholesaleChannels.length,
      totalOrders: new Set(wholesaleChannels.flatMap(c => c.items.map(i => i.orderId))).size,
      totalItems: wholesaleChannels.reduce((sum, c) => sum + c.totalItems, 0),
      totalQuantity: wholesaleChannels.reduce((sum, c) => sum + c.totalQuantity, 0),
      totalRetailAmount: wholesaleChannels.reduce((sum, c) => sum + c.totalRetailAmount, 0),
      totalWholesaleAmount: wholesaleChannels.reduce((sum, c) => sum + c.totalWholesaleAmount, 0),
    }

    return NextResponse.json({
      success: true,
      data: {
        wholesaleChannels,
        summary,
      },
    })
  } catch (error) {
    console.error('도매처 발주 데이터 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '데이터 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
