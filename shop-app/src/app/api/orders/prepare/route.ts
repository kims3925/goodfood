/**
 * Orders Prepare API
 * 결제 전 주문 정보를 쿠키에 임시 저장
 * 실제 주문은 결제 성공(confirm) 시 생성됨
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'

// 주문번호 생성
function generateOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ORD-${dateStr}-${random}`
}

// 현재 로그인한 사용자 ID 가져오기
async function getCurrentUserId(): Promise<number | null> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return null
    return typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id
  } catch {
    return null
  }
}

// 세션 ID 가져오기
function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
}

interface OrderPrepareData {
  orderId: string
  userId: number
  shopId?: number | null
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
  coupon?: {
    userCouponId: number
    discountAmount: number
    isFreeShipping: boolean
  }
  // 금액 정보 (prepare 단계에서 계산된 값 - confirm 시 재계산 방지)
  amounts: {
    subtotal: number
    shippingFee: number
    discountAmount: number
    totalAmount: number
  }
}

// Shop ID 가져오기 (미들웨어에서 설정)
function getShopId(req: NextRequest): number | null {
  const shopIdHeader = req.headers.get('x-shop-id')
  return shopIdHeader ? parseInt(shopIdHeader) : null
}

/**
 * POST /api/orders/prepare
 * 주문 정보 검증 및 임시 저장
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      items,
      customerInfo,
      shippingAddress,
      fromCart = true,
      userId: bodyUserId,
      coupon: couponData,
    } = body

    // 고객 정보 검증
    if (!customerInfo?.name || !customerInfo?.phone) {
      return NextResponse.json(
        { success: false, error: '고객 정보(이름, 전화번호)는 필수입니다' },
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

    // 로그인 체크
    const currentUserId = await getCurrentUserId()
    const userId = bodyUserId || currentUserId

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 주문 아이템 검증 및 금액 계산
    let orderItems: any[] = []
    let totalAmount = 0

    // Shop ID 가져오기
    const shopId = getShopId(req)

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

    if (fromCart) {
      // 장바구니에서 주문
      const sessionId = getSessionId(req)

      let cart = null
      if (currentUserId) {
        cart = await prisma.cart.findFirst({
          where: { userId: currentUserId, shopId },
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
      } else if (sessionId) {
        cart = await prisma.cart.findFirst({
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
      }

      if (!cart || cart.items.length === 0) {
        return NextResponse.json(
          { success: false, error: '장바구니가 비어있습니다' },
          { status: 400 }
        )
      }

      // 품절(비활성) 상품 체크
      const soldOutItems = cart.items.filter((item) => !item.publishedProduct.isActive)
      if (soldOutItems.length > 0) {
        const soldOutNames = soldOutItems.map((item) => item.publishedProduct.product.name).join(', ')
        return NextResponse.json(
          { success: false, error: `품절된 상품이 포함되어 있습니다: ${soldOutNames}` },
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

        // 품절(비활성) 상품 체크
        if (!publishedProduct.isActive) {
          return NextResponse.json(
            { success: false, error: `품절된 상품입니다: ${publishedProduct.product.name}` },
            { status: 400 }
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
    let shippingFee = (shopFreeShippingAmount != null && shopDefaultShippingFee != null)
      ? (subtotal >= shopFreeShippingAmount ? 0 : shopDefaultShippingFee)
      : 0
    let discountAmount = 0

    // 쿠폰 처리
    let validCoupon: {
      userCouponId: number
      discountAmount: number
      isFreeShipping: boolean
    } | undefined = undefined

    if (couponData?.userCouponId) {
      const userCoupon = await prisma.userCoupon.findUnique({
        where: { id: couponData.userCouponId },
        include: { coupon: true },
      })

      if (userCoupon && !userCoupon.isUsed && userCoupon.coupon.isActive) {
        const coupon = userCoupon.coupon
        const now = new Date()

        // 유효기간 체크
        if (now >= coupon.validFrom && now <= coupon.validUntil) {
          // 최소 주문금액 체크
          const minAmount = coupon.minPurchaseAmount ? Number(coupon.minPurchaseAmount) : 0
          if (subtotal >= minAmount) {
            if (coupon.discountType === 'FREE_SHIPPING') {
              // 무료배송 쿠폰
              validCoupon = {
                userCouponId: userCoupon.id,
                discountAmount: shippingFee,
                isFreeShipping: true,
              }
              shippingFee = 0
            } else if (coupon.discountType === 'PERCENTAGE') {
              // 정률 할인
              let discount = Math.floor(subtotal * (Number(coupon.discountValue) / 100))
              const maxDiscount = coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : Infinity
              discount = Math.min(discount, maxDiscount)
              discountAmount = discount
              validCoupon = {
                userCouponId: userCoupon.id,
                discountAmount: discount,
                isFreeShipping: false,
              }
            } else {
              // 정액 할인 (FIXED, FIXED_AMOUNT)
              discountAmount = Math.min(Number(coupon.discountValue), subtotal)
              validCoupon = {
                userCouponId: userCoupon.id,
                discountAmount,
                isFreeShipping: false,
              }
            }
          }
        }
      }
    }

    totalAmount = subtotal + shippingFee - discountAmount

    // 주문번호 생성
    const orderId = generateOrderNumber()

    // 주문 준비 데이터
    const prepareData: OrderPrepareData = {
      orderId,
      userId,
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
      coupon: validCoupon,
      // 금액 정보 (confirm 시 재계산 방지를 위해 저장)
      amounts: {
        subtotal,
        shippingFee,
        discountAmount,
        totalAmount,
      },
    }

    // 쿠키에 주문 정보 저장 (암호화된 JSON)
    const prepareDataJson = JSON.stringify(prepareData)
    const encodedData = Buffer.from(prepareDataJson).toString('base64')

    const response = NextResponse.json({
      success: true,
      order: {
        orderNumber: orderId,
        totalAmount,
        subtotal,
        shippingFee,
        discountAmount,
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        items: orderItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
        })),
        coupon: validCoupon ? {
          discountAmount: validCoupon.discountAmount,
          isFreeShipping: validCoupon.isFreeShipping,
        } : null,
      },
      message: '주문 준비가 완료되었습니다. 결제를 진행해주세요.',
    })

    // 쿠키 설정 (10분간 유효)
    response.cookies.set('order_prepare', encodedData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10분
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('Orders prepare error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 준비 실패' },
      { status: 500 }
    )
  }
}
