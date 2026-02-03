export const dynamic = 'force-dynamic'

/**
 * 비회원 무통장입금 주문 생성 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import prisma, { Prisma } from '@bandauto/db'
import { generateGuestAccessToken } from '@/lib/guest-token'
import { calculateItemPrice } from '@/lib/price-calculator'
import { sendBankTransferOrderWebhook } from '@/services/order-webhook.service'

const Decimal = Prisma.Decimal

// 주문번호 생성
function generateOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `GORD-${dateStr}-${random}`
}

// 결제키 생성 (무통장입금용)
function generatePaymentKey(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `GBT-${timestamp}-${random}`.toUpperCase()
}

// 세션 ID 가져오기
function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
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
 * POST /api/guest-orders/bank-transfer
 * 비회원 무통장입금 주문 생성
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
          productName: product?.name || '',
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product?.thumbnailUrl || null,
          quantity,
          unitPrice: priceResult.originalPrice,
          itemTotal: priceResult.itemTotal,
          cartId: cart.id,
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
          productName: product?.name || '',
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
    const shippingFee = 0
    const depositDeadline = getDepositDeadline()

    // 트랜잭션으로 비회원 주문 생성
    const result = await prisma.$transaction(async (tx) => {
      // 1. GuestOrder 생성
      const orderNumber = generateOrderNumber()
      const guestOrder = await tx.guestOrder.create({
        data: {
          shopId,
          orderNumber,
          status: 'PENDING',
          // 비회원 주문자 정보
          guestName: customerInfo.name,
          guestPhone: customerInfo.phone,
          guestEmail: customerInfo.email || null,
          // 금액 정보
          subtotalAmount: new Decimal(subtotal),
          discountAmount: new Decimal(0),
          totalAmount: new Decimal(totalAmount),
          items: {
            create: orderItems.map((item) => ({
              shopProductId: item.shopProductId,
              variantId: item.variantId,
              productName: item.productName,
              optionSummary: item.optionSummary,
              thumbnailUrl: item.thumbnailUrl,
              quantity: item.quantity,
              unitPrice: new Decimal(item.unitPrice),
              totalPrice: new Decimal(item.itemTotal), // 합배송 적용된 총액
            })),
          },
          // 배송지 정보 (ShippingAddress 테이블에 저장)
          shippingAddress: {
            create: {
              recipientName: shippingAddress.recipientName || customerInfo.name,
              recipientPhone: shippingAddress.recipientPhone || customerInfo.phone,
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

      // 2. GuestPayment 생성
      const paymentKey = generatePaymentKey()
      const payment = await tx.guestPayment.create({
        data: {
          guestOrderId: guestOrder.id,
          method: 'BANK_TRANSFER',
          paymentKey,
          amount: new Decimal(totalAmount),
          status: 'WAITING_FOR_DEPOSIT',
          virtualAccountBank: shop.bankName,
          virtualAccountNumber: shop.bankAccount,
          virtualAccountDueDate: depositDeadline,
        },
      })

      // 3. 장바구니 비우기 (fromCart인 경우)
      if (fromCart && orderItems[0]?.cartId) {
        await tx.cartItem.deleteMany({
          where: { cartId: orderItems[0].cartId },
        })
      }

      return { guestOrder, payment }
    })

    // 접근 토큰 발급
    const accessToken = generateGuestAccessToken(
      result.guestOrder.id,
      customerInfo.phone,
      result.guestOrder.orderNumber
    )

    // 외부 웹훅 알림 (슬랙/디스코드) - 무통장입금 주문
    const fullAddress = shippingAddress.addressDetail
      ? `${shippingAddress.address} ${shippingAddress.addressDetail}`
      : shippingAddress.address

    sendBankTransferOrderWebhook({
      customerName: result.guestOrder.guestName,
      totalAmount: Number(result.guestOrder.totalAmount),
      items: orderItems.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        options: item.optionSummary || undefined,
      })),
      bankName: shop.bankName!,
      accountNumber: shop.bankAccount!,
      dueDate: depositDeadline.toISOString(),
      phone: shippingAddress.recipientPhone || customerInfo.phone,
      address: fullAddress,
      memo: shippingAddress.deliveryMemo,
    })

    return NextResponse.json({
      success: true,
      order: {
        id: result.guestOrder.id,
        orderNumber: result.guestOrder.orderNumber,
        totalAmount: Number(result.guestOrder.totalAmount),
        subtotal: Number(result.guestOrder.subtotalAmount),
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        items: orderItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.itemTotal, // 합배송 적용된 총액
        })),
      },
      bankInfo: {
        bankName: shop.bankName,
        bankAccount: shop.bankAccount,
        accountHolder: shop.accountHolder,
        depositDeadline: depositDeadline.toISOString(),
        orderedAt: new Date().toISOString(),
      },
      accessToken,
      expiresIn: 3600, // 1시간
      message: '비회원 무통장입금 주문이 완료되었습니다. 입금 확인 후 배송이 시작됩니다.',
      lookupInfo: '주문번호와 휴대폰번호로 주문 조회가 가능합니다.',
    })
  } catch (error: any) {
    console.error('Guest bank transfer order error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '비회원 무통장입금 주문 생성 실패' },
      { status: 500 }
    )
  }
}
