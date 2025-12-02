import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/images/product/[id]
 *
 * Get image info by ID (URL redirect)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const imageId = parseInt(id)

    if (isNaN(imageId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    // DB에서 이미지 정보 조회
    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
    })

    if (!image) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // URL로 리다이렉트
    return NextResponse.redirect(image.url)
  } catch (error) {
    console.error('이미지 서빙 실패:', error)
    return NextResponse.json(
      { success: false, error: '이미지를 불러올 수 없습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/images/product/[id]
 *
 * Delete a single image from a product by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params
    const imageId = parseInt(id)

    if (isNaN(imageId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이미지 ID입니다.' },
        { status: 400 }
      )
    }

    // Get the image with its product to verify ownership
    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
      include: {
        product: true,
      },
    })

    if (!image) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Verify user owns the product
    if (image.product.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    const productId = image.productId
    const deletedSortOrder = image.sortOrder

    // Delete the image from DB
    await prisma.productImage.delete({
      where: { id: imageId },
    })

    // Update sortOrder for remaining images
    await prisma.productImage.updateMany({
      where: {
        productId,
        sortOrder: { gt: deletedSortOrder },
      },
      data: {
        sortOrder: { decrement: 1 },
      },
    })

    // Update product thumbnailUrl if needed
    if (deletedSortOrder === 0) {
      const nextImage = await prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      })

      await prisma.product.update({
        where: { id: productId },
        data: {
          thumbnailUrl: nextImage?.url || null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedId: imageId,
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
