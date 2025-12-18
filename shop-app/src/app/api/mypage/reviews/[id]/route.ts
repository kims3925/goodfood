export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/modules/auth/auth.config'
import prisma from '@bandauto/db'

// 리뷰 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params
    const reviewId = parseInt(id)

    if (isNaN(reviewId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 리뷰 ID입니다' },
        { status: 400 }
      )
    }

    const { rating, title, content, images } = await request.json()

    if (!rating || !content) {
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

    // 리뷰 조회 및 본인 확인
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        orderItem: {
          include: {
            order: true,
          },
        },
      },
    })

    if (!review) {
      return NextResponse.json(
        { success: false, error: '리뷰를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 본인의 리뷰인지 확인
    if (review.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      )
    }

    // 리뷰 수정
    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating,
        title: title || null,
        content,
        images: images && images.length > 0 ? JSON.stringify(images) : null,
      },
    })

    return NextResponse.json({
      success: true,
      message: '리뷰가 수정되었습니다',
      review: {
        id: updatedReview.id,
        rating: updatedReview.rating,
        title: updatedReview.title,
        content: updatedReview.content,
        images: updatedReview.images ? JSON.parse(updatedReview.images) : null,
        updatedAt: updatedReview.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Failed to update review:', error)
    return NextResponse.json(
      { success: false, error: '리뷰 수정에 실패했습니다' },
      { status: 500 }
    )
  }
}

// 리뷰 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params
    const reviewId = parseInt(id)

    if (isNaN(reviewId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 리뷰 ID입니다' },
        { status: 400 }
      )
    }

    // 리뷰 조회 및 본인 확인
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    })

    if (!review) {
      return NextResponse.json(
        { success: false, error: '리뷰를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 본인의 리뷰인지 확인
    if (review.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다' },
        { status: 403 }
      )
    }

    // 리뷰 삭제
    await prisma.review.delete({
      where: { id: reviewId },
    })

    return NextResponse.json({
      success: true,
      message: '리뷰가 삭제되었습니다',
    })
  } catch (error) {
    console.error('Failed to delete review:', error)
    return NextResponse.json(
      { success: false, error: '리뷰 삭제에 실패했습니다' },
      { status: 500 }
    )
  }
}
