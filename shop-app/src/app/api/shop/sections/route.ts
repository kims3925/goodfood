export const dynamic = 'force-dynamic'

/**
 * Shop Sections API
 * Shop별 상품 섹션 조회
 *
 * Shop 기반 필터링:
 * - x-shop-id 헤더가 있으면 해당 Shop에 발행된 상품만 반환
 * - 없으면 기존처럼 전체 섹션 반환 (하위 호환)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind } from '@bandauto/db'
import { calculateSellingPrice } from '@/lib/price-calculator'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')?.trim() || null

    // Shop ID 확인 (middleware에서 설정)
    const shopIdHeader = req.headers.get('x-shop-id')
    const currentShopId = shopIdHeader ? parseInt(shopIdHeader) : null

    // Shop이 지정된 경우: 해당 Shop의 상품만 반환
    if (currentShopId) {
      return await getShopProducts(currentShopId, limit, search)
    }

    // 채널 ID 확인 (하위 호환)
    const channelIdHeader = req.headers.get('x-channel-id')
    const currentChannelId = channelIdHeader ? parseInt(channelIdHeader) : null

    if (currentChannelId) {
      return await getChannelProducts(currentChannelId, limit)
    }

    // 채널 미지정: 기존 로직 (전체 소매채널 섹션)
    // 1. 활성화된 소매채널 목록 조회
    const retailChannels = await prisma.channel.findMany({
      where: {
        isActive: true,
        kind: ChannelKind.RETAIL,
      },
      orderBy: { name: 'asc' },
    })

    // 2. 각 소매채널별로 발행된 상품 조회
    const sections = await Promise.all(
      retailChannels.map(async (channel) => {
        // 해당 채널에 발행된 상품 조회 (channel_product 테이블 사용)
        const channelProducts = await prisma.channelProduct.findMany({
          where: {
            channelId: channel.id,
          },
          include: {
            product: {
              include: {
                variants: {
                  orderBy: { id: 'asc' },
                  take: 1,
                },
                images: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })

        // 상품 포맷팅
        const products = channelProducts
          .filter((cp) => cp.product)
          .map((cp) => {
            const product = cp.product!
            const mainVariant = product?.variants[0]
            const images = product.images?.map((img) => img.url) || []

            // 공통 모듈로 판매가 계산 (배송비 타입에 따라 자동 처리)
            const basePrice = mainVariant?.price || 0
            const shippingFee = product.shippingFee || 0
            const bundleShippingType = product.bundleShippingType || null
            const salePrice = calculateSellingPrice(basePrice, shippingFee, bundleShippingType)
            const originalPrice = salePrice
            const discount = 0

            return {
              id: product.id,
              channelProductId: cp.id,
              title: product.name,
              description: product.description,
              originalPrice,
              salePrice,
              discount,
              images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
              category: product.categoryId || '',
              rating: 4.5,
              reviews: 100,
            }
          })

        return {
          id: channel.id,
          name: channel.name,
          coverUrl: channel.coverUrl,
          products,
        }
      })
    )

    // 상품이 있는 섹션만 필터링
    const filteredSections = sections.filter((section) => section.products.length > 0)

    return NextResponse.json({
      success: true,
      retailSections: filteredSections,
      wholesaleSections: [],
    })
  } catch (error: any) {
    console.error('Shop sections GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '섹션 조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * 특정 Shop의 상품만 조회
 * shopId 기반으로 발행된 상품 반환
 * @param search - 검색어 (상품명 검색)
 */
