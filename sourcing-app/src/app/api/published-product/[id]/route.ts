import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

type RouteContext = { params: Promise<{ id: string }> }

const unauthorizedResponse = () => NextResponse.json(
  { success: false, error: '로그인이 필요합니다.' },
  { status: 401 }
)

const invalidIdResponse = () => NextResponse.json(
  { success: false, error: '유효하지 않은 id입니다.' },
  { status: 400 }
)

const notFoundResponse = () => NextResponse.json(
  { success: false, error: '발행상품을 찾을 수 없습니다.' },
  { status: 404 }
)

const parsePublishedProductId = (id?: string) => {
  const publishedProductId = parseInt(id || '', 10)
  if (!id || Number.isNaN(publishedProductId)) {
    return null
  }
  return publishedProductId
}

// GET: 발행상품 상세 조회
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return unauthorizedResponse()
    }

    const { id } = await params
    const publishedProductId = parsePublishedProductId(id)
    if (publishedProductId === null) {
      return invalidIdResponse()
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
            images: {
              orderBy: { sortOrder: 'asc' },
            },
            // 같은 상품의 모든 발행 정보 포함
            publishedProducts: {
              include: {
                channel: {
                  select: {
                    id: true,
                    name: true,
                    coverUrl: true,
                    platform: true,
                    kind: true,
                  },
                },
                shop: {
                  select: {
                    id: true,
                    name: true,
                    subdomain: true,
                    isActive: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
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
        shop: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            isActive: true,
          },
        },
      },
    })

    if (!publishedProduct) {
      return notFoundResponse()
    }

    return NextResponse.json({
      success: true,
      data: publishedProduct,
    })
  } catch (error) {
    console.error('발행상품 상세 조회 실패:', error)
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    return NextResponse.json(
      { success: false, error: '발행상품 상세 조회에 실패했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// PUT: 발행상품 수정 (재발행 시도 등)
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return unauthorizedResponse()
    }

    const { id } = await params
    const publishedProductId = parsePublishedProductId(id)
    if (publishedProductId === null) {
      return invalidIdResponse()
    }

    // 발행상품 확인
    const existingProduct = await prisma.publishedProduct.findFirst({
      where: {
        id: publishedProductId,
        userId: currentUser.userId,
      },
    })

    if (!existingProduct) {
      return notFoundResponse()
    }

    const body = await request.json()
    const { status, externalId, externalUrl, errorMessage, isActive } = body

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (externalId !== undefined) updateData.externalId = externalId
    if (externalUrl !== undefined) updateData.externalUrl = externalUrl
    if (errorMessage !== undefined) updateData.errorMessage = errorMessage
    if (isActive !== undefined) updateData.isActive = isActive
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
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return unauthorizedResponse()
    }

    const { id } = await params
    const publishedProductId = parsePublishedProductId(id)
    if (publishedProductId === null) {
      return invalidIdResponse()
    }

    // 발행상품 확인
    const existingProduct = await prisma.publishedProduct.findFirst({
      where: {
        id: publishedProductId,
        userId: currentUser.userId,
      },
    })

    if (!existingProduct) {
      return notFoundResponse()
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
