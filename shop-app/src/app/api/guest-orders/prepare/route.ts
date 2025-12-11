/**
 * Guest Orders Prepare API
 * 비회원 토스 결제 전 주문 정보를 쿠키에 임시 저장
 * 실제 주문은 결제 성공(guest-payments/confirm) 시 생성됨
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import prisma from '@bandauto/db'

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
  items?: { publishedProductId: number; variantId?: number; quantity: number }[]
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

    // Shop의 배송비 설정 조회 (필수)
    let shopFreeShippingAmount: number | null = null
    let shopDefaultShippingFee: number | null = null
    if (shopId) {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { freeShippingAmount: true, defaultShippingFee: true },
      })
      if (shop) {
        shopFreeShippingAmount = shop.freeShippingAmount
        shopDefaultShippingFee = shop.defaultShippingFee
      }
    }

    // 주문 아이템 검증 및 금액 계산
    let orderItems: any[] = []

    if (fromCart) {
      // 세션 장바구니에서 주문
      const sessionId = getSessionId(req)

      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: '장바구니 정보를 찾을 수 없습니다' },
          { status: 400 }
        )
      }

      const cart = await prisma.cart.findFirst({
        where: { sessionId, userId: null, shopId },
        include: {
          items: {
            include: {
              publishedProduct: {
                include: {
                  product: {
                    include: { variants: { take: 1 } },
                  },
                },
              },
              variant: true,
            },
          },
        },
      })

      if (!cart || cart.items.length === 0) {
        return NextResponse.json(
          { success: false, error: '장바구니가 비어있습니다' },
          { status: 400 }
        )
      }

      orderItems = cart.items.map((item) => {
        const publishedProduct = item.publishedProduct
        const product = publishedProduct.product
        const variant = item.variant
        const mainVariant = product.variants[0]
        const unitPrice = variant?.price || mainVariant?.price || 0

        return {
          publishedProductId: publishedProduct.id,
          variantId: variant?.id || null,
          productName: product.name,
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product.thumbnailUrl,
          quantity: item.quantity,
          unitPrice: Number(unitPrice),
        }
      })
    } else {
      // 직접 상품 지정
      if (!items || items.length === 0) {
        return NextResponse.json(
          { success: false, error: '주문 상품이 없습니다' },
          { status: 400 }
        )
      }

      for (const item of items) {
        const publishedProduct = await prisma.publishedProduct.findFirst({
          where: {
            id: parseInt(item.publishedProductId),
          },
          include: {
            product: {
              include: { variants: { take: 1 } },
            },
          },
        })

        if (!publishedProduct) {
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

        const product = publishedProduct.product
        const mainVariant = product.variants[0]
        const unitPrice = variant?.price || mainVariant?.price || 0

        orderItems.push({
          publishedProductId: publishedProduct.id,
          variantId: variant?.id || null,
          productName: product.name,
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product.thumbnailUrl,
          quantity: item.quantity || 1,
          unitPrice: Number(unitPrice),
        })
      }
    }

    // 금액 계산 (Shop의 배송비 설정 사용 - 필수)
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    )
    // 배송비 설정이 없으면 0원 처리
    const shippingFee = (shopFreeShippingAmount != null && shopDefaultShippingFee != null)
      ? (subtotal >= shopFreeShippingAmount ? 0 : shopDefaultShippingFee)
      : 0
    const totalAmount = subtotal + shippingFee

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
        shippingFee,
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        items: orderItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
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
