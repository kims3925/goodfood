import { NextResponse } from 'next/server'
import prisma from '@/lib/database/client'

export async function POST(req: Request) {
  try {
    const { productId, status } = await req.json()

    if (!productId || !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product ID and status are required',
        },
        { status: 400 }
      )
    }

    // 유효한 상태 값 확인
    const validStatuses = ['active', 'soldout', 'draft']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid status value',
        },
        { status: 400 }
      )
    }

    // 상태를 DB 형식으로 변환
    const dbStatus = status === 'active' ? 'ACTIVE' : status === 'soldout' ? 'SOLD_OUT' : 'DRAFT'

    // 상품 상태 업데이트
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        status: dbStatus,
        updatedAt: new Date()
      },
    })

    return NextResponse.json({
      success: true,
      message: '상품 상태가 업데이트되었습니다.',
      product: {
        id: updatedProduct.id,
        status: status
      }
    })
  } catch (error) {
    console.error('Failed to update product status:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update product status',
      },
      { status: 500 }
    )
  }
}