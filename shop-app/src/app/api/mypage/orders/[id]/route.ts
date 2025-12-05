/**
 * MyPage Order Detail API
 * 마이페이지 주문 상세 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id
    const orderId = parseInt(params.id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 주문 ID입니다' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        // Shop 정보 (은행 정보 포함)
        shop: {
          select: {
            id: true,
            name: true,
            bankName: true,
            bankAccount: true,
            accountHolder: true,
          },
        },
        // 배송지 정보 (별도 테이블)
        shippingAddress: true,
        items: {
          include: {
            publishedProduct: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    thumbnailUrl: true,
                  },
                },
                channel: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            variant: {
              select: {
                id: true,
                optionSummary: true,
              },
            },
            review: {
              select: {
                id: true,
              },
            },
          },
        },
        payment: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 본인 주문인지 확인
    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      )
    }

    // Shop ID 확인 (middleware에서 설정)
    const shopIdHeader = request.headers.get('x-shop-id')
    const shopId = shopIdHeader ? parseInt(shopIdHeader) : null

    // shopId가 있으면 해당 Shop의 주문인지 확인
    if (shopId && order.shopId !== shopId) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 응답 형식 변환
    const formattedOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      // 주문자 정보
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      // 배송지 정보 (별도 테이블)
      shippingAddress: order.shippingAddress ? {
        recipientName: order.shippingAddress.recipientName,
        recipientPhone: order.shippingAddress.recipientPhone,
        postalCode: order.shippingAddress.postalCode,
        address: order.shippingAddress.address,
        addressDetail: order.shippingAddress.addressDetail,
        deliveryMemo: order.shippingAddress.deliveryMemo,
      } : null,
      // 금액 정보
      subtotalAmount: Number(order.subtotalAmount),
      shippingFee: Number(order.shippingFee),
      discountAmount: Number(order.discountAmount),
      totalAmount: Number(order.totalAmount),
      // 일시 정보
      orderedAt: order.orderedAt.toISOString(),
      paidAt: order.paidAt?.toISOString() || null,
      shippedAt: order.shippedAt?.toISOString() || null,
      deliveredAt: order.deliveredAt?.toISOString() || null,
      cancelledAt: order.cancelledAt?.toISOString() || null,
      // 고객 정보
      customer: {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone,
      },
      // 주문 상품
      items: order.items.map(item => ({
        id: item.id,
        productName: item.productName,
        optionSummary: item.optionSummary,
        thumbnailUrl: item.thumbnailUrl || item.publishedProduct?.product?.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        hasReview: !!item.review,
        product: item.publishedProduct?.product ? {
          id: item.publishedProduct.product.id,
          name: item.publishedProduct.product.name,
          thumbnailUrl: item.publishedProduct.product.thumbnailUrl,
        } : null,
        channel: item.publishedProduct?.channel ? {
          id: item.publishedProduct.channel.id,
          name: item.publishedProduct.channel.name,
        } : null,
        // 하위 호환성
        retailBand: item.publishedProduct?.channel ? {
          id: item.publishedProduct.channel.id,
          name: item.publishedProduct.channel.name,
        } : null,
      })),
      // 후기 작성 가능 여부 (배송완료 + 미작성 리뷰가 있는 경우)
      hasWritableReview: order.status === 'DELIVERED' && order.items.some(item => !item.review),
      // 결제 정보
      payment: order.payment ? {
        id: order.payment.id,
        paymentKey: order.payment.paymentKey,
        status: order.payment.status,
        method: order.payment.method,
        amount: Number(order.payment.amount),
        cardCompany: order.payment.cardCompany,
        cardNumber: order.payment.cardNumber,
        installmentMonth: order.payment.installmentMonth,
        virtualAccountNumber: order.payment.virtualAccountNumber,
        virtualAccountBank: order.payment.virtualAccountBank,
        virtualAccountDueDate: order.payment.virtualAccountDueDate?.toISOString() || null,
        approvedAt: order.payment.approvedAt?.toISOString() || null,
      } : null,
      // 무통장입금 정보 (BANK_TRANSFER인 경우)
      bankTransferInfo: order.payment?.method === 'BANK_TRANSFER' ? (() => {
        // Shop에서 입금정보 가져오기
        const shop = order.shop
        if (shop?.bankName && shop?.bankAccount) {
          // 입금기한: 주문일로부터 3일 후
          const deadline = new Date(order.orderedAt)
          deadline.setDate(deadline.getDate() + 3)
          return {
            bankName: shop.bankName,
            bankAccount: shop.bankAccount,
            accountHolder: shop.accountHolder || '',
            depositDeadline: deadline.toISOString(),
          }
        }
        return null
      })() : null,
    }

    return NextResponse.json({
      success: true,
      order: formattedOrder,
    })
  } catch (error) {
    console.error('Failed to fetch order detail:', error)
    return NextResponse.json(
      { success: false, error: '주문 상세를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
