import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function POST() {
  try {
    // 현재 ACTIVE 상품들을 createdAt 기준으로 정렬하여 가져오기
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        order: 0 // order가 0인 상품들만
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 각 상품에 순서 번호 할당
    const updatePromises = products.map((product, index) =>
      prisma.product.update({
        where: { id: product.id },
        data: {
          order: index + 1,
          updatedAt: new Date()
        },
      })
    )

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      message: `${products.length}개 상품의 순서가 초기화되었습니다.`,
      count: products.length
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