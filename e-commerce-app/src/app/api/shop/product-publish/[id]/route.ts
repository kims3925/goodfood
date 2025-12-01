/**
 * Published Product Detail API
 * publishedProductId로 상품 정보 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus } from '@bandauto/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const publishedProductId = parseInt(params.id)

    if (isNaN(publishedProductId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상품 발행 ID' },
        { status: 400 }
      )
    }

    const publishedProduct = await prisma.publishedProduct.findFirst({
      where: {
        id: publishedProductId,
        status: PublishStatus.SUCCESS,
      },
      include: {
        product: {
          include: {
            collectedProduct: {
              include: {
                post: {
                  include: {
                    images: {
                      orderBy: { sortOrder: 'asc' },
                    },
                    channel: true,
                  },
                },
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
        channel: true,
      },
    })

    if (!publishedProduct) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없거나 판매 중인 상품이 아닙니다' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      publishedProduct,
    })
  } catch (error: any) {
    console.error('Published product detail error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '상품 조회 실패' },
      { status: 500 }
    )
  }
}
