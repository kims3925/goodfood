export const dynamic = 'force-dynamic'

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
    const wholesaleChannelId = searchParams.get('wholesaleChannelId')

    // 날짜 필터 없이 발주 대기(PAID, PREPARING) 상태의 모든 주문 조회

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
    // 발주 대기(PAID, PREPARING) 상태의 주문만 조회
    const memberOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: ['PAID', 'PREPARING'] },
          paidAt: { not: null },
        },
        shopProduct: {
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
        shopProduct: {
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
    // 발주 대기(PAID, PREPARING) 상태의 주문만 조회
    const guestOrderItems = await prisma.guestOrderItem.findMany({
      where: {
        guestOrder: {
          status: { in: ['PAID', 'PREPARING'] },
          paidAt: { not: null },
        },
        shopProduct: {
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
        shopProduct: {
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
      const channel = item.shopProduct?.product?.channel
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
      const channel = item.shopProduct?.product?.channel
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

    // 이제 모든 발주 대기 주문을 표시하므로 누락 경고 불필요

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
  shopProduct?: {
    product?: {
      variants?: { optionSummary: string | null; wholesalePrice: unknown }[]
    } | null
  } | null
}): number {
  let wholesalePrice = Number(item.variant?.wholesalePrice || 0)

  // variantId가 null인 경우 Product의 variants에서 찾기
  if (!item.variant && item.shopProduct?.product?.variants?.length) {
    if (item.optionSummary) {
      const matchedVariant = item.shopProduct.product.variants.find(
        v => v.optionSummary === item.optionSummary
      )
      if (matchedVariant) {
        wholesalePrice = Number(matchedVariant.wholesalePrice || 0)
      }
    }
    if (wholesalePrice === 0) {
      wholesalePrice = Number(item.shopProduct.product.variants[0].wholesalePrice || 0)
    }
  }

  return wholesalePrice
}
