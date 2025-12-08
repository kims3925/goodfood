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

// 주문번호 생성
function generateOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ORD-${dateStr}-${random}`
}

// 결제키 생성 (무통장입금용)
function generatePaymentKey(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `BT-${timestamp}-${random}`.toUpperCase()
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

// 입금 기한 계산 (3일 후)
function getDepositDeadline(): Date {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + 3)
  deadline.setHours(23, 59, 59, 999)
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

    if (fromCart) {
      // 장바구니에서 주문
      const sessionId = getSessionId(req)

      let cart = null
      if (currentUserId) {
        cart = await prisma.cart.findFirst({
          where: { userId: currentUserId },
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
          where: { sessionId, userId: null },
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

    // 금액 계산
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    )
    const shippingFee = subtotal >= 30000 ? 0 : 3000
    const totalAmount = subtotal + shippingFee
    const depositDeadline = getDepositDeadline()

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
          shippingFee,
          discountAmount: 0,
          totalAmount,
          items: {
            create: orderItems.map((item) => ({
              publishedProductId: item.publishedProductId,
              variantId: item.variantId,
              productName: item.productName,
              optionSummary: item.optionSummary,
              thumbnailUrl: item.thumbnailUrl,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.unitPrice * item.quantity,
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
          amount: totalAmount,
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

      return { order, payment }
    })

    return NextResponse.json({
      success: true,
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        totalAmount: Number(result.order.totalAmount),
        subtotal: Number(result.order.subtotalAmount),
        shippingFee: Number(result.order.shippingFee),
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        items: orderItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
        })),
      },
      bankInfo: {
        bankName: shop.bankName,
        bankAccount: shop.bankAccount,
        accountHolder: shop.accountHolder,
        depositDeadline: depositDeadline.toISOString(),
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
