import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/admin/wholesale-orders/summary
 * 도매처별 발주 집계 조회 (회원 + 비회원 주문 통합)
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

    // 도매처별 집계 맵
    const wholesaleSummaryMap = new Map<number, {
      wholesaleChannelId: number
      wholesaleChannelName: string
      wholesaleChannelCoverUrl: string | null
      totalOrders: Set<string> // orderNumber로 중복 제거
      totalQuantity: number
      totalAmount: number
    }>()

    // 공통 쿼리 조건 (도매처 필터) - Product.channelId가 도매처를 가리킴
    const channelFilter = wholesaleChannelId ? { id: parseInt(wholesaleChannelId) } : undefined

    // 1. 회원 주문 (Order + OrderItem) 조회 - Product.channelId 사용 (소싱 출처)
    // PAID, PREPARING 상태만 조회 (배송 시작 전 = 발주 대상)
    const memberOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: ['PAID', 'PREPARING'] },
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
        },
        publishedProduct: {
          userId: user.userId,
          product: {
            channel: {
              kind: 'WHOLESALE',
              ...channelFilter,
            },
          },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
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
        variant: {
          select: {
            id: true,
            wholesalePrice: true,
          },
        },
      },
    })

    // 2. 비회원 주문 (GuestOrder + GuestOrderItem) 조회 - Product.channelId 사용 (소싱 출처)
    // PAID, PREPARING 상태만 조회 (배송 시작 전 = 발주 대상)
    const guestOrderItems = await prisma.guestOrderItem.findMany({
      where: {
        guestOrder: {
          status: { in: ['PAID', 'PREPARING'] },
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
        },
        publishedProduct: {
          userId: user.userId,
          product: {
            channel: {
              kind: 'WHOLESALE',
              ...channelFilter,
            },
          },
        },
      },
      include: {
        guestOrder: {
          select: {
            id: true,
            orderNumber: true,
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
        variant: {
          select: {
            id: true,
            wholesalePrice: true,
          },
        },
      },
    })

    // 회원 주문 집계
    for (const item of memberOrderItems) {
      const channel = item.publishedProduct?.product?.channel
      if (!channel || channel.kind !== 'WHOLESALE') continue

      const wholesalePrice = getWholesalePrice(item)
      const itemAmount = Number(wholesalePrice) * item.quantity

      if (!wholesaleSummaryMap.has(channel.id)) {
        wholesaleSummaryMap.set(channel.id, {
          wholesaleChannelId: channel.id,
          wholesaleChannelName: channel.name,
          wholesaleChannelCoverUrl: channel.coverUrl,
          totalOrders: new Set(),
          totalQuantity: 0,
          totalAmount: 0,
        })
      }

      const summary = wholesaleSummaryMap.get(channel.id)!
      summary.totalOrders.add(`member_${item.order.orderNumber}`)
      summary.totalQuantity += item.quantity
      summary.totalAmount += itemAmount
    }

    // 비회원 주문 집계
    for (const item of guestOrderItems) {
      const channel = item.publishedProduct?.product?.channel
      if (!channel || channel.kind !== 'WHOLESALE') continue

      const wholesalePrice = getWholesalePrice(item)
      const itemAmount = Number(wholesalePrice) * item.quantity

      if (!wholesaleSummaryMap.has(channel.id)) {
        wholesaleSummaryMap.set(channel.id, {
          wholesaleChannelId: channel.id,
          wholesaleChannelName: channel.name,
          wholesaleChannelCoverUrl: channel.coverUrl,
          totalOrders: new Set(),
          totalQuantity: 0,
          totalAmount: 0,
        })
      }

      const summary = wholesaleSummaryMap.get(channel.id)!
      summary.totalOrders.add(`guest_${item.guestOrder.orderNumber}`)
      summary.totalQuantity += item.quantity
      summary.totalAmount += itemAmount
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

// 도매가 추출 헬퍼 함수
function getWholesalePrice(item: {
  variant?: { wholesalePrice: unknown } | null
  optionSummary?: string | null
  publishedProduct?: {
    product?: {
      variants?: { optionSummary: string | null; wholesalePrice: unknown }[]
    } | null
  } | null
}): number {
  let wholesalePrice = Number(item.variant?.wholesalePrice || 0)

  // variantId가 null인 경우 Product의 variants에서 찾기
  if (!item.variant && item.publishedProduct?.product?.variants?.length) {
    if (item.optionSummary) {
      const matchedVariant = item.publishedProduct.product.variants.find(
        v => v.optionSummary === item.optionSummary
      )
      if (matchedVariant) {
        wholesalePrice = Number(matchedVariant.wholesalePrice || 0)
      }
    }
    if (wholesalePrice === 0) {
      wholesalePrice = Number(item.publishedProduct.product.variants[0].wholesalePrice || 0)
    }
  }

  return wholesalePrice
}
