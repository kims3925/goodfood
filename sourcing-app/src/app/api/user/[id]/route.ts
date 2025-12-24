export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json({ error: '잘못된 사용자 ID입니다' }, { status: 400 })
    }

    // 사용자 기본 정보
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        shopId: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        profileImage: true,
        createdAt: true,
        signupCompletedAt: true,
        marketingAgreedAt: true,
        privacyAgreedAt: true,
        tosAgreedAt: true,
        registeredShop: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        _count: {
          select: {
            orders: true,
            inquiries: true,
            reviews: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
    }

    // 최근 주문 내역 (10개)
    const orders = await prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        orderedAt: true,
        paidAt: true,
        shippedAt: true,
        deliveredAt: true,
        items: {
          select: {
            id: true,
            productName: true,
            thumbnailUrl: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
          take: 3, // 주문당 상품 3개까지만
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { orderedAt: 'desc' },
      take: 10,
    })

    // 최근 문의 내역 (10개)
    const inquiries = await prisma.inquiry.findMany({
      where: { userId },
      select: {
        id: true,
        inquiryType: true,
        title: true,
        status: true,
        isPrivate: true,
        createdAt: true,
        repliedAt: true,
        publishedProduct: {
          select: {
            id: true,
            product: {
              select: {
                name: true,
                thumbnailUrl: true,
              },
            },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // 최근 리뷰 목록 (10개)
    const reviews = await prisma.review.findMany({
      where: { userId },
      select: {
        id: true,
        rating: true,
        title: true,
        content: true,
        images: true,
        isVisible: true,
        createdAt: true,
        orderItem: {
          select: {
            id: true,
            productName: true,
            thumbnailUrl: true,
            optionSummary: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // 배송지 목록
    const addresses = await prisma.userAddress.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        recipientName: true,
        recipientPhone: true,
        postalCode: true,
        address: true,
        addressDetail: true,
        isDefault: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    // 총 주문 금액 계산
    const totalSpent = await prisma.order.aggregate({
      where: {
        userId,
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _sum: { totalAmount: true },
    })

    return NextResponse.json({
      user,
      orders,
      inquiries,
      reviews,
      addresses,
      stats: {
        totalOrders: user._count.orders,
        totalInquiries: user._count.inquiries,
        totalReviews: user._count.reviews,
        totalSpent: totalSpent._sum.totalAmount || 0,
      },
    })
  } catch (error) {
    console.error('사용자 상세 조회 오류:', error)
    return NextResponse.json(
      { error: '사용자 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
