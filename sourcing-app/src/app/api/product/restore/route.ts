export const dynamic = 'force-dynamic'

/**
 * POST /api/product/restore
 *
 * Soft-deleted 상품을 복원합니다 (deletedAt: null 설정)
 *
 * Body:
 * - productId: number - 복원할 상품 ID
 *
 * Response:
 * - success: boolean
 * - data?: Product
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'

export async function POST(request: NextRequest) {
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
    const { productId } = body

    if (!productId || isNaN(parseInt(productId))) {
      return NextResponse.json(
        { success: false, error: '유효한 productId가 필요합니다.' },
        { status: 400 }
      )
    }

    const id = parseInt(productId)

    // 소유권 확인
    const existing = await prisma.product.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없거나 권한이 없습니다.' },
        { status: 404 }
      )
    }

    // deletedAt: null 로 복원 + isActive: true 설정
    const updateResult = await prisma.product.updateMany({
      where: { id, userId },
      data: {
        deletedAt: null,
        isActive: true,
      },
    })

    if (updateResult.count === 0) {
      return NextResponse.json(
        { success: false, error: '복원에 실패했습니다.' },
        { status: 500 }
      )
    }

    const restoredProduct = await prisma.product.findUnique({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: '상품이 복원되었습니다.',
      data: restoredProduct,
    })
  } catch (error) {
    console.error('상품 복원 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 복원에 실패했습니다.' },
      { status: 500 }
    )
  }
}
