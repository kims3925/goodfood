import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'

/**
 * POST /api/product/[id]/republish-mark
 *
 * 재발행 성공 후 Product.republishedAt을 현재 시각으로 업데이트.
 * 가공상품 목록(product/list)의 발행상태 컬럼에 "재발행완료"로 표기하기 위함.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상품 ID입니다.' },
        { status: 400 }
      )
    }

    const product = await prisma.product.findFirst({
      where: { id, userId: user.userId },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { republishedAt: new Date() },
      select: { id: true, republishedAt: true },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('republish-mark 실패:', error)
    return NextResponse.json(
      { success: false, error: '재발행 표시에 실패했습니다.' },
      { status: 500 }
    )
  }
}
