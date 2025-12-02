import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * PUT /api/images/post/reorder
 *
 * Reorder images for a post
 *
 * Request Body:
 * - postId: number
 * - imageIds: number[] (ordered array of image IDs)
 *
 * Response:
 * - success: boolean
 * - data?: { updatedCount: number }
 */
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const body = await request.json()
    const { postId, imageIds } = body

    if (!postId || !Array.isArray(imageIds)) {
      return NextResponse.json(
        { success: false, error: 'postId와 imageIds 배열이 필요합니다.' },
        { status: 400 }
      )
    }

    // Verify post belongs to user
    const post = await prisma.collectedPost.findFirst({
      where: {
        id: postId,
        userId,
      },
    })

    if (!post) {
      return NextResponse.json(
        { success: false, error: '게시물을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Update sortOrder for each image
    const updatePromises = imageIds.map((imageId, index) =>
      prisma.collectedPostImage.updateMany({
        where: {
          id: imageId,
          postId,
        },
        data: {
          sortOrder: index,
        },
      })
    )

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: imageIds.length,
      },
    })
  } catch (error: any) {
    console.error('이미지 순서 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '이미지 순서 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
