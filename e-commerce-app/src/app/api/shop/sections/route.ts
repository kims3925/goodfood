/**
 * Shop Sections API
 * 채널별 상품 섹션 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus, ChannelKind, ChannelPlatform } from '@bandauto/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '8') // 각 섹션당 상품 개수

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
        const includeLegacyShopPublishes = channel.platform === ChannelPlatform.SHOP

        // 해당 채널에 발행된 상품 조회 (published_product 테이블 사용)
        const publishedProducts = await prisma.publishedProduct.findMany({
          where: {
            status: PublishStatus.SUCCESS,
            ...(includeLegacyShopPublishes
              ? { OR: [{ channelId: channel.id }, { channelId: null }] } // 채널 도입 이전 null 데이터 호환
              : { channelId: channel.id }),
          },
          include: {
            product: {
              include: {
                variants: {
                  orderBy: { id: 'asc' },
                  take: 1,
                },
                collectedProduct: {
                  include: {
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
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })

        // 상품 포맷팅
        const products = publishedProducts
          .filter((pp) => pp.product)
          .map((pp) => {
            const product = pp.product
            const mainVariant = product.variants[0]
            const images = product.collectedProduct?.post?.images?.map((img) => img.imageUrl) || []

            const salePrice = mainVariant?.price || product.price || 0
            const originalPrice = mainVariant?.wholesalePrice || product.wholesalePrice || salePrice
            const discount = originalPrice > salePrice
              ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
              : 0

            return {
              id: product.id.toString(),
              publishedProductId: pp.id.toString(), // 추가: 장바구니/주문에 필요
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
          id: channel.id,
          name: channel.name,
          coverUrl: channel.coverUrl,
          formUrl: channel.formUrl,
          products,
        }
      })
    )

    // 상품이 있는 섹션만 반환
    const filteredSections = sections.filter((section) => section.products.length > 0)

    // 3. 도매채널별 섹션 (발행된 상품만 포함)
    // 쇼핑몰에서는 product_publish를 통해서만 상품을 판매할 수 있음
    const wholesaleChannels = await prisma.channel.findMany({
      where: {
        isActive: true,
        kind: ChannelKind.WHOLESALE,
      },
      orderBy: { name: 'asc' },
    })

    const wholesaleSections = await Promise.all(
      wholesaleChannels.map(async (channel) => {
        // 해당 도매채널의 상품 중 발행된 것만 조회
        const publishedProducts = await prisma.publishedProduct.findMany({
          where: {
            status: PublishStatus.SUCCESS,
            product: {
              collectedProduct: {
                post: {
                  channelId: channel.id,
                },
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
                collectedProduct: {
                  include: {
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
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })

        const formattedProducts = publishedProducts
          .filter((pp) => pp.product)
          .map((pp) => {
            const product = pp.product
            const mainVariant = product.variants[0]
            const images = product.collectedProduct?.post?.images?.map((img) => img.imageUrl) || []

            const salePrice = mainVariant?.price || product.price || 0
            const originalPrice = mainVariant?.wholesalePrice || product.wholesalePrice || salePrice
            const discount = originalPrice > salePrice
              ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
              : 0

            return {
              id: product.id.toString(),
              publishedProductId: pp.id.toString(), // 추가: 장바구니/주문에 필요
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
          id: `wholesale_${channel.id}`,
          name: channel.name,
          coverUrl: channel.coverUrl,
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
