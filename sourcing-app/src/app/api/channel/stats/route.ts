export const dynamic = 'force-dynamic'

/**
 * Channel Stats API
 * 채널별 소싱 통계 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import type { ChannelKind, ChannelStat, ChannelStatsSummary } from '@/types/dashboard'

// 기간별 날짜 범위 계산
type PeriodFilter = 'today' | '7days' | '30days' | 'custom' | 'all'

function getDateRange(
  period: PeriodFilter,
  startDateStr?: string | null,
  endDateStr?: string | null
): { startDate: Date | null; endDate: Date | null } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (period) {
    case 'today':
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      }
    case '7days':
      return {
        startDate: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      }
    case '30days':
      return {
        startDate: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000),
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      }
    case 'custom':
      if (startDateStr && endDateStr) {
        const startDate = new Date(startDateStr)
        const endDate = new Date(endDateStr)
        endDate.setDate(endDate.getDate() + 1) // 종료일 포함
        return { startDate, endDate }
      }
      return { startDate: null, endDate: null }
    case 'all':
    default:
      return { startDate: null, endDate: null }
  }
}

/**
 * GET /api/channel/stats
 * 채널별 소싱 통계 조회
 *
 * Query Parameters:
 * - kind?: 'WHOLESALE' | 'RETAIL' | 'all' (default: 'all')
 * - period?: 'today' | '7days' | '30days' | 'custom' | 'all' (default: 'all')
 * - startDate?: string (YYYY-MM-DD, custom일 때 사용)
 * - endDate?: string (YYYY-MM-DD, custom일 때 사용)
 *
 * Response:
 * - summary: 전체 요약 통계
 * - channels: 채널별 상세 통계
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const kindFilter = searchParams.get('kind') as ChannelKind | 'all' | null
    const period = (searchParams.get('period') as PeriodFilter) || 'all'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // 날짜 범위 계산
    const { startDate, endDate } = getDateRange(period, startDateParam, endDateParam)
    const dateFilter = startDate && endDate ? { gte: startDate, lt: endDate } : undefined

    // 채널 목록 조회 (모든 채널) - shop 정보 포함
    const channels = await prisma.channel.findMany({
      where: {
        userId: currentUser.userId,
        ...(kindFilter && kindFilter !== 'all' ? { kind: kindFilter } : {}),
      },
      select: {
        id: true,
        name: true,
        coverUrl: true,
        kind: true,
        isActive: true,
        shop: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    })

    // 전체 상품 수 (발행율 분모로 사용 - 소매채널용, 날짜 필터 없이 전체)
    const totalProducts = await prisma.product.count({
      where: {
        userId: currentUser.userId,
      },
    })

    // 채널별 통계 계산
    const channelStats: ChannelStat[] = await Promise.all(
      channels.map(async (channel) => {
        // 도매채널: 수집/변환/상품생성 통계
        // 소매채널: 발행 통계
        if (channel.kind === 'WHOLESALE') {
          // 수집된 상품 수 (CollectedPost → CollectedProduct)
          const collected = await prisma.collectedProduct.count({
            where: {
              userId: currentUser.userId,
              post: {
                channelId: channel.id,
              },
              ...(dateFilter ? { createdAt: dateFilter } : {}),
            },
          })

          // 변환된 상품 수 (isConverted = true)
          const transformed = await prisma.collectedProduct.count({
            where: {
              userId: currentUser.userId,
              isConverted: true,
              post: {
                channelId: channel.id,
              },
              ...(dateFilter ? { updatedAt: dateFilter } : {}),
            },
          })

          // 생성된 상품 수 (도매채널에서 생성된 상품)
          const products = await prisma.product.count({
            where: {
              userId: currentUser.userId,
              channelId: channel.id,
              ...(dateFilter ? { createdAt: dateFilter } : {}),
            },
          })

          // 전환율 계산 (도매: 수집 → 변환)
          const transformRate = collected > 0 ? Math.round((transformed / collected) * 100) : 0

          return {
            channelId: channel.id,
            channelName: channel.name,
            coverUrl: channel.coverUrl,
            kind: channel.kind as ChannelKind,
            isActive: channel.isActive,
            collected,
            transformed,
            products,
            published: 0,
            transformRate,
            publishRate: 0,
            shop: null,
          }
        } else {
          // 소매채널: 발행 통계
          // 채널에 발행된 상품 수
          const published = await prisma.channelProduct.count({
            where: {
              userId: currentUser.userId,
              channelId: channel.id,
              publishedAt: { not: null },
              ...(dateFilter ? { publishedAt: { ...dateFilter, not: null } } : {}),
            },
          })

          // 쇼핑몰에 발행된 상품 수 (쇼핑몰이 연결된 경우)
          let shopPublished = 0
          if (channel.shop) {
            shopPublished = await prisma.shopProduct.count({
              where: {
                userId: currentUser.userId,
                shopId: channel.shop.id,
                publishedAt: { not: null },
                deletedAt: null, // Soft Delete 필터링
                ...(dateFilter ? { publishedAt: { ...dateFilter, not: null } } : {}),
              },
            })
          }

          // 발행율 계산 (소매: 전체 상품 대비 발행 비율)
          const publishRate = totalProducts > 0 ? Math.round((published / totalProducts) * 100) : 0
          const shopPublishRate = totalProducts > 0 ? Math.round((shopPublished / totalProducts) * 100) : 0

          return {
            channelId: channel.id,
            channelName: channel.name,
            coverUrl: channel.coverUrl,
            kind: channel.kind as ChannelKind,
            isActive: channel.isActive,
            collected: 0,
            transformed: 0,
            products: 0,
            published,
            transformRate: 0,
            publishRate,
            shopPublished,
            shopPublishRate,
            shop: channel.shop
              ? {
                  id: channel.shop.id,
                  name: channel.shop.name,
                  subdomain: channel.shop.subdomain,
                }
              : null,
          }
        }
      })
    )

    // 요약 통계 계산
    const summary: ChannelStatsSummary = {
      totalChannels: channelStats.length,
      activeChannels: channelStats.filter((ch) => ch.isActive).length,
      totalCollected: channelStats.reduce((sum, ch) => sum + ch.collected, 0),
      totalTransformed: channelStats.reduce((sum, ch) => sum + ch.transformed, 0),
      totalProducts: channelStats.reduce((sum, ch) => sum + ch.products, 0),
      totalPublished: channelStats.reduce((sum, ch) => sum + ch.published, 0),
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        channels: channelStats,
      },
    })
  } catch (error) {
    console.error('채널 통계 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '채널 통계를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
