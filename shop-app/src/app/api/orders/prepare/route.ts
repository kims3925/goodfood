export const dynamic = 'force-dynamic'

/**
 * Orders Prepare API
 * 결제 전 주문 정보를 쿠키에 임시 저장
 * 실제 주문은 결제 성공(confirm) 시 생성됨
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { getCartService } from '@/modules/cart/services/cart.service'
import { calculateItemPrice } from '@/lib/price-calculator'
import { isB2bApprovedUser, resolveB2bBasePrice } from '@/lib/b2b'

// Phase 7: 공통 유틸로 이전 — @/lib/order-utils
import {
  generateOrderNumber,
  getCurrentUserId,
  getSessionId,
} from '@/lib/order-utils'

interface OrderPrepareData {
  orderId: string
  userId: number
  shopId?: number | null
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
  coupon?: {
    userCouponId: number
    discountAmount: number
    isFreeShipping: boolean
  }
  // 금액 정보 (prepare 단계에서 계산된 값 - confirm 시 재계산 방지)
  amounts: {
    subtotal: number
    discountAmount: number
    totalAmount: number
  }
  // B2B 공급몰 전환 Phase 3: 승인 사업자 주문이면 'B2B' (공급가 단가)
  orderType?: 'RETAIL' | 'B2B'
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

    // B2B 승인 사업자 여부 (Phase 3) — 승인 회원은 공급가(wholesalePrice) 단가로 주문
    const isB2b = await isB2bApprovedUser(userId)

    // 주문 아이템 검증 및 금액 계산
    let orderItems: any[] = []
    let totalAmount = 0

    // Shop ID 가져오기
    const shopId = getShopId(req)

    if (fromCart) {
      // 장바구니에서 주문 - CartService 사용하여 정확한 가격 계산
      const sessionId = getSessionId(req)
      const cartService = getCartService()

      // CartService를 통해 포맷팅된 장바구니 조회 (합배송 가격 적용됨)
      const { cart: formattedCart } = await cartService.getCart(
        sessionId || '',
        currentUserId,
        shopId
      )

      if (!formattedCart || formattedCart.items.length === 0) {
        return NextResponse.json(
          { success: false, error: '장바구니가 비어있습니다' },
          { status: 400 }
        )
      }

      // 품절(비활성) 상품 체크
      const rawCart = currentUserId
        ? await prisma.cart.findFirst({
            where: { userId: currentUserId, shopId },
            include: {
              items: {
                include: {
                  shopProduct: true,
                },
              },
            },
          })
        : sessionId
          ? await prisma.cart.findFirst({
              where: { sessionId, userId: null, shopId },
              include: {
                items: {
                  include: {
                    shopProduct: true,
                  },
                },
              },
            })
          : null

      // 품절 체크는 Product 레벨의 재고 관리로 대체됨 (ShopProduct에서 isActive 필드 제거됨)

      if (isB2b) {
        // B2B 승인 사업자 (Phase 3): 공급가 기준으로 재계산
        // (CartService 는 소매가 기준이라, variant 공급가로 동일한 합배송 로직을 다시 적용)
        orderItems = []
        for (const item of formattedCart.items) {
          const variant = item.variantId
            ? await prisma.productVariant.findUnique({ where: { id: item.variantId } })
            : null
          const sp = await prisma.shopProduct.findFirst({
            where: { id: item.shopProductId },
            include: { product: { include: { variants: true } } },
          })
          const product = sp?.product
          const mainVariant = product?.variants[0]
          const basePrice = resolveB2bBasePrice(true, variant, mainVariant)
          const priceResult = calculateItemPrice({
            basePrice,
            shippingFee: product?.shippingFee || 0,
            quantity: item.quantity,
            bundleMaxQty: product?.bundleMaxQty || 1,
            bundleUnit: variant?.bundleUnit || 1,
            bundleShippingType: product?.bundleShippingType || null,
          })
          orderItems.push({
            shopProductId: item.shopProductId,
            variantId: item.variantId || null,
            productName: item.name,
            optionSummary: item.optionSummary || null,
            thumbnailUrl: item.image || null,
            quantity: item.quantity,
            unitPrice: priceResult.unitPrice,
            itemTotal: priceResult.itemTotal,
          })
        }
        totalAmount = orderItems.reduce((sum, item) => sum + (item.itemTotal || item.unitPrice * item.quantity), 0)
      } else {
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
      }
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

        // 품절 체크는 Product 레벨의 재고 관리로 대체됨 (ShopProduct에서 isActive 필드 제거됨)

        let variant = null
        if (item.variantId) {
          variant = await prisma.productVariant.findUnique({
            where: { id: parseInt(item.variantId) },
          })
        }

        const product = shopProduct.product
        const mainVariant = product?.variants[0]
        // B2B 승인 사업자는 공급가 단가 (Phase 3), 아니면 소매가
        const basePrice = resolveB2bBasePrice(isB2b, variant, mainVariant)
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

        // 가격 계산 디버그 로그 (개발 환경에서만 출력)
        if (process.env.NODE_ENV === 'development') {
          console.log('[Orders Prepare] 바로구매 가격 계산:', {
            productName: product?.name,
            basePrice,
            shippingFee,
            bundleShippingType: product?.bundleShippingType,
            quantity,
            unitPrice: priceResult.unitPrice,
            itemTotal,
          })
        }

        orderItems.push({
          shopProductId: shopProduct.id,
          variantId: variant?.id || null,
          productName: product?.name || "",
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
    // 배송비는 상품별 설정 또는 0원 처리
    let shippingFee = 0
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

    // 최종 결제 금액 로그 (개발 환경에서만 출력)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Orders Prepare] 최종 결제 금액:', {
        subtotal,
        shippingFee,
        discountAmount,
        totalAmount,
      })
    }

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
        discountAmount,
        totalAmount,
      },
      // B2B 주문 구분 (Phase 3) — confirm 시 Order.orderType 저장 + 공급가 단가 재계산
      orderType: isB2b ? 'B2B' : 'RETAIL',
    }

    // Phase 4: HMAC 서명으로 무결성 보장 (totalAmount 변조 방지) + 30분 만료 stamp
    const { signOrderData } = await import('@/lib/order-signature')
    const encodedData = signOrderData({ ...prepareData, _ts: Date.now() })

    const response = NextResponse.json({
      success: true,
      order: {
        orderNumber: orderId,
        totalAmount,
        subtotal,
        discountAmount,
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        items: orderItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.itemTotal || (item.unitPrice * item.quantity),
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
