import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/admin/wholesale-orders/summary
 * 도매처별 발주 집계 조회
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
    const from = searchParams.get('from') // YYYY-MM-DD
    const to = searchParams.get('to') // YYYY-MM-DD
    const wholesaleChannelId = searchParams.get('wholesaleChannelId')

    if (!from || !to) {
      return NextResponse.json(
        { success: false, error: '기간(from, to)은 필수입니다.' },
        { status: 400 }
      )
    }

    const fromDate = new Date(from)
    fromDate.setHours(0, 0, 0, 0)
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)

    // 결제 완료 이상 상태의 주문만 조회 (PAID, SHIPPED, DELIVERED)
    // 도매처 경로: OrderItem → PublishedProduct → Product → CollectedProduct → CollectedPost → Channel(WHOLESALE)
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
                  kind: 'WHOLESALE',
                  ...(wholesaleChannelId && { id: parseInt(wholesaleChannelId) }),
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
            orderedAt: true,
          },
        },
        publishedProduct: {
          include: {
            product: {
              include: {
                variants: {
                  select: {
                    id: true,
                    optionSummary: true,
                    wholesalePrice: true,
                  },
                },
                collectedProduct: {
                  include: {
                    post: {
                      include: {
                        channel: {
                          select: {
                            id: true,
                            name: true,
                            kind: true,
                            coverUrl: true,
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
        variant: {
          select: {
            id: true,
            wholesalePrice: true,
          },
        },
      },
    })

    // 도매처별 집계
    const wholesaleSummaryMap = new Map<number, {
      wholesaleChannelId: number
      wholesaleChannelName: string
      wholesaleChannelCoverUrl: string | null
      totalOrders: Set<number>
      totalQuantity: number
      totalAmount: number
      items: typeof orderItems
    }>()

    for (const item of orderItems) {
      const channel = item.publishedProduct?.product?.collectedProduct?.post?.channel
      if (!channel || channel.kind !== 'WHOLESALE') continue

      // variantId가 있으면 직접 조인된 variant 사용, 없으면 Product의 첫 번째 variant 사용
      let wholesalePrice = item.variant?.wholesalePrice || 0

      // variantId가 null인 경우 (기존 데이터) - Product의 variants에서 찾기
      if (!item.variant && item.publishedProduct?.product?.variants?.length) {
        // optionSummary로 매칭 시도
        if (item.optionSummary) {
          const matchedVariant = item.publishedProduct.product.variants.find(
            v => v.optionSummary === item.optionSummary
          )
          if (matchedVariant) {
            wholesalePrice = matchedVariant.wholesalePrice || 0
          }
        }
        // 매칭 안 되면 첫 번째 variant 사용
        if (Number(wholesalePrice) === 0) {
          wholesalePrice = item.publishedProduct.product.variants[0].wholesalePrice || 0
        }
      }

      const itemAmount = Number(wholesalePrice) * item.quantity

      if (!wholesaleSummaryMap.has(channel.id)) {
        wholesaleSummaryMap.set(channel.id, {
          wholesaleChannelId: channel.id,
          wholesaleChannelName: channel.name,
          wholesaleChannelCoverUrl: channel.coverUrl,
          totalOrders: new Set(),
          totalQuantity: 0,
          totalAmount: 0,
          items: [],
        })
      }

      const summary = wholesaleSummaryMap.get(channel.id)!
      summary.totalOrders.add(item.order.id)
      summary.totalQuantity += item.quantity
      summary.totalAmount += itemAmount
      summary.items.push(item)
    }

    // Map을 배열로 변환
    const summaries = Array.from(wholesaleSummaryMap.values()).map(s => ({
      wholesaleChannelId: s.wholesaleChannelId,
      wholesaleChannelName: s.wholesaleChannelName,
      wholesaleChannelCoverUrl: s.wholesaleChannelCoverUrl,
      totalOrders: s.totalOrders.size,
      totalQuantity: s.totalQuantity,
      totalAmount: s.totalAmount,
    })).sort((a, b) => b.totalAmount - a.totalAmount)

    return NextResponse.json({
      success: true,
      data: summaries,
    })
  } catch (error) {
    console.error('도매처 발주 집계 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '집계 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
