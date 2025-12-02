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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const unifiedOrders: UnifiedOrder[] = []

    // 1. 쇼핑몰 주문 조회 (source가 ALL 또는 SHOPPING_MALL인 경우)
    // Order.userId는 고객 ID이므로, PublishedProduct를 통해 관리자의 상품이 포함된 주문을 조회
    if (!source || source === 'ALL' || source === 'SHOPPING_MALL') {
      const shopOrders = await prisma.order.findMany({
        where: {
          // 관리자가 발행한 상품이 포함된 주문 조회
          items: {
            some: {
              publishedProduct: {
                userId: user.userId,
              },
            },
          },
          ...(search && {
            OR: [
              { orderNumber: { contains: search } },
              { recipientName: { contains: search } },
              { recipientPhone: { contains: search } },
            ],
          }),
          ...(status && { status: status as any }),
        },
        include: {
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

        unifiedOrders.push({
          id: order.id,
          source: 'SHOPPING_MALL',
          orderNumber: order.orderNumber,
          customerName: order.recipientName,
          customerPhone: order.recipientPhone,
          productSummary,
          itemCount: order.items.length,
          totalAmount: Number(order.totalAmount),
          status: order.status,
          statusLabel: statusLabels[order.status] || order.status,
          createdAt: order.orderedAt.toISOString(),
          address: `${order.address} ${order.addressDetail || ''}`.trim(),
          deliveryMemo: order.deliveryMemo || undefined,
          paymentMethod: order.payment?.method || undefined,
        })
      }
    }

    // 2. 구글폼 주문 조회 (source가 ALL 또는 GOOGLE_FORM인 경우)
    if (!source || source === 'ALL' || source === 'GOOGLE_FORM') {
      const formOrders = await prisma.orderTest.findMany({
        where: {
          userId: user.userId,
          ...(search && {
            OR: [
              { productName: { contains: search } },
              { customerName: { contains: search } },
            ],
          }),
        },
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

    // 정렬: 최신순
    unifiedOrders.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // 페이지네이션
    const total = unifiedOrders.length
    const totalPages = Math.ceil(total / limit)
    const paginatedOrders = unifiedOrders.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      success: true,
      data: {
        orders: paginatedOrders,
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
