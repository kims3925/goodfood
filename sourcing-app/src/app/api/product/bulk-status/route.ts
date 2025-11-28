import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@/lib/prisma'

/**
 * PUT /api/product/bulk-status
 *
 * Bulk update product status
 *
 * Request Body:
 * - productIds: number[] (array of product IDs to update)
 * - status: string (new status: DRAFT, ACTIVE, INACTIVE, SOLDOUT)
 *
 * Response:
 * - success: boolean
 * - updatedCount?: number
 * - error?: string
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
    const { productIds, status } = body

    // Validate required fields
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '상품 ID 목록이 필요합니다.' },
        { status: 400 }
      )
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: '변경할 상태가 필요합니다.' },
        { status: 400 }
      )
    }

    // Validate status value
    const validStatuses = ['DRAFT', 'ACTIVE', 'INACTIVE', 'SOLDOUT']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상태입니다.' },
        { status: 400 }
      )
    }

    // Update products (only user's own products)
    const result = await prisma.product.updateMany({
      where: {
        id: { in: productIds },
        userId,
      },
      data: {
        status,
      },
    })

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    })
  } catch (error) {
    console.error('상품 일괄 상태 변경 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 상태 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
