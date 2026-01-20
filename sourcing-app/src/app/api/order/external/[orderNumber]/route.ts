export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/order/external/:orderNumber
 * 외부 주문 상세 조회 (수정용)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { orderNumber } = await params

    // 외부 주문인지 확인
    if (!orderNumber.toLowerCase().startsWith('x')) {
      return NextResponse.json(
        { success: false, error: '외부 주문만 조회할 수 있습니다.' },
        { status: 400 }
      )
    }

    // 비회원 주문 조회
    const guestOrder = await prisma.guestOrder.findFirst({
      where: {
        orderNumber,
        shop: {
          userId: user.userId,
        },
      },
      include: {
        items: {
          include: {
            variant: {
              select: {
                optionSummary: true,
              },
            },
            shopProduct: {
              include: {
                product: {
                  select: {
                    name: true,
                    thumbnailUrl: true,
                  },
                },
              },
            },
          },
        },
        shop: {
          select: {
            id: true,
            name: true,
          },
        },
        shippingAddress: true,
      },
    })

    if (guestOrder) {
      return NextResponse.json({
        success: true,
        data: {
          id: guestOrder.id,
          orderNumber: guestOrder.orderNumber,
          isGuestOrder: true,
          customerName: guestOrder.guestName,
          customerPhone: guestOrder.guestPhone,
          customerEmail: guestOrder.guestEmail,
          shopId: guestOrder.shopId,
          shopName: guestOrder.shop?.name || '',
          shippingAddress: {
            recipientName: guestOrder.shippingAddress?.recipientName || '',
            recipientPhone: guestOrder.shippingAddress?.recipientPhone || '',
            postalCode: guestOrder.shippingAddress?.postalCode || '',
            address: guestOrder.shippingAddress?.address || '',
            addressDetail: guestOrder.shippingAddress?.addressDetail || null,
            deliveryMemo: guestOrder.shippingAddress?.deliveryMemo || null,
          },
          totalAmount: Number(guestOrder.totalAmount),
          items: guestOrder.items.map(item => ({
            id: item.id,
            productName: item.shopProduct.product?.name || item.productName,
            optionSummary: item.variant?.optionSummary || null,
            thumbnailUrl: item.shopProduct.product?.thumbnailUrl || item.thumbnailUrl,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          })),
          status: guestOrder.status,
          createdAt: guestOrder.createdAt.toISOString(),
        },
      })
    }

    // 회원 주문 조회
    const memberOrder = await prisma.order.findFirst({
      where: {
        orderNumber,
        userId: user.userId,
      },
      include: {
        items: {
          include: {
            variant: {
              select: {
                optionSummary: true,
              },
            },
            shopProduct: {
              include: {
                product: {
                  select: {
                    name: true,
                    thumbnailUrl: true,
                  },
                },
              },
            },
          },
        },
        shop: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        shippingAddress: true,
      },
    })

    if (memberOrder) {
      return NextResponse.json({
        success: true,
        data: {
          id: memberOrder.id,
          orderNumber: memberOrder.orderNumber,
          isGuestOrder: false,
          customerName: memberOrder.user.name || memberOrder.user.email,
          customerPhone: memberOrder.user.phone,
          customerEmail: memberOrder.user.email,
          shopId: memberOrder.shopId,
          shopName: memberOrder.shop?.name || '',
          shippingAddress: {
            recipientName: memberOrder.shippingAddress?.recipientName || '',
            recipientPhone: memberOrder.shippingAddress?.recipientPhone || '',
            postalCode: memberOrder.shippingAddress?.postalCode || '',
            address: memberOrder.shippingAddress?.address || '',
            addressDetail: memberOrder.shippingAddress?.addressDetail || null,
            deliveryMemo: memberOrder.shippingAddress?.deliveryMemo || null,
          },
          totalAmount: Number(memberOrder.totalAmount),
          items: memberOrder.items.map(item => ({
            id: item.id,
            productName: item.shopProduct.product?.name || item.productName,
            optionSummary: item.variant?.optionSummary || null,
            thumbnailUrl: item.shopProduct.product?.thumbnailUrl || item.thumbnailUrl,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          })),
          status: memberOrder.status,
          createdAt: memberOrder.createdAt.toISOString(),
        },
      })
    }

    return NextResponse.json(
      { success: false, error: '주문을 찾을 수 없습니다.' },
      { status: 404 }
    )
  } catch (error) {
    console.error('외부 주문 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/order/external/:orderNumber
 * 외부 주문 수정 (배송지, 결제금액만)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { orderNumber } = await params
    const body = await request.json()

    // 외부 주문인지 확인
    if (!orderNumber.toLowerCase().startsWith('x')) {
      return NextResponse.json(
        { success: false, error: '외부 주문만 수정할 수 있습니다.' },
        { status: 400 }
      )
    }

    const { shippingAddress, totalAmount } = body

    // 배송지 정보 검증
    if (shippingAddress) {
      if (!shippingAddress.recipientName?.trim()) {
        return NextResponse.json(
          { success: false, error: '수령인 이름은 필수입니다.' },
          { status: 400 }
        )
      }
      if (!shippingAddress.recipientPhone?.trim()) {
        return NextResponse.json(
          { success: false, error: '수령인 연락처는 필수입니다.' },
          { status: 400 }
        )
      }
      if (!shippingAddress.postalCode || !shippingAddress.address) {
        return NextResponse.json(
          { success: false, error: '배송 주소는 필수입니다.' },
          { status: 400 }
        )
      }
    }

    // 결제금액 검증
    if (totalAmount !== undefined && totalAmount !== null) {
      if (!Number.isInteger(totalAmount) || totalAmount < 0) {
        return NextResponse.json(
          { success: false, error: '결제금액은 0 이상의 정수여야 합니다.' },
          { status: 400 }
        )
      }
    }

    // 비회원 주문 수정
    const guestOrder = await prisma.guestOrder.findFirst({
      where: {
        orderNumber,
        shop: {
          userId: user.userId,
        },
      },
    })

    if (guestOrder) {
      // 배송지 정보 업데이트
      if (shippingAddress) {
        await prisma.shippingAddress.upsert({
          where: { guestOrderId: guestOrder.id },
          create: {
            guestOrderId: guestOrder.id,
            recipientName: shippingAddress.recipientName.trim(),
            recipientPhone: shippingAddress.recipientPhone.trim(),
            postalCode: shippingAddress.postalCode,
            address: shippingAddress.address,
            addressDetail: shippingAddress.addressDetail?.trim() || null,
            deliveryMemo: shippingAddress.deliveryMemo?.trim() || null,
          },
          update: {
            recipientName: shippingAddress.recipientName.trim(),
            recipientPhone: shippingAddress.recipientPhone.trim(),
            postalCode: shippingAddress.postalCode,
            address: shippingAddress.address,
            addressDetail: shippingAddress.addressDetail?.trim() || null,
            deliveryMemo: shippingAddress.deliveryMemo?.trim() || null,
          },
        })
      }

      // 결제금액 업데이트
      if (totalAmount !== undefined && totalAmount !== null) {
        await prisma.guestOrder.update({
          where: { id: guestOrder.id },
          data: { totalAmount },
        })
      }

      return NextResponse.json({
        success: true,
        message: '주문이 수정되었습니다.',
      })
    }

    // 회원 주문 수정
    const memberOrder = await prisma.order.findFirst({
      where: {
        orderNumber,
        userId: user.userId,
      },
    })

    if (memberOrder) {
      // 배송지 정보 업데이트
      if (shippingAddress) {
        await prisma.shippingAddress.upsert({
          where: { orderId: memberOrder.id },
          create: {
            orderId: memberOrder.id,
            recipientName: shippingAddress.recipientName.trim(),
            recipientPhone: shippingAddress.recipientPhone.trim(),
            postalCode: shippingAddress.postalCode,
            address: shippingAddress.address,
            addressDetail: shippingAddress.addressDetail?.trim() || null,
            deliveryMemo: shippingAddress.deliveryMemo?.trim() || null,
          },
          update: {
            recipientName: shippingAddress.recipientName.trim(),
            recipientPhone: shippingAddress.recipientPhone.trim(),
            postalCode: shippingAddress.postalCode,
            address: shippingAddress.address,
            addressDetail: shippingAddress.addressDetail?.trim() || null,
            deliveryMemo: shippingAddress.deliveryMemo?.trim() || null,
          },
        })
      }

      // 결제금액 업데이트
      if (totalAmount !== undefined && totalAmount !== null) {
        await prisma.order.update({
          where: { id: memberOrder.id },
          data: { totalAmount },
        })
      }

      return NextResponse.json({
        success: true,
        message: '주문이 수정되었습니다.',
      })
    }

    return NextResponse.json(
      { success: false, error: '주문을 찾을 수 없습니다.' },
      { status: 404 }
    )
  } catch (error) {
    console.error('외부 주문 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}
