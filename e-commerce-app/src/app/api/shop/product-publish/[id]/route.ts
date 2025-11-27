/**
 * Product Publish Detail API
 * productPublishId로 상품 정보 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus } from '@bandauto/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productPublishId = parseInt(params.id)

    if (isNaN(productPublishId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상품 발행 ID' },
        { status: 400 }
      )
    }

    const productPublish = await prisma.productPublish.findFirst({
      where: {
        id: productPublishId,
        status: PublishStatus.SUCCESS,
      },
      include: {
        product: {
          include: {
            post: {
              include: {
                images: {
                  orderBy: { sortOrder: 'asc' },
                },
                wholesaleBand: true,
              },
            },
            variants: {
              orderBy: { id: 'asc' },
            },
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        retailBand: true,
      },
    })

    if (!productPublish) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없거나 판매 중인 상품이 아닙니다' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      productPublish,
    })
  } catch (error: any) {
    console.error('Product publish detail error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '상품 조회 실패' },
      { status: 500 }
    )
  }
}
