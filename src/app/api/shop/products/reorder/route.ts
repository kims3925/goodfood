import { NextResponse } from 'next/server'
import prisma from '@/lib/database/client'

export async function POST(req: Request) {
  try {
    const { products } = await req.json()

    if (!products || !Array.isArray(products)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Products array is required',
        },
        { status: 400 }
      )
    }

    // TODO: Product 모델에 order 필드가 없습니다.
    // 순서 관리 기능을 사용하려면 schema.prisma에 order 필드를 추가해야 합니다.

    return NextResponse.json({
      success: true,
      message: '상품 순서 업데이트 기능은 미구현입니다. (order 필드가 없음)',
    })
  } catch (error) {
    console.error('Failed to update product order:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update product order',
      },
      { status: 500 }
    )
  }
}