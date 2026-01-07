export const dynamic = 'force-dynamic'

/**
 * Published Product Detail API
 * publishedProductId로 상품 정보 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { calculateSellingPrice } from '@/lib/price-calculator'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shopProductId = parseInt(params.id)

    if (isNaN(shopProductId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상품 발행 ID' },
        { status: 400 }
      )
    }

    const shopProduct = await prisma.shopProduct.findFirst({
      where: {
        id: shopProductId,
      },
      include: {
        product: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
            variants: {
              orderBy: { id: 'asc' },
            },
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        shop: true,
      },
    })

    if (!shopProduct) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없거나 판매 중인 상품이 아닙니다' },
        { status: 404 }
      )
    }

    // 공통 모듈로 판매가 계산 (variants에 배송비 포함된 가격 적용)
    const product = shopProduct.product
    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const shippingFee = product.shippingFee ?? 0
    const bundleShippingType = product.bundleShippingType || null

    const formattedVariants = product.variants.map((variant) => ({
      ...variant,
      // 공통 모듈로 판매가 계산 (배송비 타입에 따라 자동 처리)
      price: calculateSellingPrice(variant.price, shippingFee, bundleShippingType),
      originalPrice: variant.price, // DB에 저장된 원래 가격
    }))

    // shopProduct에 계산된 variants 적용
    const result = {
      ...shopProduct,
      product: {
        ...product,
        variants: formattedVariants,
      },
    }

    return NextResponse.json({
      success: true,
      shopProduct: result,
    })
  } catch (error: any) {
    console.error('Published product detail error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '상품 조회 실패' },
      { status: 500 }
    )
  }
}
