import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@/lib/prisma'

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
        post: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
            wholesaleBand: true,
          },
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
