import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// PUT: 이미지 순서 변경
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { productId, imageIds } = body

    if (!productId || !imageIds || !Array.isArray(imageIds)) {
      return NextResponse.json(
        { success: false, error: 'productId와 imageIds가 필요합니다.' },
        { status: 400 }
      )
    }

    // 상품 소유권 확인
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        userId: currentUser.userId,
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 이미지 순서 업데이트
    await prisma.$transaction(
      imageIds.map((imageId: number, index: number) =>
        prisma.productImage.update({
          where: { id: imageId },
          data: { sortOrder: index },
        })
      )
    )

    // 첫 번째 이미지를 썸네일로 설정
    const firstImage = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    })

    if (firstImage) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          thumbnailUrl: firstImage.url,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: '이미지 순서가 변경되었습니다.',
    })
  } catch (error) {
    console.error('이미지 순서 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '이미지 순서 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
