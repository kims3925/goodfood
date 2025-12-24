export const dynamic = 'force-dynamic'

/**
 * MyPage Order Detail API
 * 마이페이지 주문 상세 조회 (회원 + 비회원 주문 통합)
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

    // 현재 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true, name: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // Shop ID 확인 (middleware에서 설정)
    const shopIdHeader = request.headers.get('x-shop-id')
    const shopId = shopIdHeader ? parseInt(shopIdHeader) : null

    // 1. 먼저 회원 주문 조회
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
        shop: {
          select: {
            id: true,
            name: true,
            bankName: true,
            bankAccount: true,
            accountHolder: true,
          },
        },
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

    // 2. 회원 주문이 있고 본인 주문이면 반환
    if (order) {
      if (order.userId !== userId) {
        return NextResponse.json(
          { success: false, error: '접근 권한이 없습니다' },
          { status: 403 }
        )
      }

      if (shopId && order.shopId !== shopId) {
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없습니다' },
          { status: 404 }
        )
      }

      // 회원 주문 응답 형식 변환
      const addr = order.shippingAddress
      const formattedOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        isGuestOrder: false,
        customerName: order.user?.name || '',
        customerPhone: order.user?.phone || '',
        customerEmail: order.user?.email || '',
        shippingAddress: order.shippingAddress ? {
          recipientName: order.shippingAddress.recipientName,
          recipientPhone: order.shippingAddress.recipientPhone,
          postalCode: order.shippingAddress.postalCode,
          address: order.shippingAddress.address,
          addressDetail: order.shippingAddress.addressDetail,
          deliveryMemo: order.shippingAddress.deliveryMemo,
        } : null,
        subtotalAmount: Number(order.subtotalAmount),
        shippingFee: Number(order.shippingFee),
        discountAmount: Number(order.discountAmount),
        totalAmount: Number(order.totalAmount),
        orderedAt: order.orderedAt.toISOString(),
        paidAt: order.paidAt?.toISOString() || null,
        shippedAt: order.shippedAt?.toISOString() || null,
        deliveredAt: order.deliveredAt?.toISOString() || null,
        cancelledAt: order.cancelledAt?.toISOString() || null,
        customer: {
          name: order.user.name,
          email: order.user.email,
          phone: order.user.phone,
        },
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
          retailBand: item.publishedProduct?.channel ? {
            id: item.publishedProduct.channel.id,
            name: item.publishedProduct.channel.name,
          } : null,
        })),
        hasWritableReview: order.status === 'DELIVERED' && order.items.some(item => !item.review),
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
        bankTransferInfo: order.payment?.method === 'BANK_TRANSFER' ? (() => {
          const shop = order.shop
          if (shop?.bankName && shop?.bankAccount) {
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
    }

    // 3. 회원 주문이 없으면 비회원 주문 조회
    const guestOrder = await prisma.guestOrder.findUnique({
      where: { id: orderId },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            bankName: true,
            bankAccount: true,
            accountHolder: true,
          },
        },
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
          },
        },
        payment: true,
      },
    })

    if (!guestOrder) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 본인 비회원 주문인지 확인 (이메일 또는 전화번호 매칭)
    const isOwner =
      (guestOrder.guestEmail === user.email) ||
      (user.phone && guestOrder.guestPhone === user.phone)

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다' },
        { status: 403 }
      )
    }

    if (shopId && guestOrder.shopId !== shopId) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 비회원 주문 응답 형식 변환
    const formattedGuestOrder = {
      id: guestOrder.id,
      orderNumber: guestOrder.orderNumber,
      status: guestOrder.status,
      isGuestOrder: true,
      customerName: guestOrder.guestName,
      customerPhone: guestOrder.guestPhone,
      customerEmail: guestOrder.guestEmail || '',
      shippingAddress: guestOrder.shippingAddress ? {
        recipientName: guestOrder.shippingAddress.recipientName,
        recipientPhone: guestOrder.shippingAddress.recipientPhone,
        postalCode: guestOrder.shippingAddress.postalCode,
        address: guestOrder.shippingAddress.address,
        addressDetail: guestOrder.shippingAddress.addressDetail,
        deliveryMemo: guestOrder.shippingAddress.deliveryMemo,
      } : null,
      subtotalAmount: Number(guestOrder.subtotalAmount),
      shippingFee: Number(guestOrder.shippingFee),
      discountAmount: Number(guestOrder.discountAmount),
      totalAmount: Number(guestOrder.totalAmount),
      orderedAt: guestOrder.orderedAt.toISOString(),
      paidAt: guestOrder.paidAt?.toISOString() || null,
      shippedAt: guestOrder.shippedAt?.toISOString() || null,
      deliveredAt: guestOrder.deliveredAt?.toISOString() || null,
      cancelledAt: guestOrder.cancelledAt?.toISOString() || null,
      customer: {
        name: guestOrder.guestName,
        email: guestOrder.guestEmail,
        phone: guestOrder.guestPhone,
      },
      items: guestOrder.items.map(item => ({
        id: item.id,
        productName: item.productName,
        optionSummary: item.optionSummary,
        thumbnailUrl: item.thumbnailUrl || item.publishedProduct?.product?.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        hasReview: false, // 비회원은 리뷰 불가
        product: item.publishedProduct?.product ? {
          id: item.publishedProduct.product.id,
          name: item.publishedProduct.product.name,
          thumbnailUrl: item.publishedProduct.product.thumbnailUrl,
        } : null,
        channel: item.publishedProduct?.channel ? {
          id: item.publishedProduct.channel.id,
          name: item.publishedProduct.channel.name,
        } : null,
        retailBand: item.publishedProduct?.channel ? {
          id: item.publishedProduct.channel.id,
          name: item.publishedProduct.channel.name,
        } : null,
      })),
      hasWritableReview: false, // 비회원은 리뷰 작성 불가
      payment: guestOrder.payment ? {
        id: guestOrder.payment.id,
        paymentKey: guestOrder.payment.paymentKey,
        status: guestOrder.payment.status,
        method: guestOrder.payment.method,
        amount: Number(guestOrder.payment.amount),
        cardCompany: guestOrder.payment.cardCompany,
        cardNumber: guestOrder.payment.cardNumber,
        installmentMonth: guestOrder.payment.installmentMonth,
        virtualAccountNumber: guestOrder.payment.virtualAccountNumber,
        virtualAccountBank: guestOrder.payment.virtualAccountBank,
        virtualAccountDueDate: guestOrder.payment.virtualAccountDueDate?.toISOString() || null,
        approvedAt: guestOrder.payment.approvedAt?.toISOString() || null,
      } : null,
      bankTransferInfo: guestOrder.payment?.method === 'BANK_TRANSFER' ? (() => {
        const shop = guestOrder.shop
        if (shop?.bankName && shop?.bankAccount) {
          const deadline = new Date(guestOrder.orderedAt)
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
      order: formattedGuestOrder,
    })
  } catch (error) {
    console.error('Failed to fetch order detail:', error)
    return NextResponse.json(
      { success: false, error: '주문 상세를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
