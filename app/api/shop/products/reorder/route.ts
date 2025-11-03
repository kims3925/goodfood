import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

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

    // 각 상품의 순서를 업데이트
    const updatePromises = products.map((product: { id: string; order: number }) =>
      prisma.product.update({
        where: { id: product.id },
        data: {
          order: product.order,
          updatedAt: new Date()
        },
      })
    )

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      message: '상품 순서가 업데이트되었습니다.',
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