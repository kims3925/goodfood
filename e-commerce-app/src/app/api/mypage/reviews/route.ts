import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@modules/common/utils/src/database/client'

// 내 리뷰 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const reviews = await prisma.review.findMany({
      where: {
        userId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      reviews,
    })
  } catch (error) {
    console.error('Failed to fetch reviews:', error)
    return NextResponse.json(
      { success: false, error: '리뷰 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 리뷰 작성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다' },
        { status: 401 }
      )
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id

    const { orderId, productId, rating, title, content, images } = await request.json()

    if (!orderId || !productId || !rating || !content) {
      return NextResponse.json(
        { success: false, error: '필수 정보를 입력해주세요' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: '평점은 1~5 사이여야 합니다' },
        { status: 400 }
      )
    }

    // 주문 확인 (본인의 주문인지, 완료된 주문인지)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      )
    }

    if (order.status !== 'DELIVERED') {
      return NextResponse.json(
        { success: false, error: '배송 완료된 주문만 리뷰를 작성할 수 있습니다' },
        { status: 400 }
      )
    }

    // 해당 상품이 주문에 포함되어 있는지 확인
    const orderItem = order.items.find((item) => item.productPublishId === productId)
    if (!orderItem) {
      return NextResponse.json(
        { success: false, error: '해당 주문에 포함되지 않은 상품입니다' },
        { status: 400 }
      )
    }

    // 이미 리뷰를 작성했는지 확인
    const existingReview = await prisma.review.findUnique({
      where: { orderId },
    })

    if (existingReview) {
      return NextResponse.json(
        { success: false, error: '이미 리뷰를 작성하셨습니다' },
        { status: 400 }
      )
    }

    const review = await prisma.review.create({
      data: {
        userId,
        productId,
        orderId,
        rating,
        title,
        content,
        images: images ? JSON.stringify(images) : null,
      },
      include: {
        product: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: '리뷰가 작성되었습니다',
      review,
    })
  } catch (error) {
    console.error('Failed to create review:', error)
    return NextResponse.json(
      { success: false, error: '리뷰 작성에 실패했습니다' },
      { status: 500 }
    )
  }
}
