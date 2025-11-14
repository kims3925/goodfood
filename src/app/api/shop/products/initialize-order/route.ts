import { NextResponse } from 'next/server'
import prisma from '@/lib/database/client'

export async function POST() {
  try {
    // TODO: Product 모델에 order 필드가 없습니다.
    // 순서 관리 기능을 사용하려면 schema.prisma에 order 필드를 추가해야 합니다.

    // 현재는 ACTIVE 상품들의 개수만 반환
    const count = await prisma.product.count({
      where: {
        status: 'ACTIVE'
      }
    })

    return NextResponse.json({
      success: true,
      message: `현재 ${count}개의 ACTIVE 상품이 있습니다. (순서 기능은 미구현)`,
      count: count
    })
  } catch (error) {
    console.error('Failed to initialize product order:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize product order',
      },
      { status: 500 }
    )
  }
}