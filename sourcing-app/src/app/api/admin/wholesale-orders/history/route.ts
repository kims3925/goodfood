import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/admin/wholesale-orders/history
 * 도매처별 발주 이력 조회 (일별 집계)
 */
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
    const wholesaleChannelId = searchParams.get('wholesaleChannelId')
    const from = searchParams.get('from') // YYYY-MM-DD
    const to = searchParams.get('to') // YYYY-MM-DD

    // 도매처 목록 조회
    const wholesaleChannels = await prisma.channel.findMany({
      where: {
        userId: user.userId,
        kind: 'WHOLESALE',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        coverUrl: true,
      },
      orderBy: { name: 'asc' },
    })

    // 도매처가 선택되지 않은 경우 목록만 반환
    if (!wholesaleChannelId) {
      return NextResponse.json({
        success: true,
        channels: wholesaleChannels,
        history: [],
      })
    }

    // 기간 설정 (기본: 최근 30일)
    const now = new Date()
    const fromDate = from ? new Date(from) : new Date(now.setDate(now.getDate() - 30))
    fromDate.setHours(0, 0, 0, 0)
    const toDate = to ? new Date(to) : new Date()
    toDate.setHours(23, 59, 59, 999)

    // 해당 도매처의 발주 데이터 조회
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
        },
        publishedProduct: {
          userId: user.userId,
          product: {
            collectedProduct: {
              post: {
                channel: {
                  id: parseInt(wholesaleChannelId),
                  kind: 'WHOLESALE',
                },
              },
            },
          },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            paidAt: true,
          },
        },
        variant: {
          select: {
            wholesalePrice: true,
          },
        },
        publishedProduct: {
          include: {
            product: {
              include: {
                variants: {
                  select: {
                    optionSummary: true,
                    wholesalePrice: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // 일별 집계
    const dailyMap = new Map<string, {
      date: string
      orderCount: Set<number>
      itemCount: number
      totalQuantity: number
      totalAmount: number
    }>()

    for (const item of orderItems) {
      if (!item.order.paidAt) continue

      const dateKey = item.order.paidAt.toISOString().split('T')[0]

      // 도매가 계산
      let wholesalePrice = item.variant?.wholesalePrice || 0
      if (!item.variant && item.publishedProduct?.product?.variants?.length) {
        if (item.optionSummary) {
          const matched = item.publishedProduct.product.variants.find(
            v => v.optionSummary === item.optionSummary
          )
          if (matched) {
            wholesalePrice = matched.wholesalePrice || 0
          }
        }
        if (Number(wholesalePrice) === 0) {
          wholesalePrice = item.publishedProduct.product.variants[0].wholesalePrice || 0
        }
      }

      const itemAmount = Number(wholesalePrice) * item.quantity

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          orderCount: new Set(),
          itemCount: 0,
          totalQuantity: 0,
          totalAmount: 0,
        })
      }

      const daily = dailyMap.get(dateKey)!
      daily.orderCount.add(item.order.id)
      daily.itemCount += 1
      daily.totalQuantity += item.quantity
      daily.totalAmount += itemAmount
    }

    // 배열로 변환하고 날짜순 정렬
    const history = Array.from(dailyMap.values())
      .map(d => ({
        date: d.date,
        orderCount: d.orderCount.size,
        itemCount: d.itemCount,
        totalQuantity: d.totalQuantity,
        totalAmount: d.totalAmount,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))

    // 전체 합계
    const summary = history.reduce(
      (acc, d) => ({
        totalOrders: acc.totalOrders + d.orderCount,
        totalItems: acc.totalItems + d.itemCount,
        totalQuantity: acc.totalQuantity + d.totalQuantity,
        totalAmount: acc.totalAmount + d.totalAmount,
      }),
      { totalOrders: 0, totalItems: 0, totalQuantity: 0, totalAmount: 0 }
    )

    return NextResponse.json({
      success: true,
      channels: wholesaleChannels,
      selectedChannel: wholesaleChannels.find(c => c.id === parseInt(wholesaleChannelId)),
      history,
      summary,
      period: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
    })
  } catch (error) {
    console.error('도매처 발주 이력 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '발주 이력 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
