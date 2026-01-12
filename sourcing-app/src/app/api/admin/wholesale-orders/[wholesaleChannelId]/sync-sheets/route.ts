export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { googleSheetsService, SheetRowData } from '@/services/google-sheets.service'

/**
 * POST /api/admin/wholesale-orders/:wholesaleChannelId/sync-sheets
 * 도매처별 발주서를 구글 시트로 동기화
 */
export async function POST(
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

    // 도매처 정보 조회
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '도매처를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 공통 쿼리 조건
    const productCondition = {
      userId: user.userId,
      product: {
        channelId: channelId,
      },
    }

    // 1. 회원 주문 조회
    const memberItems = await prisma.orderItem.findMany({
      where: {
        order: {
          paidAt: { not: null },
        },
        shopProduct: productCondition,
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            orderedAt: true,
            status: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            shippingAddress: {
              select: {
                recipientName: true,
                recipientPhone: true,
                postalCode: true,
                address: true,
                addressDetail: true,
              },
            },
          },
        },
        shopProduct: {
          include: {
            shop: {
              select: {
                name: true,
              },
            },
            product: {
              select: {
                shippingFee: true,
                bundleMaxQty: true,
                variants: {
                  select: {
                    optionSummary: true,
                    wholesalePrice: true,
                    bundleUnit: true,
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

    // 2. 비회원 주문 조회
    const guestItems = await prisma.guestOrderItem.findMany({
      where: {
        guestOrder: {
          paidAt: { not: null },
        },
        shopProduct: productCondition,
      },
      include: {
        guestOrder: {
          select: {
            orderNumber: true,
            orderedAt: true,
            status: true,
            guestName: true,
            guestPhone: true,
            guestEmail: true,
            shippingAddress: {
              select: {
                recipientName: true,
                recipientPhone: true,
                postalCode: true,
                address: true,
                addressDetail: true,
              },
            },
          },
        },
        shopProduct: {
          include: {
            shop: {
              select: {
                name: true,
              },
            },
            product: {
              select: {
                shippingFee: true,
                bundleMaxQty: true,
                variants: {
                  select: {
                    optionSummary: true,
                    wholesalePrice: true,
                    bundleUnit: true,
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

    // 통합 데이터 준비
    const sheetRows: SheetRowData[] = []

    // 회원 주문 변환
    for (const item of memberItems) {
      const wholesalePrice = getWholesalePrice(item)
      const productAmount = Number(wholesalePrice) * item.quantity
      const shippingFee = calculateShippingFee(item)
      const totalAmount = productAmount + shippingFee

      const addr = item.order.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `(${addr.postalCode}) ${addr.address} ${addr.addressDetail}`
        : `(${addr?.postalCode || ''}) ${addr?.address || ''}`

      const orderDate = new Date(item.order.orderedAt)
      const dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`
      const timestamp = `${dateKey} ${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}`

      const recipientName = addr?.recipientName || ''
      const orderUserName = (item.order as any).user?.name || ''
      const senderName = recipientName !== orderUserName && orderUserName ? orderUserName : ''

      const shippedStatuses = ['SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED']
      const isShipped = shippedStatuses.includes(item.order.status)

      sheetRows.push({
        orderNumber: item.order.orderNumber,
        shopName: item.shopProduct?.shop?.name || '-',
        timestamp,
        productName: item.productName,
        quantity: item.quantity,
        productAmount,
        shippingFee,
        totalAmount,
        recipientName,
        recipientPhone: addr?.recipientPhone || '',
        fullAddress,
        senderName,
        cashReceipt: '',
        email: (item.order as any).user?.email || '',
        dateKey,
        isShipped,
      })
    }

    // 비회원 주문 변환
    for (const item of guestItems) {
      const wholesalePrice = getWholesalePrice(item)
      const productAmount = Number(wholesalePrice) * item.quantity
      const shippingFee = calculateShippingFee(item)
      const totalAmount = productAmount + shippingFee

      const addr = item.guestOrder.shippingAddress
      const fullAddress = addr?.addressDetail
        ? `(${addr.postalCode}) ${addr.address} ${addr.addressDetail}`
        : `(${addr?.postalCode || ''}) ${addr?.address || ''}`

      const orderDate = new Date(item.guestOrder.orderedAt)
      const dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`
      const timestamp = `${dateKey} ${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}`

      const recipientName = addr?.recipientName || item.guestOrder.guestName
      const guestName = item.guestOrder.guestName
      const senderName = recipientName !== guestName ? guestName : ''

      const shippedStatuses = ['SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED']
      const isShipped = shippedStatuses.includes(item.guestOrder.status)

      sheetRows.push({
        orderNumber: item.guestOrder.orderNumber,
        shopName: item.shopProduct?.shop?.name || '-',
        timestamp,
        productName: item.productName,
        quantity: item.quantity,
        productAmount,
        shippingFee,
        totalAmount,
        recipientName,
        recipientPhone: addr?.recipientPhone || item.guestOrder.guestPhone,
        fullAddress,
        senderName,
        cashReceipt: '',
        email: item.guestOrder.guestEmail || '',
        dateKey,
        isShipped,
      })
    }

    // 날짜순 정렬 (내림차순)
    sheetRows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    console.log(`[구글 시트 동기화] 도매처: ${channel.name}, 회원주문: ${memberItems.length}건, 비회원주문: ${guestItems.length}건, 총: ${sheetRows.length}건`)

    // 데이터가 없으면 알림
    if (sheetRows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          success: true,
          message: '동기화할 주문이 없습니다. (결제 완료된 주문이 없음)',
          url: null,
        },
      })
    }

    // 구글 시트로 동기화
    const result = await googleSheetsService.syncOrdersToSheet(
      user.userId,
      channel.name,
      sheetRows
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('구글 시트 동기화 실패:', error)

    if (error.message.includes('설정')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    if (error.code === 403) {
      return NextResponse.json(
        { success: false, error: '스프레드시트에 접근 권한이 없습니다. 서비스 계정 이메일을 시트에 공유해주세요.' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { success: false, error: '구글 시트 동기화에 실패했습니다.' },
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

// 합배송 단위 배송비 계산 헬퍼 함수
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

  const totalUnits = item.quantity * bundleUnit
  const bundleCount = Math.ceil(totalUnits / bundleMaxQty)

  return bundleCount * shippingFee
}
