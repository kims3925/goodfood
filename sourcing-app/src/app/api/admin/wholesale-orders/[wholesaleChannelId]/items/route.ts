export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// 통합 주문 아이템 타입
interface UnifiedOrderItem {
  orderItemId: number
  orderId: number  // 발주완료 처리용
  orderNumber: string
  orderedAt: string
  isMember: boolean
  retailChannelName: string
  productName: string
  optionSummary: string
  quantity: number
  productAmount: number  // 상품금액 (도매가 × 수량)
  shippingFee: number    // 배송비 (합배송 단위로 계산)
  totalAmount: number    // 합산금액 (상품금액 + 배송비)
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

    // 배송 시작 전 주문만 조회 (PAID, PREPARING = 발주 대상)

    // 공통 쿼리 조건 (Product의 channelId 참조 - 소싱 출처인 도매처)
    const productCondition = {
      userId: user.userId,
      product: {
        channelId: channelId,
      },
    }

    // 1. 회원 주문 조회 (배송 시작 전)
    const memberItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: ['PAID', 'PREPARING'] },
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
        },
        shopProduct: productCondition,
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
        shopProduct: {
          include: {
            product: {
              select: {
                shippingFee: true,
                bundleMaxQty: true,
                variants: {
                  select: {
                    id: true,
                    optionSummary: true,
                    wholesalePrice: true,
                    bundleUnit: true,
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
          },
        },
        variant: {
          select: {
            wholesalePrice: true,
            optionSummary: true,
            bundleUnit: true,
          },
        },
      },
      orderBy: {
        order: {
          orderedAt: 'desc',
        },
      },
    })

    // 2. 비회원 주문 조회 (배송 시작 전)
    const guestItems = await prisma.guestOrderItem.findMany({
      where: {
        guestOrder: {
          status: { in: ['PAID', 'PREPARING'] },
          paidAt: {
            not: null,
            gte: fromDate,
            lte: toDate,
          },
        },
        shopProduct: productCondition,
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
        shopProduct: {
          include: {
            product: {
              select: {
                shippingFee: true,
                bundleMaxQty: true,
                variants: {
                  select: {
                    id: true,
                    optionSummary: true,
                    wholesalePrice: true,
                    bundleUnit: true,
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
          },
        },
        variant: {
          select: {
            wholesalePrice: true,
            optionSummary: true,
            bundleUnit: true,
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
      const shippingFee = calculateShippingFee(item)
      const productAmount = Number(wholesalePrice) * item.quantity
      const totalAmount = productAmount + shippingFee

      const addr = item.order.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `${addr.address} ${addr.addressDetail}`
        : addr?.address || ''

      let optionSummary = item.optionSummary || item.variant?.optionSummary || null
      if (!optionSummary && item.shopProduct?.product?.variants?.length) {
        optionSummary = item.shopProduct.product.variants[0].optionSummary || null
      }

      unifiedItems.push({
        orderItemId: item.id,
        orderId: item.order.id,
        orderNumber: item.order.orderNumber,
        orderedAt: item.order.orderedAt.toISOString(),
        isMember: true,
        retailChannelName: item.shopProduct?.product?.channel?.name || item.order.shop?.name || '-',
        productName: item.productName,
        optionSummary: optionSummary || '-',
        quantity: item.quantity,
        productAmount,
        shippingFee,
        totalAmount,
        customerName: addr?.recipientName || '',
        customerPhone: maskPhone(addr?.recipientPhone || ''),
        customerAddress: fullAddress,
        postalCode: addr?.postalCode || '',
      })
    }

    // 비회원 주문 변환
    for (const item of guestItems) {
      const wholesalePrice = getWholesalePrice(item)
      const shippingFee = calculateShippingFee(item)
      const productAmount = Number(wholesalePrice) * item.quantity
      const totalAmount = productAmount + shippingFee

      const addr = item.guestOrder.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `${addr.address} ${addr.addressDetail}`
        : addr?.address || ''

      let optionSummary = item.optionSummary || item.variant?.optionSummary || null
      if (!optionSummary && item.shopProduct?.product?.variants?.length) {
        optionSummary = item.shopProduct.product.variants[0].optionSummary || null
      }

      // 비회원 주문은 shippingAddress가 없을 수 있으므로 guestOrder 정보 사용
      const customerName = addr?.recipientName || item.guestOrder.guestName
      const customerPhone = addr?.recipientPhone || item.guestOrder.guestPhone

      unifiedItems.push({
        orderItemId: item.id,
        orderId: item.guestOrder.id,
        orderNumber: item.guestOrder.orderNumber,
        orderedAt: item.guestOrder.orderedAt.toISOString(),
        isMember: false,
        retailChannelName: item.shopProduct?.product?.channel?.name || item.guestOrder.shop?.name || '-',
        productName: item.productName,
        optionSummary: optionSummary || '-',
        quantity: item.quantity,
        productAmount,
        shippingFee,
        totalAmount,
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

// 합배송 단위 배송비 계산 헬퍼 함수
// 계산 공식: ceil((수량 * bundleUnit) / bundleMaxQty) * shippingFee
function calculateShippingFee(item: {
  quantity: number
  variant?: { bundleUnit?: number | null } | null
  shopProduct?: {
    product?: {
      shippingFee?: number | null
      bundleMaxQty?: number | null
      variants?: { bundleUnit?: number | null }[]
    } | null
  } | null
}): number {
  const product = item.shopProduct?.product
  if (!product) return 0

  const shippingFee = product.shippingFee || 0
  if (shippingFee === 0) return 0

  const bundleMaxQty = product.bundleMaxQty || 1
  const bundleUnit = item.variant?.bundleUnit || product.variants?.[0]?.bundleUnit || 1

  // 실제 묶음 단위 수량 계산 (예: 수량 3, bundleUnit 2 = 6개 단위)
  const totalUnits = item.quantity * bundleUnit

  // 합배송 묶음 수 계산 (예: 6개 / bundleMaxQty 4 = 2묶음)
  const bundleCount = Math.ceil(totalUnits / bundleMaxQty)

  return bundleCount * shippingFee
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
