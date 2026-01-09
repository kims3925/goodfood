export const dynamic = 'force-dynamic'

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
        channel: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        options: true,
        variants: true,
        shopProducts: {
          include: {
            shop: {
              select: {
                id: true,
                name: true,
                subdomain: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        channelProducts: {
          include: {
            channel: {
              select: {
                id: true,
                name: true,
                channelKey: true,
                coverUrl: true,
                kind: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
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

/**
 * PATCH /api/product/[id]
 *
 * Product 활성화 상태 토글
 *
 * Body:
 * - isActive: boolean - 활성화 상태
 *
 * Response:
 * - success: boolean
 * - data?: Product
 * - message?: string
 * - error?: string
 */
export async function PATCH(
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

    const body = await request.json()
    const { isActive } = body

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isActive는 필수 값입니다.' },
        { status: 400 }
      )
    }

    // 소유권 확인과 업데이트를 원자적으로 수행 (TOCTOU 방지)
    const updateResult = await prisma.product.updateMany({
      where: { id, userId },
      data: { isActive },
    })

    if (updateResult.count === 0) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 업데이트된 상품 조회
    const updatedProduct = await prisma.product.findUnique({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      message: isActive ? '상품이 활성화되었습니다.' : '상품이 비활성화되었습니다.',
    })
  } catch (error) {
    console.error('상품 활성화 상태 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 활성화 상태 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
