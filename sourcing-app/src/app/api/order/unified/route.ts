export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// 주문 소스 타입
export type OrderSource = 'SHOPPING_MALL'

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
  isGuestOrder?: boolean
  // 상세 정보
  address?: string
  deliveryMemo?: string
  // 결제 정보
  paymentMethod?: string
  // Shop 정보 (소매처)
  shopId?: number | null
  shopName?: string | null
  shopSubdomain?: string | null
  // Channel 정보 (도매처)
  wholesaleChannel?: {
    id: number
    name: string
    platform: string
  } | null
}

// 상태 라벨 매핑
const statusLabels: Record<string, string> = {
  PENDING: '결제대기',
  PAID: '결제완료',
  PREPARING: '상품준비',
  SHIPPED: '배송중',
  DELIVERED: '배송완료',
  CANCELLED: '주문취소',
  REFUNDED: '환불완료',
}

/**
 * GET /api/order/unified
 * 쇼핑몰 주문 조회
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

    // 외부주문 삭제(soft) 표식 — 두 delete 엔드포인트만 박는 고유 cancelReason.
    // 목록/카운트 모두에서 숨겨야 사용자가 "삭제됨"으로 인식.
    // ⚠ NULL-safe 필수: SQL `col != 'x'` 는 NULL 행을 제외하므로 cancel_reason
    //   IS NULL 인 정상 주문이 통째로 가려지는 사고(2026-05-22) 발생. 명시적 OR.
    const notExternallyDeleted: any = {
      OR: [
        { cancelReason: null },
        { cancelReason: { not: '외부 주문 삭제' } },
      ],
    }

    // 상태별 카운트 (필터 무관하게 전체 카운트)
    const statusCounts = {
      total: 0,
      PENDING: 0,
      PAID: 0,
      PREPARING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0, // CANCELLED + REFUNDED
    }

    // 1. 쇼핑몰 주문 조회 (source가 ALL 또는 SHOPPING_MALL인 경우)
    // Order.userId는 고객 ID이므로, ShopProduct를 통해 관리자의 상품이 포함된 주문을 조회
    if (!source || source === 'ALL' || source === 'SHOPPING_MALL') {
      try {
        // 사용자의 쇼핑몰 ID 목록 조회 (커스텀 아이템 외부 주문(XORD) 포함용)
        // 주: ShopProduct ID 목록을 IN 절로 박는 방식은 사용자당 ID 가 수천~수만 건이면
        //     IN [...] 가 silent truncate 되어 일부 주문이 누락된다 (2026-04-23 이후 데이터
        //     안 보이는 사고의 원인). 아래 쿼리는 relation traversal(EXISTS subquery)로
        //     변환되어 ID 개수와 무관하게 정확히 매칭된다.
        const userShops = await prisma.shop.findMany({
          where: { userId: user.userId, deletedAt: null },
          select: { id: true },
        })
        const userShopIds = userShops.map(s => s.id)

        // 사용자 ShopProduct 가 1개라도 있는지(또는 쇼핑몰이 있는지)만 빠르게 확인
        const hasAnyShopProduct = await prisma.shopProduct.findFirst({
          where: { userId: user.userId },
          select: { id: true },
        })

        if (hasAnyShopProduct || userShopIds.length > 0) {
          // 상태별 카운트 조회 (shopId, search 필터 적용, status 필터 제외)
          // EXISTS subquery 로 변환되는 relation traversal — IN [...수만 ID...] 회피
          // AND 배열 — notExternallyDeleted 의 OR 가 search 의 OR 와 덮어쓰기 충돌하지 않도록
          const memberBaseFilters: any[] = [
            notExternallyDeleted,
            { items: { some: { shopProduct: { userId: user.userId } } } },
          ]
          if (shopId) memberBaseFilters.push({ shopId: parseInt(shopId) })
          if (search) memberBaseFilters.push({
            OR: [
              { orderNumber: { contains: search } },
              { shippingAddress: { recipientName: { contains: search } } },
              { shippingAddress: { recipientPhone: { contains: search } } },
            ],
          })
          const countBaseWhere: any = { AND: memberBaseFilters }

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

          // findMany 도 같은 AND 패턴 — notExternallyDeleted 의 OR 보전
          const memberFindFilters: any[] = [
            notExternallyDeleted,
            { items: { some: { shopProduct: { userId: user.userId } } } },
          ]
          if (shopId) memberFindFilters.push({ shopId: parseInt(shopId) })
          if (search) memberFindFilters.push({
            OR: [
              { orderNumber: { contains: search } },
              { shippingAddress: { recipientName: { contains: search } } },
              { shippingAddress: { recipientPhone: { contains: search } } },
            ],
          })
          if (status) memberFindFilters.push(
            status === 'CANCELLED'
              ? { status: { in: ['CANCELLED', 'REFUNDED'] } }
              : { status: status as any }
          )
          const shopOrders = await prisma.order.findMany({
            where: { AND: memberFindFilters },
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
                  shopProduct: {
                    select: {
                      product: {
                        select: {
                          channel: {
                            select: {
                              id: true,
                              kind: true,
                              platform: true,
                              name: true,
                            },
                          },
                        },
                      },
                    },
                  },
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

            // 첫 번째 상품의 도매처 정보 추출
            const firstChannel = order.items[0]?.shopProduct?.product?.channel
            const wholesaleChannel = firstChannel?.kind === 'WHOLESALE' ? {
              id: firstChannel.id,
              name: firstChannel.name,
              platform: firstChannel.platform,
            } : null

            const addr = order.shippingAddress
            unifiedOrders.push({
              id: order.id,
              source: 'SHOPPING_MALL',
              orderNumber: order.orderNumber,
              customerName: addr?.recipientName || '',
              customerPhone: addr?.recipientPhone || null,
              productSummary,
              itemCount: order.items.length,
              totalAmount: Number(order.totalAmount),
              status: order.status,
              statusLabel: statusLabels[order.status] || order.status,
              createdAt: order.orderedAt.toISOString(),
              isGuestOrder: false,
              address: addr ? `${addr.address} ${addr.addressDetail || ''}`.trim() : '',
              deliveryMemo: addr?.deliveryMemo || undefined,
              paymentMethod: order.payment?.method || undefined,
              shopId: order.shop?.id || null,
              shopName: order.shop?.name || null,
              shopSubdomain: order.shop?.subdomain || null,
              wholesaleChannel,
            })
          }

          // 2. 비회원 주문 조회
          // 게스트 주문 아이템 필터 조건:
          // - 사용자 상품이 포함된 주문(GORD) OR 사용자 쇼핑몰의 커스텀 아이템 외부 주문(XORD)
          // relation traversal 로 작성 — IN [...수만 ShopProduct id...] 회피
          const guestItemConditions: any[] = []
          if (hasAnyShopProduct) {
            guestItemConditions.push({ items: { some: { shopProduct: { userId: user.userId } } } })
          }
          if (userShopIds.length > 0) {
            guestItemConditions.push({
              shopId: { in: userShopIds },
              items: { some: { isCustomItem: true } },
            })
          }
          const guestItemCondition = guestItemConditions.length === 1
            ? guestItemConditions[0]
            : { OR: guestItemConditions }

          // 비회원 주문 카운트 조회 (상태별)
          // AND 배열로 구성하여 guestItemCondition의 OR와 search OR가 충돌하지 않도록 처리
          const guestBaseFilters: any[] = [guestItemCondition, notExternallyDeleted]
          if (shopId) guestBaseFilters.push({ shopId: parseInt(shopId) })
          if (search) guestBaseFilters.push({
            OR: [
              { orderNumber: { contains: search } },
              { guestName: { contains: search } },
              { guestPhone: { contains: search } },
              { shippingAddress: { recipientName: { contains: search } } },
              { shippingAddress: { recipientPhone: { contains: search } } },
            ]
          })
          const guestCountBaseWhere: any = guestBaseFilters.length === 1
            ? guestBaseFilters[0]
            : { AND: guestBaseFilters }

          try {
            const [guestPendingCount, guestPaidCount, guestPreparingCount, guestShippedCount, guestDeliveredCount, guestCancelledCount, guestRefundedCount] = await Promise.all([
              prisma.guestOrder.count({ where: { ...guestCountBaseWhere, status: 'PENDING' } }),
              prisma.guestOrder.count({ where: { ...guestCountBaseWhere, status: 'PAID' } }),
              prisma.guestOrder.count({ where: { ...guestCountBaseWhere, status: 'PREPARING' } }),
              prisma.guestOrder.count({ where: { ...guestCountBaseWhere, status: 'SHIPPED' } }),
              prisma.guestOrder.count({ where: { ...guestCountBaseWhere, status: 'DELIVERED' } }),
              prisma.guestOrder.count({ where: { ...guestCountBaseWhere, status: 'CANCELLED' } }),
              prisma.guestOrder.count({ where: { ...guestCountBaseWhere, status: 'REFUNDED' } }),
            ])

            statusCounts.PENDING += guestPendingCount
            statusCounts.PAID += guestPaidCount
            statusCounts.PREPARING += guestPreparingCount
            statusCounts.SHIPPED += guestShippedCount
            statusCounts.DELIVERED += guestDeliveredCount
            statusCounts.CANCELLED += guestCancelledCount + guestRefundedCount
          } catch (guestCountError) {
            console.error('비회원 주문 상태별 카운트 조회 실패:', guestCountError)
          }

          // AND 배열로 구성하여 OR 충돌 방지 + status 조건 포함
          const guestOrderFilters: any[] = [guestItemCondition, notExternallyDeleted]
          if (shopId) guestOrderFilters.push({ shopId: parseInt(shopId) })
          if (search) guestOrderFilters.push({
            OR: [
              { orderNumber: { contains: search } },
              { guestName: { contains: search } },
              { guestPhone: { contains: search } },
              { shippingAddress: { recipientName: { contains: search } } },
              { shippingAddress: { recipientPhone: { contains: search } } },
            ]
          })
          if (status) {
            guestOrderFilters.push(
              status === 'CANCELLED'
                ? { status: { in: ['CANCELLED', 'REFUNDED'] } }
                : { status: status as any }
            )
          }
          const guestOrderWhere = guestOrderFilters.length === 1
            ? guestOrderFilters[0]
            : { AND: guestOrderFilters }

          const guestOrders = await prisma.guestOrder.findMany({
            where: guestOrderWhere,
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
                  shopProduct: {
                    select: {
                      product: {
                        select: {
                          channel: {
                            select: {
                              id: true,
                              kind: true,
                              platform: true,
                              name: true,
                            },
                          },
                        },
                      },
                    },
                  },
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

          for (const order of guestOrders) {
            const productNames = order.items.map(i => i.productName)
            const productSummary = productNames.length > 1
              ? `${productNames[0]} 외 ${productNames.length - 1}개`
              : productNames[0] || '상품 없음'

            // 첫 번째 상품의 도매처 정보 추출
            const firstGuestChannel = order.items[0]?.shopProduct?.product?.channel
            const guestWholesaleChannel = firstGuestChannel?.kind === 'WHOLESALE' ? {
              id: firstGuestChannel.id,
              name: firstGuestChannel.name,
              platform: firstGuestChannel.platform,
            } : null

            const addr = order.shippingAddress
            unifiedOrders.push({
              id: order.id,
              source: 'SHOPPING_MALL',
              orderNumber: order.orderNumber,
              customerName: addr?.recipientName || order.guestName,
              customerPhone: addr?.recipientPhone || order.guestPhone,
              productSummary,
              itemCount: order.items.length,
              totalAmount: Number(order.totalAmount),
              status: order.status,
              statusLabel: statusLabels[order.status] || order.status,
              createdAt: order.orderedAt.toISOString(),
              isGuestOrder: true,
              address: addr ? `${addr.address} ${addr.addressDetail || ''}`.trim() : '',
              deliveryMemo: addr?.deliveryMemo || undefined,
              paymentMethod: order.payment?.method || undefined,
              shopId: order.shop?.id || null,
              shopName: order.shop?.name || null,
              shopSubdomain: order.shop?.subdomain || null,
              wholesaleChannel: guestWholesaleChannel,
            })
          }
        }
      } catch (shopOrderError) {
        console.error('쇼핑몰 주문 조회 실패:', shopOrderError)
        // 쇼핑몰 주문 조회 실패 시 빈 배열로 처리하고 계속 진행
      }
    }

    // 정렬: 최신순
    unifiedOrders.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // 전체 카운트 계산
    statusCounts.total = statusCounts.PENDING + statusCounts.PAID + statusCounts.PREPARING +
                         statusCounts.SHIPPED + statusCounts.DELIVERED + statusCounts.CANCELLED

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
