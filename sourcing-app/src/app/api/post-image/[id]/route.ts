import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * DELETE /api/post-image/[id]
 *
 * Delete a single image from a post
 *
 * Response:
 * - success: boolean
 * - data?: { deletedId: number, newThumbnailUrl: string | null }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const imageId = parseInt(params.id)
    if (isNaN(imageId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이미지 ID입니다.' },
        { status: 400 }
      )
    }

    // Get the image with its post to verify ownership
    const image = await prisma.collectedPostImage.findUnique({
      where: { id: imageId },
      include: {
        post: {
          include: {
            collectedProducts: {
              include: {
                products: true,
              },
            },
          },
        },
      },
    })

    if (!image) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Verify user owns the post
    if (image.post.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    const postId = image.postId
    const deletedSortOrder = image.sortOrder

    // Delete the image
    await prisma.collectedPostImage.delete({
      where: { id: imageId },
    })

    // Update sortOrder for remaining images
    await prisma.collectedPostImage.updateMany({
      where: {
        postId,
        sortOrder: { gt: deletedSortOrder },
      },
      data: {
        sortOrder: { decrement: 1 },
      },
    })

    // Get the new first image (new thumbnail)
    const firstImage = await prisma.collectedPostImage.findFirst({
      where: { postId },
      orderBy: { sortOrder: 'asc' },
    })

    const newThumbnailUrl = firstImage?.imageUrl || null

    // Update product's thumbnailUrl if product exists
    const productIds = image.post.collectedProducts.flatMap((cp) =>
      cp.products.map((p) => p.id)
    )

    if (productIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { thumbnailUrl: newThumbnailUrl },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedId: imageId,
        newThumbnailUrl,
      },
    })
  } catch (error: any) {
    console.error('이미지 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '이미지 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
