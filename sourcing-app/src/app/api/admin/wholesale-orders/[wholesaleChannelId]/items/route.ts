import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// 통합 주문 아이템 타입
interface UnifiedOrderItem {
  orderItemId: number
  orderNumber: string
  orderedAt: string
  isMember: boolean
  retailChannelName: string
  productName: string
  optionSummary: string
  quantity: number
  wholesalePrice: number
  totalAmount: number
  customerName: string
  customerPhone: string
  customerAddress: string
  postalCode: string
}

/**
 * GET /api/admin/wholesale-orders/:wholesaleChannelId/items
 * 도매처별 상세 주문 목록 조회 (회원 + 비회원 주문 통합)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wholesaleChannelId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { wholesaleChannelId } = await params
    const channelId = parseInt(wholesaleChannelId)

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

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

    // 결제완료(PAID)만 조회 (배송중/배송완료/취소 제외)

    // 공통 쿼리 조건
    const productCondition = {
      userId: user.userId,
      product: {
        collectedProduct: {
          post: {
            channelId: channelId,
          },
        },
      },
    }

    // 1. 회원 주문 조회
    const memberItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: 'PAID',
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
        },
        publishedProduct: productCondition,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderedAt: true,
            shippingAddress: {
              select: {
                recipientName: true,
                recipientPhone: true,
                postalCode: true,
                address: true,
                addressDetail: true,
              },
            },
            shop: {
              select: {
                id: true,
                name: true,
              },
            },
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
              },
            },
            channel: {
              select: {
                id: true,
                name: true,
                kind: true,
              },
            },
          },
        },
        variant: {
          select: {
            wholesalePrice: true,
            optionSummary: true,
          },
        },
      },
      orderBy: {
        order: {
          orderedAt: 'desc',
        },
      },
    })

    // 2. 비회원 주문 조회
    const guestItems = await prisma.guestOrderItem.findMany({
      where: {
        guestOrder: {
          status: 'PAID',
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
        },
        publishedProduct: productCondition,
      },
      include: {
        guestOrder: {
          select: {
            id: true,
            orderNumber: true,
            orderedAt: true,
            guestName: true,
            guestPhone: true,
            shippingAddress: {
              select: {
                recipientName: true,
                recipientPhone: true,
                postalCode: true,
                address: true,
                addressDetail: true,
              },
            },
            shop: {
              select: {
                id: true,
                name: true,
              },
            },
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
              },
            },
            channel: {
              select: {
                id: true,
                name: true,
                kind: true,
              },
            },
          },
        },
        variant: {
          select: {
            wholesalePrice: true,
            optionSummary: true,
          },
        },
      },
      orderBy: {
        guestOrder: {
          orderedAt: 'desc',
        },
      },
    })

    // 통합 및 정렬
    const unifiedItems: UnifiedOrderItem[] = []

    // 회원 주문 변환
    for (const item of memberItems) {
      const wholesalePrice = getWholesalePrice(item)
      const addr = item.order.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `${addr.address} ${addr.addressDetail}`
        : addr?.address || ''

      let optionSummary = item.optionSummary || item.variant?.optionSummary || null
      if (!optionSummary && item.publishedProduct?.product?.variants?.length) {
        optionSummary = item.publishedProduct.product.variants[0].optionSummary || null
      }

      unifiedItems.push({
        orderItemId: item.id,
        orderNumber: item.order.orderNumber,
        orderedAt: item.order.orderedAt.toISOString(),
        isMember: true,
        retailChannelName: item.publishedProduct?.channel?.name || item.order.shop?.name || '-',
        productName: item.productName,
        optionSummary: optionSummary || '-',
        quantity: item.quantity,
        wholesalePrice: Number(wholesalePrice),
        totalAmount: Number(wholesalePrice) * item.quantity,
        customerName: addr?.recipientName || '',
        customerPhone: maskPhone(addr?.recipientPhone || ''),
        customerAddress: fullAddress,
        postalCode: addr?.postalCode || '',
      })
    }

    // 비회원 주문 변환
    for (const item of guestItems) {
      const wholesalePrice = getWholesalePrice(item)
      const addr = item.guestOrder.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `${addr.address} ${addr.addressDetail}`
        : addr?.address || ''

      let optionSummary = item.optionSummary || item.variant?.optionSummary || null
      if (!optionSummary && item.publishedProduct?.product?.variants?.length) {
        optionSummary = item.publishedProduct.product.variants[0].optionSummary || null
      }

      // 비회원 주문은 shippingAddress가 없을 수 있으므로 guestOrder 정보 사용
      const customerName = addr?.recipientName || item.guestOrder.guestName
      const customerPhone = addr?.recipientPhone || item.guestOrder.guestPhone

      unifiedItems.push({
        orderItemId: item.id,
        orderNumber: item.guestOrder.orderNumber,
        orderedAt: item.guestOrder.orderedAt.toISOString(),
        isMember: false,
        retailChannelName: item.publishedProduct?.channel?.name || item.guestOrder.shop?.name || '-',
        productName: item.productName,
        optionSummary: optionSummary || '-',
        quantity: item.quantity,
        wholesalePrice: Number(wholesalePrice),
        totalAmount: Number(wholesalePrice) * item.quantity,
        customerName,
        customerPhone: maskPhone(customerPhone),
        customerAddress: fullAddress,
        postalCode: addr?.postalCode || '',
      })
    }

    // 날짜 내림차순 정렬
    unifiedItems.sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())

    // 전체 합계 계산
    let totalQuantity = 0
    let totalAmount = 0
    for (const item of unifiedItems) {
      totalQuantity += item.quantity
      totalAmount += item.totalAmount
    }

    // 페이지네이션 적용
    const total = unifiedItems.length
    const paginatedItems = unifiedItems.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      success: true,
      data: {
        items: paginatedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary: {
          totalQuantity,
          totalAmount,
        },
      },
    })
  } catch (error) {
    console.error('도매처 상세 주문 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '상세 주문 조회에 실패했습니다.' },
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

// 전화번호 마스킹 함수 (010-1234-5678 → 010-****-5678)
function maskPhone(phone: string): string {
  if (!phone) return phone
  // 하이픈이 있는 경우
  if (phone.includes('-')) {
    const parts = phone.split('-')
    if (parts.length === 3) {
      return `${parts[0]}-****-${parts[2]}`
    }
  }
  // 하이픈이 없는 경우 (01012345678)
  if (phone.length >= 10) {
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }
  return phone
}
