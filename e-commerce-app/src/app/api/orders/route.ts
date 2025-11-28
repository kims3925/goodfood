/**
 * Orders API
 * 주문 생성 및 조회
 * product_publish 기반으로 변경
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus, Prisma } from '@bandauto/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'

const Decimal = Prisma.Decimal

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

// 주문번호 생성
function generateOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ORD-${dateStr}-${random}`
}

// 세션 ID 가져오기
function getSessionId(req: NextRequest): string | null {
  return req.cookies.get('cart_session')?.value || null
}

/**
 * POST /api/orders
 * 주문 생성
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      items, // [{ productPublishId, variantId?, quantity }] 또는 장바구니에서 가져오기
      customerInfo,
      shippingAddress,
      fromCart = true, // 장바구니에서 주문 생성 여부
    } = body

    // 고객 정보 검증 (이메일은 선택)
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

    let orderItems: any[] = []

    if (fromCart) {
      // 장바구니에서 주문 생성
      const sessionId = getSessionId(req)
      const currentUserId = await getCurrentUserId()

      // 로그인 사용자는 userId로, 비로그인은 sessionId로 장바구니 조회
      let cart = null

      if (currentUserId) {
        // 로그인 사용자: userId로 장바구니 찾기
        cart = await prisma.cart.findFirst({
          where: { userId: currentUserId },
          include: {
            items: {
              include: {
                productPublish: {
                  include: {
                    product: {
                      include: {
                        variants: { take: 1 },
                      },
                    },
                    retailBand: true,
                  },
                },
                variant: true,
              },
            },
          },
        })
      } else if (sessionId) {
        // 비로그인 사용자: sessionId + userId가 null인 카트만 조회
        cart = await prisma.cart.findFirst({
          where: {
            sessionId,
            userId: null,
          },
          include: {
            items: {
              include: {
                productPublish: {
                  include: {
                    product: {
                      include: {
                        variants: { take: 1 },
                      },
                    },
                    retailBand: true,
                  },
                },
                variant: true,
              },
            },
          },
        })
      }

      if (!cart) {
        return NextResponse.json(
          { success: false, error: '장바구니가 없습니다' },
          { status: 400 }
        )
      }

      if (cart.items.length === 0) {
        return NextResponse.json(
          { success: false, error: '장바구니가 비어있습니다' },
          { status: 400 }
        )
      }

      orderItems = cart.items.map((item) => {
        const productPublish = item.productPublish
        const product = productPublish.product
        const variant = item.variant
        const mainVariant = product.variants[0]

        return {
          productPublishId: productPublish.id,
          variantId: variant?.id || null,
          productName: product.name,
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product.thumbnailUrl,
          quantity: item.quantity,
          unitPrice: variant?.price || mainVariant?.price || product.price || 0,
        }
      })
    } else {
      // 직접 상품 지정 (상품 상세페이지에서 바로 구매)
      if (!items || items.length === 0) {
        return NextResponse.json(
          { success: false, error: '주문 상품이 없습니다' },
          { status: 400 }
        )
      }

      for (const item of items) {
        const productPublish = await prisma.productPublish.findFirst({
          where: {
            id: parseInt(item.productPublishId),
            status: PublishStatus.SUCCESS,
          },
          include: {
            product: {
              include: {
                variants: { take: 1 },
              },
            },
            retailBand: true,
          },
        })

        if (!productPublish) {
          return NextResponse.json(
            { success: false, error: `상품 ${item.productPublishId}를 찾을 수 없거나 판매 중인 상품이 아닙니다` },
            { status: 404 }
          )
        }

        let variant = null
        if (item.variantId) {
          variant = await prisma.productVariant.findUnique({
            where: { id: parseInt(item.variantId) },
          })
        }

        const product = productPublish.product
        const mainVariant = product.variants[0]

        orderItems.push({
          productPublishId: productPublish.id,
          variantId: variant?.id || null,
          productName: product.name,
          optionSummary: variant?.optionSummary || null,
          thumbnailUrl: product.thumbnailUrl,
          quantity: item.quantity || 1,
          unitPrice: variant?.price || mainVariant?.price || product.price || 0,
        })
      }
    }

    // 금액 계산
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    )
    const shippingFee = subtotal >= 30000 ? 0 : 3000
    const discountAmount = 0
    const totalAmount = subtotal + shippingFee - discountAmount

    // 로그인한 사용자만 주문 가능 (userId는 클라이언트에서 전달받음)
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 주문 생성
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        orderNumber: generateOrderNumber(),
        status: 'PENDING',
        recipientName: shippingAddress.recipientName || customerInfo.name,
        recipientPhone: shippingAddress.recipientPhone || customerInfo.phone,
        postalCode: shippingAddress.postalCode,
        address: shippingAddress.address,
        addressDetail: shippingAddress.addressDetail || null,
        deliveryMemo: shippingAddress.deliveryMemo || null,
        subtotalAmount: new Decimal(subtotal),
        shippingFee: new Decimal(shippingFee),
        discountAmount: new Decimal(discountAmount),
        totalAmount: new Decimal(totalAmount),
        items: {
          create: orderItems.map((item) => ({
            productPublishId: item.productPublishId,
            variantId: item.variantId,
            productName: item.productName,
            optionSummary: item.optionSummary,
            thumbnailUrl: item.thumbnailUrl,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            totalPrice: new Decimal(item.unitPrice * item.quantity),
          })),
        },
      },
      include: {
        items: true,
      },
    })

    // 장바구니 비우기 (장바구니에서 주문한 경우)
    if (fromCart) {
      const sessionId = getSessionId(req)
      const currentUserId = await getCurrentUserId()

      let cartToClear = null

      if (currentUserId) {
        // 로그인 사용자: userId로 장바구니 찾기
        cartToClear = await prisma.cart.findFirst({
          where: { userId: currentUserId },
        })
      } else if (sessionId) {
        // 비로그인 사용자: sessionId + userId가 null인 카트만
        cartToClear = await prisma.cart.findFirst({
          where: {
            sessionId,
            userId: null,
          },
        })
      }

      if (cartToClear) {
        await prisma.cartItem.deleteMany({
          where: { cartId: cartToClear.id },
        })
      }
    }

    // TossPayments 결제 요청 정보 생성
    const paymentRequest = {
      orderId: order.orderNumber,
      orderName: orderItems.length > 1
        ? `${orderItems[0].productName} 외 ${orderItems.length - 1}건`
        : orderItems[0].productName,
      amount: totalAmount,
      customerName: user.name,
      customerEmail: user.email,
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/store/payment/success`,
      failUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/store/payment/fail`,
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        items: order.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
      },
      payment: paymentRequest,
      message: '주문이 생성되었습니다',
    })
  } catch (error: any) {
    console.error('Orders POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 생성 실패' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/orders
 * 주문 목록 조회 (이메일 기반)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    const orderNumber = searchParams.get('orderNumber')

    if (orderNumber) {
      // 주문번호로 단건 조회
      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          items: {
            include: {
              productPublish: {
                include: {
                  retailBand: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
          payment: true,
          user: {
            select: { name: true, email: true, phone: true },
          },
        },
      })

      if (!order) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없습니다' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          customer: order.user,
          recipientName: order.recipientName,
          recipientPhone: order.recipientPhone,
          address: `${order.address} ${order.addressDetail || ''}`.trim(),
          postalCode: order.postalCode,
          deliveryMemo: order.deliveryMemo,
          subtotalAmount: Number(order.subtotalAmount),
          shippingFee: Number(order.shippingFee),
          discountAmount: Number(order.discountAmount),
          totalAmount: Number(order.totalAmount),
          items: order.items.map((item) => ({
            productName: item.productName,
            optionSummary: item.optionSummary,
            thumbnailUrl: item.thumbnailUrl,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            retailBand: item.productPublish?.retailBand,
          })),
          payment: order.payment ? {
            status: order.payment.status,
            method: order.payment.method,
            approvedAt: order.payment.approvedAt,
          } : null,
          orderedAt: order.orderedAt,
          paidAt: order.paidAt,
          shippedAt: order.shippedAt,
          deliveredAt: order.deliveredAt,
        },
      })
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: '이메일 또는 주문번호가 필요합니다' },
        { status: 400 }
      )
    }

    // 이메일로 주문 목록 조회
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({
        success: true,
        orders: [],
      })
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            productPublish: {
              include: {
                retailBand: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        payment: true,
      },
      orderBy: { orderedAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        itemCount: order.items.length,
        firstItemName: order.items[0]?.productName,
        orderedAt: order.orderedAt,
        paidAt: order.paidAt,
      })),
    })
  } catch (error: any) {
    console.error('Orders GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 조회 실패' },
      { status: 500 }
    )
  }
}
