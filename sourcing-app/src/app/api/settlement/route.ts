import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@/lib/prisma'

/**
 * GET /api/settlement
 *
 * 소매밴드별 주문 정산 데이터 조회 (OrderItem + OrderTest 통합)
 *
 * Query Parameters:
 * - platform?: string - 소싱처 필터 (BAND, ALIEXPRESS)
 * - retailBandId?: number - 특정 소매밴드 필터
 * - startDate?: string - 시작 날짜 (YYYY-MM-DD)
 * - endDate?: string - 종료 날짜 (YYYY-MM-DD)
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
    const userId = currentUser.userId

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const retailBandId = searchParams.get('retailBandId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 사용자의 소매밴드 목록 조회 (소싱처 정보 포함)
    const retailBands = await prisma.retailBand.findMany({
      where: {
        userId,
        isActive: true,
        ...(retailBandId ? { id: parseInt(retailBandId) } : {}),
        ...(platform ? { apiConfig: { platform: platform as any } } : {}),
      },
      include: {
        apiConfig: {
          select: { platform: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    // 날짜 필터 설정
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    // === 1. 쇼핑몰 주문 (OrderItem) 조회 ===
    // ProductPublish.userId로 필터 (판매자 기준)
    console.log('[Settlement] userId:', userId, 'retailBands:', retailBands.map(b => ({ id: b.id, name: b.name })))

    const orderItems = await prisma.orderItem.findMany({
      where: {
        productPublish: {
          userId, // 판매자 기준으로 필터
          ...(retailBandId ? { retailBandId: parseInt(retailBandId) } : {}),
        },
        ...(Object.keys(dateFilter).length > 0 ? { order: { orderedAt: dateFilter } } : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            recipientName: true,
            status: true,
            orderedAt: true,
          },
        },
        productPublish: {
          include: {
            retailBand: true,
            product: {
              select: { id: true, name: true, thumbnailUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log('[Settlement] orderItems found:', orderItems.length, orderItems.map(oi => ({
      id: oi.id,
      productPublishId: oi.productPublishId,
      retailBandId: oi.productPublish?.retailBandId,
      productName: oi.productName,
    })))

    // === 2. 웹훅 주문 (OrderTest) 조회 ===
    const orderTests = await prisma.orderTest.findMany({
      where: {
        userId,
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...(retailBandId ? {
          productPublish: {
            retailBandId: parseInt(retailBandId),
          },
        } : {}),
      },
      include: {
        productPublish: {
          include: {
            retailBand: true,
            product: {
              select: { id: true, name: true, thumbnailUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // === 통합 데이터 구조 생성 ===
    type UnifiedOrderItem = {
      id: number
      orderId: number | null  // Order ID (쇼핑몰 주문만 있음)
      channel: 'SHOP' | 'WEBHOOK'  // 채널 구분
      orderNumber: string
      customerName: string
      productName: string
      thumbnailUrl: string | null
      quantity: number
      unitPrice: number
      totalPrice: number
      status: string
      orderedAt: Date
      retailBandId: number | null
      retailBandName: string | null
    }

    const allItems: UnifiedOrderItem[] = []

    // 쇼핑몰 주문 변환
    orderItems.forEach(item => {
      const retailBandId = item.productPublish?.retailBandId || null
      const retailBandName = item.productPublish?.retailBand?.name || null

      allItems.push({
        id: item.id,
        orderId: item.order.id,  // Order ID 추가
        channel: 'SHOP',
        orderNumber: item.order.orderNumber,
        customerName: item.order.recipientName,
        productName: item.productName,
        thumbnailUrl: item.thumbnailUrl || item.productPublish?.product?.thumbnailUrl || null,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        status: item.order.status,
        orderedAt: item.order.orderedAt,
        retailBandId,
        retailBandName,
      })
    })

    // 웹훅 주문 변환
    orderTests.forEach(ot => {
      const retailBandId = ot.productPublish?.retailBandId || null
      const retailBandName = ot.productPublish?.retailBand?.name || null

      allItems.push({
        id: ot.id,
        orderId: null,  // 웹훅 주문은 Order가 없음
        channel: 'WEBHOOK',
        orderNumber: `WH-${ot.id.toString().padStart(6, '0')}`,
        customerName: ot.customerName,
        productName: ot.productName,
        thumbnailUrl: ot.productPublish?.product?.thumbnailUrl || null,
        quantity: ot.quantity || 1,
        unitPrice: ot.unitPrice || 0,
        totalPrice: ot.totalPrice || 0,
        status: 'WEBHOOK',
        orderedAt: ot.createdAt,
        retailBandId,
        retailBandName,
      })
    })

    // === 소매밴드별로 그룹화 ===
    const retailBandMap = new Map<number, {
      id: number
      name: string
      coverUrl: string | null
      platform: string
      items: UnifiedOrderItem[]
      itemCount: number
      shopCount: number      // 쇼핑몰 주문 수
      webhookCount: number   // 웹훅 주문 수
      totalQuantity: number
      totalAmount: number
    }>()

    // 초기화
    retailBands.forEach(band => {
      retailBandMap.set(band.id, {
        id: band.id,
        name: band.name,
        coverUrl: band.coverUrl,
        platform: band.apiConfig?.platform || 'UNKNOWN',
        items: [],
        itemCount: 0,
        shopCount: 0,
        webhookCount: 0,
        totalQuantity: 0,
        totalAmount: 0,
      })
    })

    console.log('[Settlement] allItems:', allItems.length, allItems.map(i => ({
      id: i.id,
      channel: i.channel,
      retailBandId: i.retailBandId,
      productName: i.productName,
    })))

    // 아이템 분류
    allItems.forEach(item => {
      if (!item.retailBandId) return

      const bandData = retailBandMap.get(item.retailBandId)
      if (bandData) {
        bandData.items.push(item)
        bandData.itemCount++
        bandData.totalQuantity += item.quantity
        bandData.totalAmount += item.totalPrice

        if (item.channel === 'SHOP') {
          bandData.shopCount++
        } else {
          bandData.webhookCount++
        }
      }
    })

    // 미분류 아이템 (productPublishId가 없는 것들)
    const unclassifiedItems = allItems.filter(item => !item.retailBandId)

    // 결과 정리
    const retailBandResults = Array.from(retailBandMap.values())
      .filter(band => band.itemCount > 0 || retailBandId)
      .sort((a, b) => b.totalAmount - a.totalAmount)

    // 소싱처별로 그룹화
    const platformGroups: Record<string, {
      platform: string
      platformName: string
      retailBands: typeof retailBandResults
      itemCount: number
      totalQuantity: number
      totalAmount: number
    }> = {}

    const platformNames: Record<string, string> = {
      BAND: '밴드',
      ALIEXPRESS: '알리익스프레스',
      UNKNOWN: '기타',
    }

    retailBandResults.forEach(band => {
      const platform = band.platform
      if (!platformGroups[platform]) {
        platformGroups[platform] = {
          platform,
          platformName: platformNames[platform] || platform,
          retailBands: [],
          itemCount: 0,
          totalQuantity: 0,
          totalAmount: 0,
        }
      }
      platformGroups[platform].retailBands.push(band)
      platformGroups[platform].itemCount += band.itemCount
      platformGroups[platform].totalQuantity += band.totalQuantity
      platformGroups[platform].totalAmount += band.totalAmount
    })

    // 전체 통계
    const totalItems = retailBandResults.reduce((sum, b) => sum + b.itemCount, 0)
    const totalQuantity = retailBandResults.reduce((sum, b) => sum + b.totalQuantity, 0)
    const totalAmount = retailBandResults.reduce((sum, b) => sum + b.totalAmount, 0)
    const totalShopCount = retailBandResults.reduce((sum, b) => sum + b.shopCount, 0)
    const totalWebhookCount = retailBandResults.reduce((sum, b) => sum + b.webhookCount, 0)

    return NextResponse.json({
      success: true,
      data: {
        platforms: Object.values(platformGroups).sort((a, b) => b.totalAmount - a.totalAmount),
        retailBands: retailBandResults,
        unclassified: {
          items: unclassifiedItems,
          itemCount: unclassifiedItems.length,
          totalQuantity: unclassifiedItems.reduce((sum, i) => sum + i.quantity, 0),
          totalAmount: unclassifiedItems.reduce((sum, i) => sum + i.totalPrice, 0),
        },
        summary: {
          totalItems: totalItems + unclassifiedItems.length,
          totalQuantity: totalQuantity + unclassifiedItems.reduce((sum, i) => sum + i.quantity, 0),
          totalAmount: totalAmount + unclassifiedItems.reduce((sum, i) => sum + i.totalPrice, 0),
          classifiedItems: totalItems,
          classifiedAmount: totalAmount,
          shopCount: totalShopCount,       // 쇼핑몰 주문 수
          webhookCount: totalWebhookCount, // 웹훅 주문 수
        },
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
