/**
 * POST /api/product/bulk-category — 선택 상품 카테고리 일괄 변경 (2026-06-12)
 * body: { productIds: number[], categoryId: string }  // categoryId = Category.code
 * - ADMIN: 전체 상품 / MANAGER: 본인 상품만
 * - categoryId 는 활성 카테고리 code 여야 함
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const productIds: number[] = Array.isArray(body.productIds)
      ? body.productIds.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
      : []
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim() : ''

    if (productIds.length === 0) {
      return NextResponse.json({ success: false, error: '상품을 선택해주세요.' }, { status: 400 })
    }
    if (!categoryId) {
      return NextResponse.json({ success: false, error: '카테고리를 선택해주세요.' }, { status: 400 })
    }

    // 카테고리 존재 확인 (code 매칭)
    const category = await prisma.category.findFirst({
      where: { code: categoryId, deletedAt: null },
    })
    if (!category) {
      return NextResponse.json({ success: false, error: `존재하지 않는 카테고리입니다: ${categoryId}` }, { status: 400 })
    }

    const where: { id: { in: number[] }; deletedAt: null; userId?: number } = {
      id: { in: productIds },
      deletedAt: null,
    }
    if (me.role !== 'ADMIN') where.userId = me.userId

    const result = await prisma.product.updateMany({
      where,
      data: { categoryId },
    })

    return NextResponse.json({ success: true, updated: result.count, categoryId })
  } catch (error) {
    console.error('[Product Bulk Category]', error)
    return NextResponse.json({ success: false, error: '카테고리 변경 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
