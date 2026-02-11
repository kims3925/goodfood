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
import { calculateSellingPrice } from '@/lib/price-calculator'

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

    // shopProducts 조회 조건: shopId 기반 필터링
    const shopProductsWhere: any = {
      deletedAt: null, // Soft Delete 제외
    }
    if (currentShopId) {
      shopProductsWhere.shopId = currentShopId
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null, // Soft Delete 제외
      },
      include: {
        variants: {
          where: { deletedAt: null }, // Soft Delete 제외
          orderBy: { id: 'asc' },
        },
        options: {
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        shopProducts: {
          where: shopProductsWhere,
          include: {
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

    // 배송비 (발행 시 판매가에 포함)
    const shippingFee = product.shippingFee ?? 0
    const bundleMaxQty = (product as any).bundleMaxQty ?? 1
    const bundleShippingType = (product as any).bundleShippingType || null

    // variants 정보 (id 포함) - 공통 모듈 사용
    const formattedVariants = product.variants.map((variant) => ({
      id: variant.id,
      optionSummary: variant.optionSummary || product.name,
      // 공통 모듈로 판매가 계산 (배송비 타입에 따라 자동 처리)
      price: calculateSellingPrice(variant.price, shippingFee, bundleShippingType),
      originalPrice: variant.price, // DB에 저장된 원래 가격
      wholesalePrice: variant.wholesalePrice,
      bundleUnit: variant.bundleUnit || 1,
    }))

    // 합배송 옵션 계산 (bundleMaxQty > 1인 경우)
    // 참고: 실제 계산은 ProductDetailClient에서 bundleUnit을 고려하여 다시 계산됨
    const bundleOptions: any[] = []

    // Shop 정보 가져오기 (shop_product -> shop)
    const shopProduct = product.shopProducts[0]
    const shop = shopProduct?.shop
    const shopProductId = shopProduct?.id || null

    // currentShopId가 있는데 shopProduct가 없으면 해당 샵에 발행되지 않은 상품
    if (currentShopId && !shopProduct) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // Product 레벨 활성화 상태
    // NOTE: Prisma 타입에 isActive가 없어 as any 사용. prisma generate 후 타입 안전성 확보 필요
    const isActive = (product as any).isActive ?? true

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
      shopProductId: shopProductId || null, // 추가: 장바구니/주문에 필요
      title: product.name,
      description: product.description || '',
      images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
      detailImages: images.length > 1 ? images.slice(1) : [],
      category: product.categoryId || '',
      rating: 4.5,
      reviews: 100,
      sellerName,
      shippingFee: product.shippingFee,
      shippingInfo: {
        // 상품별 배송 설정 사용
        defaultShippingFee: product.shippingFee ?? 0,
        freeShippingAmount: parsedShippingInfo.freeShippingAmount ?? 0,
        ...parsedShippingInfo,
      },
      // variants 정보 (가격은 variant에서 가져옴, 배송비 포함)
      variants: formattedVariants,
      optionGroups: Object.keys(optionGroups).length > 0 ? optionGroups : undefined,
      // 합배송 옵션 (bundleMaxQty > 1인 경우에만)
      bundleOptions: bundleOptions.length > 0 ? bundleOptions : undefined,
      bundleMaxQty: bundleMaxQty > 1 ? bundleMaxQty : undefined,
      // 합배송 타입: NONE(없음), INCLUDED(배송비 포함형), SEPARATE(배송비 별도형)
      bundleShippingType: product.bundleShippingType || null,
      // 상품 노출 상태
      // - isActive: 판매자가 상품을 활성화했는지 여부
      // - isSoldOut: 현재는 isActive와 동일하게 처리 (재고 관리 미사용)
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
