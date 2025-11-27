/**
 * Shop Product Detail API
 * 쇼핑몰 상품 상세 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus } from '@bandauto/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)
    const { searchParams } = new URL(req.url)
    const bandId = searchParams.get('bandId')

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상품 ID' },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          orderBy: { id: 'asc' },
        },
        options: {
          orderBy: { sortOrder: 'asc' },
        },
        post: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
            },
            wholesaleBand: true, // 판매자(도매밴드) 정보
          },
        },
        productPublishes: {
          where: bandId
            ? { retailBandId: parseInt(bandId), status: PublishStatus.SUCCESS }
            : { status: PublishStatus.SUCCESS },
          include: {
            retailBand: true,
          },
          take: 1,
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    const mainVariant = product.variants[0]
    const images = product.post?.images?.map((img) => img.imageUrl) || []

    const salePrice = mainVariant?.price || product.price || 0
    const originalPrice = mainVariant?.wholesalePrice || product.wholesalePrice || salePrice
    const discount = originalPrice > salePrice
      ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
      : 0

    // 옵션 그룹화
    const optionGroups = product.options.reduce((acc: Record<string, string[]>, option) => {
      if (!acc[option.groupName]) {
        acc[option.groupName] = []
      }
      acc[option.groupName].push(option.value)
      return acc
    }, {})

    // 옵션별 가격
    const formattedOptions = product.variants.map((variant) => ({
      name: variant.optionSummary || product.name,
      price: variant.price,
      stock: variant.stock,
      sku: variant.sku,
    }))

    // 밴드 정보 가져오기 (product_publish -> retail_band)
    const productPublish = product.productPublishes[0]
    const retailBand = productPublish?.retailBand
    const bandName = retailBand?.name || null
    const retailBandId = retailBand?.id || null
    const productPublishId = productPublish?.id || null

    // 판매자 정보 가져오기 (post -> wholesaleBand)
    const sellerName = product.post?.wholesaleBand?.name || null

    const formattedProduct = {
      id: product.id.toString(),
      productPublishId: productPublishId?.toString() || null, // 추가: 장바구니/주문에 필요
      title: product.name,
      description: product.description || '',
      originalPrice,
      salePrice,
      discount,
      images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
      detailImages: images.length > 1 ? images.slice(1) : [],
      category: product.categoryId || '',
      stock: mainVariant?.stock || 100,
      rating: 4.5,
      reviews: 100,
      bandName,
      retailBandId,
      sellerName,
      shippingInfo: {
        defaultShippingFee: 3000,
        freeShippingAmount: 30000,
      },
      options: formattedOptions.length > 1 ? formattedOptions : undefined,
      optionGroups: Object.keys(optionGroups).length > 0 ? optionGroups : undefined,
    }

    return NextResponse.json({
      success: true,
      product: formattedProduct,
    })
  } catch (error: any) {
    console.error('Shop product detail error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '상품 상세 조회 실패' },
      { status: 500 }
    )
  }
}
