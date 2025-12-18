export const dynamic = 'force-dynamic'

/**
 * Shop Product Detail API
 * 쇼핑몰 상품 상세 조회
 *
 * shopId 기반 필터링:
 * - x-shop-id 헤더로 해당 Shop에 발행된 상품 정보 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId') || searchParams.get('bandId') // 하위 호환성

    // Shop ID 확인 (middleware에서 설정)
    const shopIdHeader = req.headers.get('x-shop-id')
    const currentShopId = shopIdHeader ? parseInt(shopIdHeader) : null

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상품 ID' },
        { status: 400 }
      )
    }

    // publishedProducts 조회 조건: shopId 우선, channelId 하위 호환
    const publishedProductsWhere: any = {}
    if (currentShopId) {
      publishedProductsWhere.shopId = currentShopId
    } else if (channelId) {
      publishedProductsWhere.channelId = parseInt(channelId)
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
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        publishedProducts: {
          where: publishedProductsWhere,
          include: {
            channel: true,
            shop: true,
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

    const mainVariant = product?.variants[0]
    const images = product.images?.map((img) => img.url) || []

    // 옵션 그룹화
    const optionGroups = product.options.reduce((acc: Record<string, string[]>, option) => {
      if (!acc[option.groupName]) {
        acc[option.groupName] = []
      }
      acc[option.groupName].push(option.value)
      return acc
    }, {})

    // variants 정보 (id 포함)
    const formattedVariants = product.variants.map((variant) => ({
      id: variant.id,
      optionSummary: variant.optionSummary || product.name,
      price: variant.price,
      wholesalePrice: variant.wholesalePrice,
    }))

    // 채널 정보 가져오기 (published_product -> channel)
    const publishedProduct = product.publishedProducts[0]
    const channel = publishedProduct?.channel
    const shop = publishedProduct?.shop
    const channelName = channel?.name || null
    const publishChannelId = channel?.id || null
    const publishedProductId = publishedProduct?.id || null
    const isActive = publishedProduct?.isActive ?? true // 발행 상품의 활성 상태 (비활성이면 품절)

    // 판매자 정보 (추후 별도 필드로 관리)
    const sellerName = null

    // 배송 정보 파싱 (상품별 배송 정보)
    let parsedShippingInfo: any = {}
    if (product.shippingInfo) {
      try {
        parsedShippingInfo = JSON.parse(product.shippingInfo)
      } catch {
        // JSON 파싱 실패 시 텍스트 그대로 사용
        parsedShippingInfo = { info: product.shippingInfo }
      }
    }

    const formattedProduct = {
      id: product.id,
      publishedProductId: publishedProductId || null, // 추가: 장바구니/주문에 필요
      title: product.name,
      description: product.description || '',
      images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
      detailImages: images.length > 1 ? images.slice(1) : [],
      category: product.categoryId || '',
      rating: 4.5,
      reviews: 100,
      channelName,
      channelId: publishChannelId,
      // 하위 호환성
      bandName: channelName,
      retailBandId: publishChannelId,
      sellerName,
      shippingFee: product.shippingFee,
      shippingInfo: {
        // 상품별 배송 설정 사용
        defaultShippingFee: product.shippingFee ?? 0,
        freeShippingAmount: parsedShippingInfo.freeShippingAmount ?? 0,
        ...parsedShippingInfo,
      },
      // variants 정보 (가격은 variant에서 가져옴)
      variants: formattedVariants,
      optionGroups: Object.keys(optionGroups).length > 0 ? optionGroups : undefined,
      // 품절 상태 (isActive가 false면 품절)
      isActive,
      isSoldOut: !isActive,
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