async function getShopProducts(shopId: number, limit: number, search: string | null = null) {
  // Shop 정보 조회
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      theme: {
        select: {
          primaryColor: true,
          secondaryColor: true,
          logoUrl: true,
          faviconUrl: true,
          bannerUrl: true,
        },
      },
    },
  })

  if (!shop || !shop.isActive) {
    return NextResponse.json({
      success: true,
      products: [],
      shop: null,
      search: search,
    })
  }

  // 검색 조건 구성: 활성화된 상품만 표시
  const whereCondition: any = {
    shopId: shopId,
    deletedAt: null, // Soft Delete 제외
    product: {
      isActive: true, // Product 레벨에서 비활성화된 상품 제외
    },
  }

  // 검색어가 있으면 상품명으로 필터링
  if (search) {
    whereCondition.product = {
      ...whereCondition.product,
      name: {
        contains: search,
      },
    }
  }

  // 해당 Shop에 발행된 상품만 조회
  const shopProducts = await prisma.shopProduct.findMany({
    where: whereCondition,
    include: {
      product: {
        include: {
          variants: {
            orderBy: { id: 'asc' },
            take: 1,
          },
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // 상품 포맷팅
  const products = shopProducts
    .filter((sp) => sp.product)
    .map((sp) => {
      const product = sp.product!
      const mainVariant = product?.variants[0]
      const images = product.images?.map((img) => img.url) || []

      // 공통 모듈로 판매가 계산 (배송비 타입에 따라 자동 처리)
      const basePrice = mainVariant?.price || 0
      const shippingFee = product.shippingFee || 0
      const bundleShippingType = product.bundleShippingType || null
      const salePrice = calculateSellingPrice(basePrice, shippingFee, bundleShippingType)
      const originalPrice = salePrice
      const discount = 0

      return {
        id: product.id,
        shopProductId: sp.id,
        title: product.name,
        description: product.description,
        originalPrice,
        salePrice,
        discount,
        images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
        category: product.categoryId || '',
        rating: 4.5,
        reviews: 100,
      }
    })

  return NextResponse.json({
    success: true,
    products,
    // 기존 호환성을 위해 channelProducts도 포함
    channelProducts: products,
    shop: {
      id: shop.id,
      name: shop.name,
      subdomain: shop.subdomain,
      theme: shop.theme,
    },
    // 검색 정보
    search: search,
    totalCount: products.length,
  })
}

/**
 * 특정 채널의 상품만 조회
 * 멀티채널 쇼핑몰에서 현재 접속 채널의 상품 반환
 */
async function getChannelProducts(channelId: number, limit: number) {
  // 채널 정보 조회
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  })

  if (!channel || !channel.isActive) {
    return NextResponse.json({
      success: true,
      channelProducts: [],
      channel: null,
    })
  }

  // 해당 채널에 발행된 상품 조회 (channel_product 테이블 사용)
  const channelProducts = await prisma.channelProduct.findMany({
    where: {
      channelId: channelId,
    },
    include: {
      product: {
        include: {
          variants: {
            orderBy: { id: 'asc' },
            take: 1,
          },
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // 상품 포맷팅
  const products = channelProducts
    .filter((cp) => cp.product)
    .map((cp) => {
      const product = cp.product!
      const mainVariant = product?.variants[0]
      const images = product.images?.map((img) => img.url) || []

      // 공통 모듈로 판매가 계산 (배송비 타입에 따라 자동 처리)
      const basePrice = mainVariant?.price || 0
      const shippingFee = product.shippingFee || 0
      const bundleShippingType = product.bundleShippingType || null
      const salePrice = calculateSellingPrice(basePrice, shippingFee, bundleShippingType)
      const originalPrice = salePrice
      const discount = 0

      return {
        id: product.id,
        channelProductId: cp.id,
        title: product.name,
        description: product.description,
        originalPrice,
        salePrice,
        discount,
        images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
        category: product.categoryId || '',
        rating: 4.5,
        reviews: 100,
      }
    })

  return NextResponse.json({
    success: true,
    channelProducts: products,
    channel: {
      id: channel.id,
      name: channel.name,
      coverUrl: channel.coverUrl,
    },
    // 기존 호환성을 위해 retailSections도 포함
    retailSections: products.length > 0
      ? [
          {
            id: channel.id,
            name: channel.name,
            coverUrl: channel.coverUrl,
            products,
          },
        ]
      : [],
  })
}
