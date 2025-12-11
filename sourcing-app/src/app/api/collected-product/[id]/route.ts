import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 수집상품 상세 조회
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
    const collectedProductId = parseInt(id, 10)
    if (isNaN(collectedProductId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 id입니다.' },
        { status: 400 }
      )
    }

    const collectedProduct = await prisma.collectedProduct.findFirst({
      where: {
        id: collectedProductId,
        userId: currentUser.userId,
      },
      include: {
        post: {
          include: {
            channel: {
              select: {
                id: true,
                name: true,
                coverUrl: true,
                platform: true,
              },
            },
            images: {
              orderBy: { sortOrder: 'asc' },
            },
            comments: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
        products: {
          include: {
            variants: true,
            options: true,
            publishedProducts: {
              include: {
                channel: {
                  select: {
                    id: true,
                    name: true,
                    platform: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!collectedProduct) {
      return NextResponse.json(
        { success: false, error: '수집상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: collectedProduct,
    })
  } catch (error) {
    console.error('수집상품 상세 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '수집상품 상세 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 수집상품 수정
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
    const collectedProductId = parseInt(id, 10)
    if (isNaN(collectedProductId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 id입니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, description, price, wholesalePrice } = body

    // 수집상품 확인
    const existingProduct = await prisma.collectedProduct.findFirst({
      where: {
        id: collectedProductId,
        userId: currentUser.userId,
      },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '수집상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const updatedProduct = await prisma.collectedProduct.update({
      where: { id: collectedProductId },
      data: {
        name,
        description,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedProduct,
    })
  } catch (error) {
    console.error('수집상품 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '수집상품 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 수집상품 삭제
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
    const collectedProductId = parseInt(id, 10)
    if (isNaN(collectedProductId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 id입니다.' },
        { status: 400 }
      )
    }

    // 수집상품 확인
    const existingProduct = await prisma.collectedProduct.findFirst({
      where: {
        id: collectedProductId,
        userId: currentUser.userId,
      },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '수집상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await prisma.collectedProduct.delete({
      where: { id: collectedProductId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('수집상품 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '수집상품 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
