import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 발행상품 상세 조회
export async function GET(
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

    const { id } = await params
    const publishedProductId = parseInt(id, 10)
    if (isNaN(publishedProductId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 id입니다.' },
        { status: 400 }
      )
    }

    const publishedProduct = await prisma.publishedProduct.findFirst({
      where: {
        id: publishedProductId,
        userId: currentUser.userId,
      },
      include: {
        product: {
          include: {
            variants: true,
            options: true,
            collectedProduct: {
              include: {
                post: {
                  include: {
                    channel: true,
                    images: {
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            coverUrl: true,
            platform: true,
            kind: true,
          },
        },
        publishHistories: {
          orderBy: { publishedAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!publishedProduct) {
      return NextResponse.json(
        { success: false, error: '발행상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: publishedProduct,
    })
  } catch (error) {
    console.error('발행상품 상세 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행상품 상세 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 발행상품 수정 (재발행 시도 등)
export async function PUT(
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

    const { id } = await params
    const publishedProductId = parseInt(id, 10)
    if (isNaN(publishedProductId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 id입니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { status, externalId, externalUrl, errorMessage } = body

    // 발행상품 확인
    const existingProduct = await prisma.publishedProduct.findFirst({
      where: {
        id: publishedProductId,
        userId: currentUser.userId,
      },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '발행상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (externalId !== undefined) updateData.externalId = externalId
    if (externalUrl !== undefined) updateData.externalUrl = externalUrl
    if (errorMessage !== undefined) updateData.errorMessage = errorMessage
    if (status === 'SUCCESS') updateData.publishedAt = new Date()

    const updatedProduct = await prisma.publishedProduct.update({
      where: { id: publishedProductId },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: updatedProduct,
    })
  } catch (error) {
    console.error('발행상품 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행상품 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 발행상품 삭제
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

    const { id } = await params
    const publishedProductId = parseInt(id, 10)
    if (isNaN(publishedProductId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 id입니다.' },
        { status: 400 }
      )
    }

    // 발행상품 확인
    const existingProduct = await prisma.publishedProduct.findFirst({
      where: {
        id: publishedProductId,
        userId: currentUser.userId,
      },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '발행상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await prisma.publishedProduct.delete({
      where: { id: publishedProductId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('발행상품 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행상품 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
