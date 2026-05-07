export const dynamic = 'force-dynamic'

/**
 * 무통장입금 주문 생성 API
 * 토스 결제 없이 바로 주문 생성
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import prisma from '@bandauto/db'
import { CustomerOrderStatus, TossPaymentMethod, TossPaymentStatus } from '@bandauto/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import { calculateItemPrice } from '@/lib/price-calculator'

// Phase 7: 공통 유틸로 이전
import { generateOrderNumber, getCurrentUserId, getSessionId } from '@/lib/order-utils'

// 결제키 생성 (무통장입금용 — bank-transfer 전용 로직)
function generatePaymentKey(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `BT-${timestamp}-${random}`.toUpperCase()
}

// 입금 기한 계산 (3시간 후)
function getDepositDeadline(): Date {
  const deadline = new Date()
  deadline.setHours(deadline.getHours() + 3)
  return deadline
}

// 요청 헤더에서 Shop ID 가져오기
async function getShopIdFromHeaders(): Promise<number | null> {
  const headersList = await headers()
  const shopId = headersList.get('x-shop-id')
  return shopId ? parseInt(shopId) : null
}

/**
 * POST /api/orders/bank-transfer
 * 무통장입금 주문 생성
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      items,
      shippingAddress,
      fromCart = true,
      userId: bodyUserId,
      coupon: couponData,
    } = body

    // 배송 주소 검증 (수령인 정보 포함)
    if (!shippingAddress?.address || !shippingAddress?.postalCode) {
      return NextResponse.json(
        { success: false, error: '배송 주소는 필수입니다' },
        { status: 400 }
      )
    }

    if (!shippingAddress?.recipientName || !shippingAddress?.recipientPhone) {
      return NextResponse.json(
        { success: false, error: '수령인 정보(이름, 전화번호)는 필수입니다' },
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

    // Shop ID 가져오기 (헤더에서)
    const shopId = await getShopIdFromHeaders()
    if (!shopId) {
      return NextResponse.json(
        { success: false, error: 'Shop 정보를 찾을 수 없습니다' },
        { status: 400 }
      )
    }

    // Shop 계좌정보 조회
    const shop = await prisma.shop.findFirst({
      where: {
        id: shopId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        bankName: true,
        bankAccount: true,
        accountHolder: true,
      },
    })

    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (!shop.bankName || !shop.bankAccount || !shop.accountHolder) {
      return NextResponse.json(
        { success: false, error: 'Shop에 입금정보가 등록되어 있지 않습니다. 관리자에게 문의해주세요.' },
        { status: 400 }
      )
    }

    // 주문 아이템 검증 및 금액 계산
    let orderItems: any[] = []

    let totalAmount = 0

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
                shopProduct: {
                  include: {
                    product: {
                      include: { variants: true },
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
                shopProduct: {
                  include: {
                    product: {
                      include: { variants: true },
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

      orderItems = cart.items.map((item) => {
        const shopProduct = item.shopProduct
        const product = shopProduct.product
        const variant = item.variant
        const mainVariant = product?.variants[0]
        const basePrice = variant?.price || mainVariant?.price || 0
        const quantity = item.quantity

        // 공통 가격 계산 함수 사용
        const shippingFee = product?.shippingFee || 0
        const bundleMaxQty = product?.bundleMaxQty || 1
        const bundleUnit = variant?.bundleUnit || 1

        const priceResult = calculateItemPrice({
          basePrice: Number(basePrice),
          shippingFee,
          quantity,
          bundleMaxQty,
          bundleUnit,
          bundleShippingType: product?.bundleShippingType || null,
        })

        return {
          shopProductId: shopProduct.id,
          variantId: variant?.id || null,
          productName: product?.name || "",
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product?.thumbnailUrl || null,
          quantity,
          unitPrice: priceResult.originalPrice,
          itemTotal: priceResult.itemTotal,
        }
      })

      // 합배송 적용된 총액 사용
      totalAmount = orderItems.reduce((sum, item) => sum + item.itemTotal, 0)
    } else {
      // 직접 상품 지정 (바로구매)
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
          basePrice: Number(basePrice),
          shippingFee,
          quantity,
          bundleMaxQty,
          bundleUnit,
          bundleShippingType: product?.bundleShippingType || null,
        })

        orderItems.push({
          shopProductId: shopProduct.id,
          variantId: variant?.id || null,
          productName: product?.name || "",
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product?.thumbnailUrl || null,
          quantity,
          unitPrice: priceResult.originalPrice,
          itemTotal: priceResult.itemTotal,
        })
      }

      // 합배송 적용된 총액 사용
      totalAmount = orderItems.reduce((sum, item) => sum + item.itemTotal, 0)
    }

    // 금액 계산 (합배송 적용된 총액 사용)
    const subtotal = totalAmount
    let shippingFee = 0
    let discountAmount = 0
    const depositDeadline = getDepositDeadline()

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

    const finalTotalAmount = subtotal + shippingFee - discountAmount

    // 트랜잭션으로 주문 생성 (주문자 정보는 user 테이블에서)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Order 생성
      const orderNumber = generateOrderNumber()
      const order = await tx.order.create({
        data: {
          userId,
          shopId,
          orderNumber,
          status: CustomerOrderStatus.PENDING,
          // 금액 정보
          subtotalAmount: subtotal,
          discountAmount,
          totalAmount: finalTotalAmount,
          items: {
            create: orderItems.map((item) => ({
              shopProductId: item.shopProductId,
              variantId: item.variantId,
              productName: item.productName,
              optionSummary: item.optionSummary,
              thumbnailUrl: item.thumbnailUrl,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.itemTotal, // 합배송 적용된 총액
            })),
          },
          // 배송지 정보 (수령인 - ShippingAddress 테이블에 저장)
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
        },
        include: {
          items: true,
          shippingAddress: true,
        },
      })

      // 2. Payment 생성
      const paymentKey = generatePaymentKey()
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          paymentKey,
          tossOrderId: orderNumber,
          method: TossPaymentMethod.BANK_TRANSFER,
          status: TossPaymentStatus.WAITING_FOR_DEPOSIT,
          amount: finalTotalAmount,
          virtualAccountBank: shop.bankName,
          virtualAccountNumber: shop.bankAccount,
          virtualAccountDueDate: depositDeadline,
        },
      })

      // 3. 장바구니 비우기 (fromCart인 경우)
      if (fromCart && currentUserId) {
        const cart = await tx.cart.findFirst({
          where: { userId: currentUserId },
        })
        if (cart) {
          await tx.cartItem.deleteMany({
            where: { cartId: cart.id },
          })
        }
      }

      // 4. 쿠폰 주문 연결 (입금 대기 상태이므로 isUsed는 false 유지)
      // 입금 확인 시점에 isUsed: true로 변경됨
      if (validCoupon?.userCouponId) {
        await tx.userCoupon.update({
          where: { id: validCoupon.userCouponId },
          data: {
            orderId: order.id,
          },
        })
      }

      return { order, payment }
    })

    return NextResponse.json({
      success: true,
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        totalAmount: Number(result.order.totalAmount),
        subtotal: Number(result.order.subtotalAmount),
        discountAmount: Number(result.order.discountAmount),
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        items: orderItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.itemTotal, // 합배송 적용된 총액
        })),
        coupon: validCoupon ? {
          discountAmount: validCoupon.discountAmount,
          isFreeShipping: validCoupon.isFreeShipping,
        } : null,
      },
      bankInfo: {
        bankName: shop.bankName,
        bankAccount: shop.bankAccount,
        accountHolder: shop.accountHolder,
        depositDeadline: depositDeadline.toISOString(),
        orderedAt: new Date().toISOString(),
      },
      message: '무통장입금 주문이 완료되었습니다. 입금 확인 후 배송이 시작됩니다.',
    })
  } catch (error: any) {
    console.error('Bank transfer order error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '무통장입금 주문 생성 실패' },
      { status: 500 }
    )
  }
}
