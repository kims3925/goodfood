export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, ChannelKind, BundleShippingType } from '@bandauto/db'
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

    // 이미 정산된 주문 아이템 ID 조회 (정산 완료/미완료 구분용)
    const existingSettlementItems = await prisma.settlementItem.findMany({
      where: {
        settlement: {
          userId: user.userId,
          status: { not: 'CANCELLED' },
        },
      },
      select: { orderItemId: true, guestOrderItemId: true },
    })
    const settledOrderItemIds = new Set(
      existingSettlementItems.filter(i => i.orderItemId).map(i => i.orderItemId)
    )
    const settledGuestOrderItemIds = new Set(
      existingSettlementItems.filter(i => i.guestOrderItemId).map(i => i.guestOrderItemId)
    )

    // 쇼핑몰 주문 조회 (Shop별로 그룹화)
    // Shop 소유자의 주문을 조회 (Order.userId는 주문한 고객, Shop.userId가 소유자)
    const shopOrders = await prisma.order.findMany({
      where: {
        shop: { userId: user.userId },  // Shop 소유자 기준으로 필터링
        status: 'DELIVERED',  // 배송완료된 주문만 정산 대상
        shopId: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { orderedAt: dateFilter } : {}),
      },
      include: {
        shop: {
          select: { id: true, name: true, subdomain: true },
        },
        shippingAddress: {
          select: { recipientName: true },
        },
        items: {
          select: {
            id: true,
            variantId: true,
            productName: true,
            optionSummary: true,
            thumbnailUrl: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            variant: {
              select: {
                wholesalePrice: true,
                bundleUnit: true, // 합배송 단위
              },
            },
            shopProduct: {
              include: {
                product: {
                  select: {
                    id: true,
                    shippingFee: true,           // 기본 배송비
                    bundleMaxQty: true,          // 합배송 최대 수량
                    bundleShippingType: true,    // 합배송 타입
                    variants: {
                      take: 1,
                      select: { wholesalePrice: true, bundleUnit: true },
                    },
                    images: {
                      take: 1,
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
        // 결제 정보 포함
        payment: {
          select: {
            method: true,
            status: true,
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    })

    // 미분류 주문 (shopId가 없는 경우)
    const unclassifiedItems: any[] = []

    // 도매가 추출 헬퍼 함수 (스냅샷 -> variant -> product.variants[0] 순으로 시도)
    const getWholesalePrice = (item: any): number | null => {
      // 1. OrderItem에 연결된 variant의 wholesalePrice
      if (item.variant?.wholesalePrice) {
        return item.variant.wholesalePrice
      }
      // 2. Product의 첫 번째 variant의 wholesalePrice
      const productVariant = item.shopProduct?.product?.variants?.[0]
      if (productVariant?.wholesalePrice) {
        return productVariant.wholesalePrice
      }
      return null
    }

    // Product에서 배송비 정보 추출
    const getProductShippingInfo = (item: any): {
      shippingFee: number
      bundleMaxQty: number
      bundleShippingType: string
      bundleUnit: number
    } => {
      const product = item.shopProduct?.product
      const shippingFee = product?.shippingFee || 0
      const bundleMaxQty = product?.bundleMaxQty || 1
      const bundleShippingType = product?.bundleShippingType || 'NONE'
      // bundleUnit: variant에서 가져오거나 product.variants[0]에서 가져옴
      const bundleUnit = item.variant?.bundleUnit ||
        product?.variants?.[0]?.bundleUnit || 1

      return { shippingFee, bundleMaxQty, bundleShippingType, bundleUnit }
    }

    // 주문의 실제 배송비 계산 (상품별 합배송 로직 적용)
    // 반환: { productId -> 해당 상품의 총 배송비 }
    const calculateOrderProductShippingFees = (items: any[]): Map<number, number> => {
      // 상품별 정보 집계 (같은 상품의 아이템들을 그룹화)
      const productShippingMap = new Map<number, {
        shippingFee: number
        bundleMaxQty: number
        bundleShippingType: string
        totalBundleUnits: number
        itemCount: number
      }>()

      for (const item of items) {
        const product = item.shopProduct?.product
        if (!product) continue

        const productId = product.id
        const { shippingFee, bundleMaxQty, bundleShippingType, bundleUnit } = getProductShippingInfo(item)

        if (!productShippingMap.has(productId)) {
          productShippingMap.set(productId, {
            shippingFee,
            bundleMaxQty,
            bundleShippingType,
            totalBundleUnits: 0,
            itemCount: 0,
          })
        }

        const productInfo = productShippingMap.get(productId)!
        // 총 배송 단위 누적 (quantity × bundleUnit)
        productInfo.totalBundleUnits += item.quantity * bundleUnit
        productInfo.itemCount++
      }

      // 상품별 실제 배송비 계산
      const productShippingFees = new Map<number, number>()

      for (const [productId, info] of productShippingMap) {
        let actualShippingFee = 0

        if (info.shippingFee > 0) {
          if (info.bundleShippingType === 'NONE') {
            // 합배송 없음: 아이템 수 × 배송비
            actualShippingFee = info.itemCount * info.shippingFee
          } else {
            // 합배송 적용 (INCLUDED, SEPARATE)
            // 배송비 횟수 = ceil(총 배송단위 / 합배송 최대수량)
            const shippingCount = Math.ceil(info.totalBundleUnits / info.bundleMaxQty)
            actualShippingFee = shippingCount * info.shippingFee
          }
        }

        productShippingFees.set(productId, actualShippingFee)
      }

      return productShippingFees
    }

    // 아이템별 배송비 분배 (같은 상품 내에서 금액 비율로 분배)
    const allocateShippingFeeToItem = (
      item: any,
      productShippingFees: Map<number, number>,
      orderItems: any[]
    ): number => {
      const product = item.shopProduct?.product
      if (!product) return 0

      const productId = product.id
      const productTotalShippingFee = productShippingFees.get(productId) || 0

      if (productTotalShippingFee === 0) return 0

      // 같은 상품의 아이템들 총 금액
      const sameProductItems = orderItems.filter(
        i => i.shopProduct?.product?.id === productId
      )
      const sameProductTotalAmount = sameProductItems.reduce(
        (sum, i) => sum + Number(i.totalPrice), 0
      )

      // 이 아이템의 금액 비율로 배송비 분배
      const itemTotalPrice = Number(item.totalPrice)
      const itemRatio = sameProductTotalAmount > 0 ? itemTotalPrice / sameProductTotalAmount : 0

      return Math.round(productTotalShippingFee * itemRatio)
    }

    // 마진 계산 헬퍼 함수 (Product 배송비 기반)
    const calculateMargin = (
      item: any,
      wholesalePrice: number | null,
      allocatedShippingFee: number
    ): { margin: number | null; marginRate: number | null } => {
      const unitPrice = Number(item.unitPrice)
      const totalPrice = Number(item.totalPrice)

      if (!wholesalePrice || wholesalePrice <= 0 || unitPrice <= 0) {
        return { margin: null, marginRate: null }
      }

      // 마진 = (판매가 - 도매가) × 수량 - 분배된 배송비
      const productMargin = (unitPrice - wholesalePrice) * item.quantity
      const margin = productMargin - allocatedShippingFee

      // 마진율 = 마진 / 아이템 총액 × 100%
      const marginRate = totalPrice > 0
        ? Math.round((margin / totalPrice) * 100 * 10) / 10
        : null

      return { margin, marginRate }
    }

    // 비회원 주문(GuestOrder) 조회
    const guestOrders = await prisma.guestOrder.findMany({
      where: {
        shop: { userId: user.userId },  // Shop 소유자 기준으로 필터링
        status: 'DELIVERED',  // 배송완료된 주문만 정산 대상
        shopId: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { orderedAt: dateFilter } : {}),
      },
      include: {
        shop: {
          select: { id: true, name: true, subdomain: true },
        },
        shippingAddress: {
          select: { recipientName: true },
        },
        items: {
          include: {
            variant: {
              select: {
                wholesalePrice: true,
                bundleUnit: true, // 합배송 단위
              },
            },
            shopProduct: {
              include: {
                product: {
                  select: {
                    id: true,
                    shippingFee: true,           // 기본 배송비
                    bundleMaxQty: true,          // 합배송 최대 수량
                    bundleShippingType: true,    // 합배송 타입
                    variants: {
                      take: 1,
                      select: { wholesalePrice: true, bundleUnit: true },
                    },
                    images: {
                      take: 1,
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
        // 결제 정보 포함
        payment: {
          select: {
            method: true,
            status: true,
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    })

    // 쇼핑몰 주문 아이템 처리
    for (const order of shopOrders) {
      const orderShopId = order.shopId
      // Product 기반 배송비 계산 (합배송 로직 적용)
      const productShippingFees = calculateOrderProductShippingFees(order.items)

      if (!orderShopId) {
        // shopId가 없는 주문은 미분류
        for (const item of order.items) {
          const isSettled = settledOrderItemIds.has(item.id)
          const wholesalePrice = getWholesalePrice(item)
          const allocatedShippingFee = allocateShippingFeeToItem(item, productShippingFees, order.items)
          const { margin, marginRate } = calculateMargin(item, wholesalePrice, allocatedShippingFee)

          unclassifiedItems.push({
            id: item.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.shippingAddress?.recipientName || '알 수 없음',
            productName: item.productName,
            thumbnailUrl: item.thumbnailUrl || null,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            wholesalePrice,
            marginRate,
            margin,
            allocatedShippingFee, // 분배된 배송비 정보 추가
            status: order.status,
            orderedAt: order.orderedAt.toISOString(),
            shopId: null,
            shopName: null,
            isSettled,
            // 결제 정보
            paymentMethod: order.payment?.method || null,
            paymentStatus: order.payment?.status || null,
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
        const isSettled = settledOrderItemIds.has(item.id)
        const wholesalePrice = getWholesalePrice(item)
        const allocatedShippingFee = allocateShippingFeeToItem(item, productShippingFees, order.items)
        const { margin, marginRate } = calculateMargin(item, wholesalePrice, allocatedShippingFee)

        const thumbnailUrl = item.thumbnailUrl ||
          item.shopProduct?.product?.images?.[0]?.url || null

        shopData.items.push({
          id: item.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.shippingAddress?.recipientName || '알 수 없음',
          productName: item.productName,
          thumbnailUrl,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          wholesalePrice,
          marginRate,
          margin,
          allocatedShippingFee, // 분배된 배송비 정보 추가
          status: order.status,
          orderedAt: order.orderedAt.toISOString(),
          shopId: orderShopId,
          shopName: shopData.name,
          isSettled,
          // 결제 정보
          paymentMethod: order.payment?.method || null,
          paymentStatus: order.payment?.status || null,
        })

        shopData.itemCount++
        shopData.totalQuantity += item.quantity
        shopData.totalAmount += Number(item.totalPrice)
      }
    }

    // 비회원 주문(GuestOrder) 아이템 처리
    for (const guestOrder of guestOrders) {
      const orderShopId = guestOrder.shopId
      // Product 기반 배송비 계산 (합배송 로직 적용)
      const productShippingFees = calculateOrderProductShippingFees(guestOrder.items)

      if (!orderShopId) {
        // shopId가 없는 주문은 미분류
        for (const item of guestOrder.items) {
          const isSettled = settledGuestOrderItemIds.has(item.id)
          const wholesalePrice = getWholesalePrice(item)
          const allocatedShippingFee = allocateShippingFeeToItem(item, productShippingFees, guestOrder.items)
          const { margin, marginRate } = calculateMargin(item, wholesalePrice, allocatedShippingFee)

          unclassifiedItems.push({
            id: item.id,
            orderId: guestOrder.id,
            orderNumber: guestOrder.orderNumber,
            customerName: guestOrder.shippingAddress?.recipientName || guestOrder.guestName || '비회원',
            productName: item.productName,
            thumbnailUrl: item.thumbnailUrl || null,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            wholesalePrice,
            marginRate,
            margin,
            allocatedShippingFee, // 분배된 배송비 정보 추가
            status: guestOrder.status,
            orderedAt: guestOrder.orderedAt.toISOString(),
            shopId: null,
            shopName: null,
            isSettled,
            isGuestOrder: true,  // 비회원 주문 표시
            // 결제 정보
            paymentMethod: guestOrder.payment?.method || null,
            paymentStatus: guestOrder.payment?.status || null,
          })
        }
        continue
      }

      let shopData = shopDataMap.get(orderShopId)

      // Shop이 맵에 없으면 새로 추가
      if (!shopData && guestOrder.shop) {
        shopData = {
          id: guestOrder.shop.id,
          name: guestOrder.shop.name,
          subdomain: guestOrder.shop.subdomain,
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

      for (const item of guestOrder.items) {
        const isSettled = settledGuestOrderItemIds.has(item.id)
        const wholesalePrice = getWholesalePrice(item)
        const allocatedShippingFee = allocateShippingFeeToItem(item, productShippingFees, guestOrder.items)
        const { margin, marginRate } = calculateMargin(item, wholesalePrice, allocatedShippingFee)

        const thumbnailUrl = item.thumbnailUrl ||
          item.shopProduct?.product?.images?.[0]?.url || null

        shopData.items.push({
          id: item.id,
          orderId: guestOrder.id,
          orderNumber: guestOrder.orderNumber,
          customerName: guestOrder.shippingAddress?.recipientName || guestOrder.guestName || '비회원',
          productName: item.productName,
          thumbnailUrl,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          wholesalePrice,
          marginRate,
          margin,
          allocatedShippingFee, // 분배된 배송비 정보 추가
          status: guestOrder.status,
          orderedAt: guestOrder.orderedAt.toISOString(),
          shopId: orderShopId,
          shopName: shopData.name,
          isSettled,
          isGuestOrder: true,  // 비회원 주문 표시
          // 결제 정보
          paymentMethod: guestOrder.payment?.method || null,
          paymentStatus: guestOrder.payment?.status || null,
        })

        shopData.itemCount++
        shopData.totalQuantity += item.quantity
        shopData.totalAmount += Number(item.totalPrice)
      }
    }

    // 결과 정리 (주문이 있는 Shop만)
    const shopDataArray = Array.from(shopDataMap.values()).filter(s => s.itemCount > 0)

    // 정산 완료/미완료 아이템 분리
    const allItems = [
      ...shopDataArray.flatMap(s => s.items),
      ...unclassifiedItems
    ]
    const settledItems = allItems.filter(i => i.isSettled)
    const unsettledItems = allItems.filter(i => !i.isSettled)

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
      // 정산 완료/미완료 통계
      settledCount: settledItems.length,
      settledAmount: settledItems.reduce((sum, i) => sum + i.totalPrice, 0),
      unsettledCount: unsettledItems.length,
      unsettledAmount: unsettledItems.reduce((sum, i) => sum + i.totalPrice, 0),
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
    const { shopId, periodStart, periodEnd, memo } = body

    if (!shopId) {
      return NextResponse.json(
        { success: false, error: '쇼핑몰 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // Shop 소유권 확인
    const shop = await prisma.shop.findFirst({
      where: {
        id: parseInt(shopId),
        userId: user.userId,
      },
    })

    if (!shop) {
      return NextResponse.json(
        { success: false, error: '쇼핑몰을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 날짜 필터 설정 (없으면 전체 기간)
    const filterStart = periodStart ? new Date(periodStart) : undefined
    const filterEnd = periodEnd ? new Date(periodEnd) : undefined
    if (filterEnd) filterEnd.setHours(23, 59, 59, 999)

    // 이미 정산된 주문 아이템 ID 조회 (중복 방지)
    const existingSettlementItems = await prisma.settlementItem.findMany({
      where: {
        settlement: {
          userId: user.userId,
          shopId: parseInt(shopId),
          status: { not: 'CANCELLED' },
        },
      },
      select: { orderItemId: true, guestOrderItemId: true },
    })
    const settledOrderItemIds = new Set(
      existingSettlementItems.filter(i => i.orderItemId).map(i => i.orderItemId)
    )
    const settledGuestOrderItemIds = new Set(
      existingSettlementItems.filter(i => i.guestOrderItemId).map(i => i.guestOrderItemId)
    )

    // Shop 기준 주문 조회 (아직 정산되지 않은 주문만)
    // Shop 소유권은 위에서 이미 확인됨, Order.userId는 주문한 고객이므로 제거
    const orders = await prisma.order.findMany({
      where: {
        shopId: parseInt(shopId),
        status: 'DELIVERED',  // 배송완료된 주문만 정산 대상
        ...(filterStart || filterEnd ? {
          orderedAt: {
            ...(filterStart ? { gte: filterStart } : {}),
            ...(filterEnd ? { lte: filterEnd } : {}),
          }
        } : {}),
      },
      include: {
        items: true,
      },
      orderBy: { orderedAt: 'asc' },
    })

    // 비회원 주문(GuestOrder) 조회
    const guestOrders = await prisma.guestOrder.findMany({
      where: {
        shopId: parseInt(shopId),
        status: 'DELIVERED',  // 배송완료된 주문만 정산 대상
        ...(filterStart || filterEnd ? {
          orderedAt: {
            ...(filterStart ? { gte: filterStart } : {}),
            ...(filterEnd ? { lte: filterEnd } : {}),
          }
        } : {}),
      },
      include: {
        items: true,
      },
      orderBy: { orderedAt: 'asc' },
    })

    // 정산 대상 주문 아이템 필터링 (이미 정산된 아이템 제외)
    // 회원 주문 아이템
    const orderSettlementItems: Array<{
      orderItemId: number
      orderId: number
      quantity: number
      unitPrice: number
      totalPrice: number
    }> = []

    for (const order of orders) {
      for (const item of order.items) {
        if (!settledOrderItemIds.has(item.id)) {
          orderSettlementItems.push({
            orderItemId: item.id,
            orderId: order.id,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
          })
        }
      }
    }

    // 비회원 주문 아이템
    const guestOrderSettlementItems: Array<{
      guestOrderItemId: number
      guestOrderId: number
      quantity: number
      unitPrice: number
      totalPrice: number
    }> = []

    for (const guestOrder of guestOrders) {
      for (const item of guestOrder.items) {
        if (!settledGuestOrderItemIds.has(item.id)) {
          guestOrderSettlementItems.push({
            guestOrderItemId: item.id,
            guestOrderId: guestOrder.id,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
          })
        }
      }
    }

    const totalSettlementItemCount = orderSettlementItems.length + guestOrderSettlementItems.length

    if (totalSettlementItemCount === 0) {
      return NextResponse.json(
        { success: false, error: '정산할 주문이 없습니다. 해당 기간에 새로운 주문이 없거나 이미 정산되었습니다.' },
        { status: 400 }
      )
    }

    // 실제 정산 기간 계산 (포함된 주문들의 날짜 범위)
    const includedOrderIds = new Set(orderSettlementItems.map(item => item.orderId))
    const includedGuestOrderIds = new Set(guestOrderSettlementItems.map(item => item.guestOrderId))
    const includedOrders = orders.filter(o => includedOrderIds.has(o.id))
    const includedGuestOrders = guestOrders.filter(o => includedGuestOrderIds.has(o.id))

    // 모든 주문의 날짜를 합쳐서 기간 계산
    const allOrderDates = [
      ...includedOrders.map(o => o.orderedAt),
      ...includedGuestOrders.map(o => o.orderedAt),
    ].sort((a, b) => a.getTime() - b.getTime())

    const actualPeriodStart = allOrderDates.length > 0
      ? allOrderDates[0]
      : new Date()
    const actualPeriodEnd = allOrderDates.length > 0
      ? allOrderDates[allOrderDates.length - 1]
      : new Date()

    const totalOrders = totalSettlementItemCount
    const totalAmount =
      orderSettlementItems.reduce((sum, item) => sum + item.totalPrice, 0) +
      guestOrderSettlementItems.reduce((sum, item) => sum + item.totalPrice, 0)

    // 트랜잭션으로 정산 및 정산 아이템 생성
    const settlement = await prisma.$transaction(async (tx) => {
      // 정산 생성 (자동 완료 처리)
      const newSettlement = await tx.settlement.create({
        data: {
          userId: user.userId,
          shopId: parseInt(shopId),
          periodStart: actualPeriodStart,
          periodEnd: actualPeriodEnd,
          totalOrders,
          totalAmount,
          memo: memo || null,
          status: 'COMPLETED',
          settledAt: new Date(),
        },
      })

      // 정산 아이템 생성 - 회원 주문
      if (orderSettlementItems.length > 0) {
        await tx.settlementItem.createMany({
          data: orderSettlementItems.map(item => ({
            settlementId: newSettlement.id,
            orderItemId: item.orderItemId,
            orderId: item.orderId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        })
      }

      // 정산 아이템 생성 - 비회원 주문
      if (guestOrderSettlementItems.length > 0) {
        await tx.settlementItem.createMany({
          data: guestOrderSettlementItems.map(item => ({
            settlementId: newSettlement.id,
            guestOrderItemId: item.guestOrderItemId,
            guestOrderId: item.guestOrderId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        })
      }

      return newSettlement
    })

    return NextResponse.json({
      success: true,
      data: {
        id: settlement.id,
        shopId: settlement.shopId,
        periodStart: settlement.periodStart.toISOString(),
        periodEnd: settlement.periodEnd.toISOString(),
        totalOrders: settlement.totalOrders,
        totalAmount: Number(settlement.totalAmount),
        status: settlement.status,
        memo: settlement.memo,
        message: '정산이 생성되었습니다.',
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
