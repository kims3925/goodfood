import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// 통합 주문 타입
export type OrderSource = 'SHOPPING_MALL' | 'GOOGLE_FORM'

export interface UnifiedOrder {
  id: number
  source: OrderSource
  orderNumber: string
  customerName: string
  customerPhone: string | null
  productSummary: string // 첫 상품명 + 외 N개
  itemCount: number
  totalAmount: number
  status: string
  statusLabel: string
  createdAt: string
  // 상세 정보
  address?: string
  deliveryMemo?: string
  // 결제 정보
  paymentMethod?: string
  // Shop 정보
  shopId?: number | null
  shopName?: string | null
  shopSubdomain?: string | null
}

// 상태 라벨 매핑
const statusLabels: Record<string, string> = {
  PENDING: '결제대기',
  PAID: '결제완료',
  PREPARING: '상품준비중',
  SHIPPED: '배송중',
  DELIVERED: '배송완료',
  CANCELLED: '주문취소',
  REFUNDED: '환불완료',
  // OrderTest는 상태가 없으므로 기본값
  RECEIVED: '주문접수',
}

/**
 * GET /api/order/unified
 * 쇼핑몰 주문 + 구글폼 주문 통합 조회
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
    const search = searchParams.get('search') || ''
    const source = searchParams.get('source') as OrderSource | 'ALL' | null // ALL, SHOPPING_MALL, GOOGLE_FORM
    const status = searchParams.get('status') || ''
    const shopId = searchParams.get('shopId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const unifiedOrders: UnifiedOrder[] = []

    // 상태별 카운트 (필터 무관하게 전체 카운트)
    const statusCounts = {
      total: 0,
      PENDING: 0,
      PAID: 0,
      PREPARING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0, // CANCELLED + REFUNDED
      RECEIVED: 0, // 밴드 주문
    }

    // 1. 쇼핑몰 주문 조회 (source가 ALL 또는 SHOPPING_MALL인 경우)
    // Order.userId는 고객 ID이므로, PublishedProduct를 통해 관리자의 상품이 포함된 주문을 조회
    if (!source || source === 'ALL' || source === 'SHOPPING_MALL') {
      try {
        // 먼저 현재 사용자의 PublishedProduct ID 목록을 조회
        const userPublishedProducts = await prisma.publishedProduct.findMany({
          where: { userId: user.userId },
          select: { id: true },
        })
        const publishedProductIds = userPublishedProducts.map(pp => pp.id)

        if (publishedProductIds.length > 0) {
          // 상태별 카운트 조회 (shopId, search 필터 적용, status 필터 제외)
          const countBaseWhere: any = {
            items: {
              some: {
                publishedProductId: { in: publishedProductIds },
              },
            },
          }
          if (shopId) {
            countBaseWhere.shopId = parseInt(shopId)
          }
          if (search) {
            countBaseWhere.OR = [
              { orderNumber: { contains: search } },
              { shippingAddress: { recipient: { contains: search } } },
              { shippingAddress: { phone: { contains: search } } },
            ]
          }

          try {
            const [pendingCount, paidCount, preparingCount, shippedCount, deliveredCount, cancelledCount, refundedCount] = await Promise.all([
              prisma.order.count({ where: { ...countBaseWhere, status: 'PENDING' } }),
              prisma.order.count({ where: { ...countBaseWhere, status: 'PAID' } }),
              prisma.order.count({ where: { ...countBaseWhere, status: 'PREPARING' } }),
              prisma.order.count({ where: { ...countBaseWhere, status: 'SHIPPED' } }),
              prisma.order.count({ where: { ...countBaseWhere, status: 'DELIVERED' } }),
              prisma.order.count({ where: { ...countBaseWhere, status: 'CANCELLED' } }),
              prisma.order.count({ where: { ...countBaseWhere, status: 'REFUNDED' } }),
            ])

            statusCounts.PENDING = pendingCount
            statusCounts.PAID = paidCount
            statusCounts.PREPARING = preparingCount
            statusCounts.SHIPPED = shippedCount
            statusCounts.DELIVERED = deliveredCount
            statusCounts.CANCELLED = cancelledCount + refundedCount
          } catch (countError) {
            console.error('상태별 카운트 조회 실패:', countError)
          }

          const shopOrders = await prisma.order.findMany({
            where: {
              // 관리자가 발행한 상품이 포함된 주문 조회
              items: {
                some: {
                  publishedProductId: { in: publishedProductIds },
                },
              },
              ...(shopId && { shopId: parseInt(shopId) }),
              ...(search && {
                OR: [
                  { orderNumber: { contains: search } },
                  { shippingAddress: { recipient: { contains: search } } },
                  { shippingAddress: { phone: { contains: search } } },
                ],
              }),
              ...(status && status === 'CANCELLED'
                ? { status: { in: ['CANCELLED', 'REFUNDED'] } }
                : status ? { status: status as any } : {}),
            },
            include: {
              shop: {
                select: {
                  id: true,
                  name: true,
                  subdomain: true,
                },
              },
              shippingAddress: true,
              items: {
                select: {
                  productName: true,
                },
              },
              payment: {
                select: {
                  method: true,
                },
              },
            },
            orderBy: { orderedAt: 'desc' },
          })

          for (const order of shopOrders) {
            const productNames = order.items.map(i => i.productName)
            const productSummary = productNames.length > 1
              ? `${productNames[0]} 외 ${productNames.length - 1}개`
              : productNames[0] || '상품 없음'

            const addr = order.shippingAddress
            unifiedOrders.push({
              id: order.id,
              source: 'SHOPPING_MALL',
              orderNumber: order.orderNumber,
              customerName: addr?.recipient || '',
              customerPhone: addr?.phone || null,
              productSummary,
              itemCount: order.items.length,
              totalAmount: Number(order.totalAmount),
              status: order.status,
              statusLabel: statusLabels[order.status] || order.status,
              createdAt: order.orderedAt.toISOString(),
              address: addr ? `${addr.address} ${addr.addressDetail || ''}`.trim() : '',
              deliveryMemo: addr?.deliveryMemo || undefined,
              paymentMethod: order.payment?.method || undefined,
              shopId: order.shop?.id || null,
              shopName: order.shop?.name || null,
              shopSubdomain: order.shop?.subdomain || null,
            })
          }
        }
      } catch (shopOrderError) {
        console.error('쇼핑몰 주문 조회 실패:', shopOrderError)
        // 쇼핑몰 주문 조회 실패 시 빈 배열로 처리하고 계속 진행
      }
    }

    // 2. 구글폼 주문 조회 (source가 ALL 또는 GOOGLE_FORM인 경우, shopId 필터가 없을 때만)
    if ((!source || source === 'ALL' || source === 'GOOGLE_FORM') && !shopId) {
      try {
        const bandOrderBaseWhere = {
          userId: user.userId,
          ...(search && {
            OR: [
              { productName: { contains: search } },
              { customerName: { contains: search } },
            ],
          }),
        }

        // 밴드 주문 카운트 (status 필터와 무관)
        const bandOrderCount = await prisma.orderTest.count({ where: bandOrderBaseWhere })
        statusCounts.RECEIVED = bandOrderCount

        // status 필터가 없거나 RECEIVED인 경우에만 밴드 주문 조회
        if (!status || status === 'RECEIVED') {
          const formOrders = await prisma.orderTest.findMany({
            where: bandOrderBaseWhere,
            include: {
              publishedProduct: {
                include: {
                  product: {
                    select: {
                      name: true,
                      thumbnailUrl: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })

          for (const order of formOrders) {
            unifiedOrders.push({
              id: order.id,
              source: 'GOOGLE_FORM',
              orderNumber: `BAND-${String(order.id).padStart(6, '0')}`,
              customerName: order.customerName,
              customerPhone: null,
              productSummary: order.publishedProduct?.product?.name || order.productName,
              itemCount: 1,
              totalAmount: order.totalPrice || 0,
              status: 'RECEIVED',
              statusLabel: '주문접수',
              createdAt: order.createdAt.toISOString(),
            })
          }
        }
      } catch (formOrderError) {
        console.error('밴드 주문 조회 실패:', formOrderError)
        // 밴드 주문 조회 실패 시 빈 배열로 처리하고 계속 진행
      }
    }

    // 정렬: 최신순
    unifiedOrders.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // 전체 카운트 계산
    statusCounts.total = statusCounts.PENDING + statusCounts.PAID + statusCounts.PREPARING +
                         statusCounts.SHIPPED + statusCounts.DELIVERED + statusCounts.CANCELLED +
                         statusCounts.RECEIVED

    // 페이지네이션
    const total = unifiedOrders.length
    const totalPages = Math.ceil(total / limit) || 1
    const paginatedOrders = unifiedOrders.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      success: true,
      data: {
        orders: paginatedOrders,
        statusCounts,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    })
  } catch (error) {
    console.error('통합 주문 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
