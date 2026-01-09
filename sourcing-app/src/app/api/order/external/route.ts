export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { Prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const Decimal = Prisma.Decimal

/**
 * 외부 주문번호 생성
 * 형식: XORD-YYYYMMDD-XXXXXX (eXternal ORDer)
 */
function generateExternalOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `XORD-${dateStr}-${random}`
}

interface CreateExternalOrderRequest {
  shopId: number
  guestName: string
  guestPhone: string
  guestEmail?: string
  shippingAddress: {
    recipientName: string
    recipientPhone: string
    postalCode: string
    address: string
    addressDetail?: string
    deliveryMemo?: string
  }
  items: Array<{
    shopProductId: number
    variantId?: number
    quantity: number
  }>
  memo?: string
}

/**
 * POST /api/order/external
 *
 * 외부 주문 생성 (문자, 밴드 댓글 등 외부 경로로 받은 주문)
 * GuestOrder 테이블에 PENDING 상태로 저장
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body: CreateExternalOrderRequest = await request.json()
    const { shopId, guestName, guestPhone, guestEmail, shippingAddress, items, memo } = body

    // 입력 검증
    if (!guestName?.trim()) {
      return NextResponse.json(
        { success: false, error: '고객명은 필수입니다.' },
        { status: 400 }
      )
    }

    if (!guestPhone?.trim()) {
      return NextResponse.json(
        { success: false, error: '전화번호는 필수입니다.' },
        { status: 400 }
      )
    }

    if (!shippingAddress?.address || !shippingAddress?.postalCode) {
      return NextResponse.json(
        { success: false, error: '배송 주소는 필수입니다.' },
        { status: 400 }
      )
    }

    if (!shippingAddress?.recipientName || !shippingAddress?.recipientPhone) {
      return NextResponse.json(
        { success: false, error: '수령인 정보는 필수입니다.' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '주문 상품이 없습니다.' },
        { status: 400 }
      )
    }

    // Shop 유효성 검증 (선택적)
    if (shopId) {
      const shop = await prisma.shop.findFirst({
        where: { id: shopId, userId: user.userId, isActive: true },
      })
      if (!shop) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 쇼핑몰입니다.' },
          { status: 400 }
        )
      }
    }

    // 상품 정보 조회 및 주문 아이템 준비
    const orderItems: Array<{
      shopProductId: number
      variantId: number | null
      productName: string
      optionSummary: string | null
      thumbnailUrl: string | null
      quantity: number
      unitPrice: Prisma.Decimal
      totalPrice: Prisma.Decimal
    }> = []
    let subtotal = 0

    for (const item of items) {
      // ShopProduct 조회 (사용자 소유 확인)
      const shopProduct = await prisma.shopProduct.findFirst({
        where: {
          id: item.shopProductId,
          userId: user.userId,
          deletedAt: null,
        },
        include: {
          product: {
            include: {
              variants: true,
            },
          },
        },
      })

      if (!shopProduct || !shopProduct.product) {
        return NextResponse.json(
          { success: false, error: `상품을 찾을 수 없습니다. (ID: ${item.shopProductId})` },
          { status: 400 }
        )
      }

      const product = shopProduct.product
      let variant = null
      let unitPrice = Number(product.price) || 0

      // 옵션(variant) 처리
      if (item.variantId) {
        variant = product.variants.find((v) => v.id === item.variantId)
        if (variant) {
          unitPrice = Number(variant.price)
        }
      } else if (product.variants.length > 0) {
        // 옵션이 있는 상품인데 옵션을 선택하지 않은 경우 첫 번째 옵션 사용
        variant = product.variants[0]
        unitPrice = Number(variant.price)
      }

      const quantity = item.quantity || 1
      const totalPrice = unitPrice * quantity
      subtotal += totalPrice

      orderItems.push({
        shopProductId: shopProduct.id,
        variantId: variant?.id || null,
        productName: product.name,
        optionSummary: variant?.optionSummary || null,
        thumbnailUrl: product.thumbnailUrl,
        quantity,
        unitPrice: new Decimal(unitPrice),
        totalPrice: new Decimal(totalPrice),
      })
    }

    // GuestOrder 생성 (트랜잭션으로 주문 + 아이템 + 배송주소 동시 생성)
    const order = await prisma.guestOrder.create({
      data: {
        shopId: shopId || null,
        orderNumber: generateExternalOrderNumber(),
        status: 'PENDING',
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestEmail: guestEmail?.trim() || null,
        subtotalAmount: new Decimal(subtotal),
        discountAmount: new Decimal(0),
        totalAmount: new Decimal(subtotal),
        orderedAt: new Date(),
        // 메모가 있으면 cancelReason 필드에 임시 저장 (추후 별도 필드 추가 권장)
        cancelReason: memo ? `[외부주문 메모] ${memo}` : null,
        shippingAddress: {
          create: {
            recipientName: shippingAddress.recipientName,
            recipientPhone: shippingAddress.recipientPhone,
            postalCode: shippingAddress.postalCode,
            address: shippingAddress.address,
            addressDetail: shippingAddress.addressDetail || null,
            deliveryMemo: shippingAddress.deliveryMemo || null,
          },
        },
        items: {
          create: orderItems,
        },
      },
      include: {
        shippingAddress: true,
        items: true,
      },
    })

    console.log(`[External Order] 외부 주문 생성 완료: ${order.orderNumber} (${orderItems.length}개 상품, 총 ${subtotal}원)`)

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        itemCount: order.items.length,
      },
    })
  } catch (error) {
    console.error('외부 주문 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '외부 주문 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
