import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'

/**
 * GET /api/product/[id]
 *
 * Get product by ID with all relations
 *
 * Response:
 * - success: boolean
 * - data?: Product (with post, images, options, variants)
 * - error?: string
 */
export async function GET(
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

    const id = parseInt(params.id)

    const product = await prisma.product.findFirst({
      where: {
        id,
        userId, // Ensure user owns the product
      },
      include: {
        collectedProduct: {
          include: {
            post: {
              include: {
                images: {
                  orderBy: { sortOrder: 'asc' },
                },
                channel: true,
              },
            },
          },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        options: true,
        variants: true,
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: product,
    })
  } catch (error) {
    console.error('상품 상세 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/product/[id]
 *
 * Update product by ID
 *
 * Body:
 * - name?: string
 * - price?: number
 * - description?: string
 *
 * Response:
 * - success: boolean
 * - data?: Product
 * - error?: string
 */
export async function PUT(
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

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상품 ID입니다.' },
        { status: 400 }
      )
    }

    // Check if product exists and belongs to user
    const existingProduct = await prisma.product.findFirst({
      where: { id, userId },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, price, description } = body

    const updateData: {
      name?: string
      price?: number | null
      description?: string | null
    } = {}

    if (name !== undefined) updateData.name = name
    if (price !== undefined) updateData.price = price
    if (description !== undefined) updateData.description = description

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: updatedProduct,
    })
  } catch (error) {
    console.error('상품 수정 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}
