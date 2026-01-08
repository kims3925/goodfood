export const dynamic = 'force-dynamic'

/**
 * Guest Orders Prepare API
 * 비회원 토스 결제 전 주문 정보를 쿠키에 임시 저장
 * 실제 주문은 결제 성공(guest-payments/confirm) 시 생성됨
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import prisma from '@bandauto/db'
import { getCartService } from '@/modules/cart/services/cart.service'
import { calculateItemPrice } from '@/lib/price-calculator'

// 비회원 주문번호 생성
function generateGuestOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `GORD-${dateStr}-${random}`
}

// 세션 ID 가져오기
function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
}

// 요청 헤더에서 Shop ID 가져오기
async function getShopIdFromHeaders(): Promise<number | null> {
  const headersList = await headers()
  const shopId = headersList.get('x-shop-id')
  return shopId ? parseInt(shopId) : null
}

interface GuestOrderPrepareData {
  orderId: string
  shopId: number | null
  fromCart: boolean
  items?: { shopProductId: number; variantId?: number; quantity: number }[]
  customerInfo: {
    name: string
    phone: string
    email?: string
  }
  shippingAddress: {
    recipientName: string
    recipientPhone: string
    address: string
    postalCode: string
    addressDetail?: string
    deliveryMemo?: string
  }
}

/**
 * POST /api/guest-orders/prepare
 * 비회원 주문 정보 검증 및 임시 저장
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      items,
      customerInfo,
      shippingAddress,
      fromCart = true,
    } = body

    // 고객 정보 검증
    if (!customerInfo?.name || !customerInfo?.phone) {
      return NextResponse.json(
        { success: false, error: '이름과 휴대폰번호는 필수입니다' },
        { status: 400 }
      )
    }

    // 배송 주소 검증
    if (!shippingAddress?.address || !shippingAddress?.postalCode) {
      return NextResponse.json(
        { success: false, error: '배송 주소는 필수입니다' },
        { status: 400 }
      )
    }

    // Shop ID 가져오기 (헤더에서)
    const shopId = await getShopIdFromHeaders()

    // 주문 아이템 검증 및 금액 계산
    let orderItems: any[] = []
    let totalAmount = 0

    if (fromCart) {
      // 세션 장바구니에서 주문 - CartService 사용하여 정확한 가격 계산
      const sessionId = getSessionId(req)

      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: '장바구니 정보를 찾을 수 없습니다' },
          { status: 400 }
        )
      }

      const cartService = getCartService()

      // CartService를 통해 포맷팅된 장바구니 조회 (합배송 가격 적용됨)
      const { cart: formattedCart } = await cartService.getCart(
        sessionId,
        null, // 비회원이므로 userId는 null
        shopId
      )

      if (!formattedCart || formattedCart.items.length === 0) {
        return NextResponse.json(
          { success: false, error: '장바구니가 비어있습니다' },
          { status: 400 }
        )
      }

      // CartService에서 계산된 itemTotal 사용
      orderItems = formattedCart.items.map((item) => ({
        shopProductId: item.shopProductId,
        variantId: item.variantId || null,
        productName: item.name,
        optionSummary: item.optionSummary || null,
        thumbnailUrl: item.image || null,
        quantity: item.quantity,
        unitPrice: item.price, // 배송비 포함된 단가 (합배송 적용)
        itemTotal: item.itemTotal, // 합배송 적용된 정확한 총액
      }))

      // 합배송 적용된 총액 사용
      totalAmount = formattedCart.subtotal
    } else {
      // 직접 상품 지정 (바로구매) - 합배송 로직 적용
      if (!items || items.length === 0) {
        return NextResponse.json(
          { success: false, error: '주문 상품이 없습니다' },
          { status: 400 }
        )
      }

      for (const item of items) {
        const shopProduct = await prisma.shopProduct.findFirst({
          where: {
            id: parseInt(item.shopProductId),
          },
          include: {
            product: {
              include: { variants: true },
            },
          },
        })

        if (!shopProduct) {
          return NextResponse.json(
            { success: false, error: `상품을 찾을 수 없거나 판매 중인 상품이 아닙니다` },
            { status: 404 }
          )
        }

        let variant = null
        if (item.variantId) {
          variant = await prisma.productVariant.findUnique({
            where: { id: parseInt(item.variantId) },
          })
        }

        const product = shopProduct.product
        const mainVariant = product?.variants[0]
        const basePrice = variant?.price || mainVariant?.price || 0
        const quantity = item.quantity || 1

        // 공통 가격 계산 함수 사용
        const shippingFee = product?.shippingFee || 0
        const bundleMaxQty = product?.bundleMaxQty || 1
        const bundleUnit = variant?.bundleUnit || 1

        const priceResult = calculateItemPrice({
          basePrice,
          shippingFee,
          quantity,
          bundleMaxQty,
          bundleUnit,
          bundleShippingType: product?.bundleShippingType || null,
        })

        const itemTotal = priceResult.itemTotal

        orderItems.push({
          shopProductId: shopProduct.id,
          variantId: variant?.id || null,
          productName: product?.name || '',
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product?.thumbnailUrl || null,
          quantity,
          unitPrice: priceResult.unitPrice, // 배송비 포함된 단가 (합배송 적용)
          itemTotal, // 합배송 적용된 총액
        })
      }

      // 직접 상품 주문: 합배송 적용된 총액 사용
      totalAmount = orderItems.reduce((sum, item) => sum + (item.itemTotal || item.unitPrice * item.quantity), 0)
    }

    // 금액 계산 (subtotal은 totalAmount를 사용)
    const subtotal = totalAmount

    // 비회원 주문번호 생성
    const orderId = generateGuestOrderNumber()

    // 주문 준비 데이터
    const prepareData: GuestOrderPrepareData = {
      orderId,
      shopId,
      fromCart,
      items: fromCart ? undefined : items,
      customerInfo: {
        name: customerInfo.name,
        phone: customerInfo.phone,
        email: customerInfo.email,
      },
      shippingAddress: {
        recipientName: shippingAddress.recipientName || customerInfo.name,
        recipientPhone: shippingAddress.recipientPhone || customerInfo.phone,
        address: shippingAddress.address,
        postalCode: shippingAddress.postalCode,
        addressDetail: shippingAddress.addressDetail,
        deliveryMemo: shippingAddress.deliveryMemo,
      },
    }

    // 쿠키에 주문 정보 저장 (base64 인코딩)
    const prepareDataJson = JSON.stringify(prepareData)
    const encodedData = Buffer.from(prepareDataJson).toString('base64')

    const response = NextResponse.json({
      success: true,
      order: {
        orderNumber: orderId,
        totalAmount,
        subtotal,
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        items: orderItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.itemTotal || (item.unitPrice * item.quantity),
        })),
      },
      message: '비회원 주문 준비가 완료되었습니다. 결제를 진행해주세요.',
    })

    // 쿠키 설정 (10분간 유효)
    response.cookies.set('guest_order_prepare', encodedData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10분
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('Guest orders prepare error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '비회원 주문 준비 실패' },
      { status: 500 }
    )
  }
}
