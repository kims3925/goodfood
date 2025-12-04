/**
 * Referrer 기반 정산 테스트 API
 *
 * 현재 정산 방식(채널별)과 새로운 Referrer 기반 정산 방식의 실제 데이터 비교
 * - Order.referrerChannelId: 주문 전체 대표 referrer
 * - OrderItem.referrerChannelId: 상품별 정산용 referrer
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind } from '@bandauto/db'

export async function GET(req: NextRequest) {
  try {
    // 1. 활성 소매채널 목록 조회
    const channels = await prisma.channel.findMany({
      where: {
        isActive: true,
        kind: ChannelKind.RETAIL,
      },
      select: {
        id: true,
        name: true,
        platform: true,
        coverUrl: true,
        bankName: true,
        bankAccount: true,
        accountHolder: true,
      },
      orderBy: { name: 'asc' },
    })

    // 2. 현재 정산 방식: PublishedProduct.channelId 기준
    // OrderItem -> PublishedProduct -> Channel
    const currentSettlementRaw = await prisma.orderItem.groupBy({
      by: ['publishedProductId'],
      _count: { id: true },
      _sum: { totalPrice: true, quantity: true },
    })

    // PublishedProduct의 channelId를 가져와서 채널별로 집계
    const publishedProductIds = currentSettlementRaw.map(item => item.publishedProductId)
    const publishedProducts = await prisma.publishedProduct.findMany({
      where: { id: { in: publishedProductIds } },
      select: {
        id: true,
        channelId: true,
        channel: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    const ppChannelMap = new Map(publishedProducts.map(pp => [pp.id, pp]))

    // 채널별로 집계 (현재 방식)
    const channelSettlementMap = new Map<number | null, { orderCount: number; totalAmount: number; itemCount: number; productCount: number }>()

    for (const item of currentSettlementRaw) {
      const pp = ppChannelMap.get(item.publishedProductId)
      const channelId = pp?.channelId || null

      const existing = channelSettlementMap.get(channelId) || { orderCount: 0, totalAmount: 0, itemCount: 0, productCount: 0 }
      channelSettlementMap.set(channelId, {
        orderCount: existing.orderCount + 1,
        totalAmount: existing.totalAmount + Number(item._sum.totalPrice || 0),
        itemCount: existing.itemCount + (item._sum.quantity || 0),
        productCount: existing.productCount + 1,
      })
    }

    const currentSettlement = Array.from(channelSettlementMap.entries()).map(([channelId, data]) => {
      const channel = channels.find(c => c.id === channelId)
      return {
        channelId,
        channelName: channel?.name || (channelId === null ? '미지정' : `채널 #${channelId}`),
        ...data,
      }
    })

    // 3. 총 주문 및 금액 계산
    const orderStats = await prisma.order.aggregate({
      _count: { id: true },
      _sum: { totalAmount: true },
    })

    const totalOrders = orderStats._count.id || 0
    const totalAmount = Number(orderStats._sum.totalAmount || 0)

    // 4. Referrer 기반 정산 - Order 레벨 (주문 전체)
    const orderReferrerRaw = await prisma.order.groupBy({
      by: ['referrerChannelId'],
      _count: { id: true },
      _sum: { totalAmount: true },
    })

    const orderReferrerSettlement = orderReferrerRaw.map(item => {
      const channel = channels.find(c => c.id === item.referrerChannelId)
      const amount = Number(item._sum.totalAmount || 0)
      return {
        referrerChannelId: item.referrerChannelId,
        channelName: item.referrerChannelId === null
          ? '직접 접근 (자체 수익)'
          : (channel?.name || `채널 #${item.referrerChannelId}`),
        orderCount: item._count.id || 0,
        totalAmount: amount,
        percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      }
    })

    // 5. Referrer 기반 정산 - OrderItem 레벨 (상품별 정산)
    const orderItemReferrerRaw = await prisma.orderItem.groupBy({
      by: ['referrerChannelId'],
      _count: { id: true },
      _sum: { totalPrice: true, quantity: true },
    })

    const totalItemAmount = orderItemReferrerRaw.reduce((sum, item) => sum + Number(item._sum.totalPrice || 0), 0)

    const orderItemReferrerSettlement = orderItemReferrerRaw.map(item => {
      const channel = channels.find(c => c.id === item.referrerChannelId)
      const amount = Number(item._sum.totalPrice || 0)
      return {
        referrerChannelId: item.referrerChannelId,
        channelName: item.referrerChannelId === null
          ? '직접 접근 (자체 수익)'
          : (channel?.name || `채널 #${item.referrerChannelId}`),
        platform: channel?.platform || null,
        itemCount: item._count.id || 0,
        quantity: item._sum.quantity || 0,
        totalAmount: amount,
        percentage: totalItemAmount > 0 ? (amount / totalItemAmount) * 100 : 0,
        // 정산 정보
        bankInfo: channel ? {
          bankName: channel.bankName,
          bankAccount: channel.bankAccount,
          accountHolder: channel.accountHolder,
        } : null,
      }
    })

    // 6. 채널별 상세 정산 현황 (소매밴드별)
    const channelSettlementDetails = await Promise.all(
      channels.map(async (channel) => {
        // OrderItem 레벨 집계
        const itemStats = await prisma.orderItem.aggregate({
          where: { referrerChannelId: channel.id },
          _count: { id: true },
          _sum: { totalPrice: true, quantity: true },
        })

        // Order 레벨 집계
        const orderStats = await prisma.order.aggregate({
          where: { referrerChannelId: channel.id },
          _count: { id: true },
          _sum: { totalAmount: true },
        })

        // 최근 7일 주문 통계
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const recentOrderStats = await prisma.orderItem.aggregate({
          where: {
            referrerChannelId: channel.id,
            createdAt: { gte: sevenDaysAgo },
          },
          _count: { id: true },
          _sum: { totalPrice: true },
        })

        // 최근 30일 주문 통계
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const monthlyOrderStats = await prisma.orderItem.aggregate({
          where: {
            referrerChannelId: channel.id,
            createdAt: { gte: thirtyDaysAgo },
          },
          _count: { id: true },
          _sum: { totalPrice: true },
        })

        return {
          channel: {
            id: channel.id,
            name: channel.name,
            platform: channel.platform,
            coverUrl: channel.coverUrl,
            bankName: channel.bankName,
            bankAccount: channel.bankAccount,
            accountHolder: channel.accountHolder,
          },
          settlement: {
            // 전체 기간
            totalOrders: orderStats._count.id || 0,
            totalOrderAmount: Number(orderStats._sum.totalAmount || 0),
            totalItems: itemStats._count.id || 0,
            totalQuantity: itemStats._sum.quantity || 0,
            totalItemAmount: Number(itemStats._sum.totalPrice || 0),
            // 최근 7일
            recentItems: recentOrderStats._count.id || 0,
            recentAmount: Number(recentOrderStats._sum.totalPrice || 0),
            // 최근 30일
            monthlyItems: monthlyOrderStats._count.id || 0,
            monthlyAmount: Number(monthlyOrderStats._sum.totalPrice || 0),
          },
        }
      })
    )

    // 7. 트래킹 상태 집계 (Order 레벨)
    const trackedOrdersCount = orderReferrerRaw
      .filter(item => item.referrerChannelId !== null)
      .reduce((sum, item) => sum + (item._count.id || 0), 0)
    const trackedOrderAmount = orderReferrerRaw
      .filter(item => item.referrerChannelId !== null)
      .reduce((sum, item) => sum + Number(item._sum.totalAmount || 0), 0)

    // 8. 트래킹 상태 집계 (OrderItem 레벨)
    const trackedItemsCount = orderItemReferrerRaw
      .filter(item => item.referrerChannelId !== null)
      .reduce((sum, item) => sum + (item._count.id || 0), 0)
    const trackedItemAmount = orderItemReferrerRaw
      .filter(item => item.referrerChannelId !== null)
      .reduce((sum, item) => sum + Number(item._sum.totalPrice || 0), 0)
    const totalItemsCount = orderItemReferrerRaw.reduce((sum, item) => sum + (item._count.id || 0), 0)

    return NextResponse.json({
      success: true,
      data: {
        channels,
        // 현재 방식: PublishedProduct.channelId 기준
        currentSettlement,
        // 새로운 방식 - Order 레벨
        orderReferrerSettlement,
        // 새로운 방식 - OrderItem 레벨 (상품별 정산)
        orderItemReferrerSettlement,
        // 채널별 상세 정산 현황
        channelSettlementDetails,
        // 트래킹 현황 - Order 레벨
        orderTrackingStats: {
          totalOrders,
          totalAmount,
          trackedOrders: trackedOrdersCount,
          untrackedOrders: totalOrders - trackedOrdersCount,
          trackedAmount: trackedOrderAmount,
          untrackedAmount: totalAmount - trackedOrderAmount,
          trackingRate: totalOrders > 0 ? (trackedOrdersCount / totalOrders) * 100 : 0,
        },
        // 트래킹 현황 - OrderItem 레벨
        orderItemTrackingStats: {
          totalItems: totalItemsCount,
          totalAmount: totalItemAmount,
          trackedItems: trackedItemsCount,
          untrackedItems: totalItemsCount - trackedItemsCount,
          trackedAmount: trackedItemAmount,
          untrackedAmount: totalItemAmount - trackedItemAmount,
          trackingRate: totalItemsCount > 0 ? (trackedItemsCount / totalItemsCount) * 100 : 0,
        },
      },
    })
  } catch (error: any) {
    console.error('Referrer test API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '데이터 조회 실패' },
      { status: 500 }
    )
  }
}
