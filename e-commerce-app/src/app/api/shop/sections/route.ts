/**
 * Shop Sections API
 * 소매밴드별 상품 섹션 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus } from '@bandauto/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '8') // 각 섹션당 상품 개수

    // 1. 활성화된 소매밴드 목록 조회
    const retailBands = await prisma.retailBand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })

    // 2. 각 소매밴드별로 발행된 상품 조회
    const sections = await Promise.all(
      retailBands.map(async (band) => {
        // 해당 소매밴드에 발행된 상품 조회 (product_publish 테이블 사용)
        const productPublishes = await prisma.productPublish.findMany({
          where: {
            retailBandId: band.id,
            status: 'SUCCESS',
          },
          include: {
            product: {
              include: {
                variants: {
                  orderBy: { id: 'asc' },
                  take: 1,
                },
                post: {
                  include: {
                    images: {
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })

        // 상품 포맷팅
        const products = productPublishes
          .filter((pp) => pp.product)
          .map((pp) => {
            const product = pp.product
            const mainVariant = product.variants[0]
            const images = product.post?.images?.map((img) => img.imageUrl) || []

            const salePrice = mainVariant?.price || product.price || 0
            const originalPrice = mainVariant?.wholesalePrice || product.wholesalePrice || salePrice
            const discount = originalPrice > salePrice
              ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
              : 0

            return {
              id: product.id.toString(),
              productPublishId: pp.id.toString(), // 추가: 장바구니/주문에 필요
              title: product.name,
              description: product.description,
              originalPrice,
              salePrice,
              discount,
              images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
              category: product.categoryId || '',
              rating: 4.5,
              reviews: 100,
              stock: mainVariant?.stock || 100,
            }
          })

        return {
          id: band.id,
          name: band.name,
          coverUrl: band.coverUrl,
          formUrl: band.formUrl,
          products,
        }
      })
    )

    // 상품이 있는 섹션만 반환
    const filteredSections = sections.filter((section) => section.products.length > 0)

    // 3. 도매밴드별 섹션 (발행된 상품만 포함)
    // 쇼핑몰에서는 product_publish를 통해서만 상품을 판매할 수 있음
    const wholesaleBands = await prisma.wholesaleBand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })

    const wholesaleSections = await Promise.all(
      wholesaleBands.map(async (band) => {
        // 해당 도매밴드의 상품 중 발행된 것만 조회
        const productPublishes = await prisma.productPublish.findMany({
          where: {
            status: PublishStatus.SUCCESS,
            product: {
              post: {
                wholesaleBandId: band.id,
              },
            },
          },
          include: {
            product: {
              include: {
                variants: {
                  orderBy: { id: 'asc' },
                  take: 1,
                },
                post: {
                  include: {
                    images: {
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })

        const formattedProducts = productPublishes
          .filter((pp) => pp.product)
          .map((pp) => {
            const product = pp.product
            const mainVariant = product.variants[0]
            const images = product.post?.images?.map((img) => img.imageUrl) || []

            const salePrice = mainVariant?.price || product.price || 0
            const originalPrice = mainVariant?.wholesalePrice || product.wholesalePrice || salePrice
            const discount = originalPrice > salePrice
              ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
              : 0

            return {
              id: product.id.toString(),
              productPublishId: pp.id.toString(), // 추가: 장바구니/주문에 필요
              title: product.name,
              description: product.description,
              originalPrice,
              salePrice,
              discount,
              images: images.length > 0 ? images : [product.thumbnailUrl || '/placeholder.jpg'],
              category: product.categoryId || '',
              rating: 4.5,
              reviews: 100,
              stock: mainVariant?.stock || 100,
            }
          })

        return {
          id: `wholesale_${band.id}`,
          name: band.name,
          coverUrl: band.coverUrl,
          type: 'wholesale',
          products: formattedProducts,
        }
      })
    )

    const filteredWholesaleSections = wholesaleSections.filter(
      (section) => section.products.length > 0
    )

    return NextResponse.json({
      success: true,
      retailSections: filteredSections,
      wholesaleSections: filteredWholesaleSections,
    })
  } catch (error: any) {
    console.error('Shop sections GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '섹션 조회 실패' },
      { status: 500 }
    )
  }
}
