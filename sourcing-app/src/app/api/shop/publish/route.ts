import { NextRequest, NextResponse } from 'next/server'
import prisma, { ProductStatus, ChannelKind, ChannelPlatform } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * GET /api/shop/publish
 *
 * Get publishable products with their publish status
 * Returns products with ACTIVE status and their current publish info
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build where clause
    const where: any = {
      userId,
    }

    // 검색
    if (search) {
      where.name = { contains: search }
    }

    // Get total count
    const total = await prisma.product.count({ where })

    // 전체 통계 계산 (탭과 무관하게 일정한 값)
    const allProductsWithPublish = await prisma.product.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        productPublishes: {
          where: {
            publishType: PublishType.SHOPPING_MALL,
          },
          select: { id: true },
        },
      },
    })

    const totalProducts = allProductsWithPublish.length
    const publishedProducts = allProductsWithPublish.filter(
      (p) => p.productPublishes.length > 0
    ).length
    const unpublishedProducts = totalProducts - publishedProducts

    // Get products with publish info
    const products = await prisma.product.findMany({
      where,
      include: {
        collectedProduct: {
          include: {
            post: {
              include: {
                images: {
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                },
                channel: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        variants: {
          orderBy: { id: 'asc' },
          take: 1,
        },
        publishedProducts: {
          select: {
            id: true,
            channelId: true,
            createdAt: true,
            channel: {
              select: {
                id: true,
                name: true,
                kind: true,
                platform: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    // Format response
    const formattedProducts = products.map((product) => {
      const mainImage = product.collectedProduct?.post?.images?.[0]?.url || product.thumbnailUrl
      const mainVariant = product.variants?.[0]

      // 발행 유형별 분류:
      // - 채널 발행 (RETAIL kind, 비-SHOP): channelId가 있고 platform이 SHOP이 아닌 경우
      // - 쇼핑몰 발행: platform이 SHOP인 경우 또는 channelId가 없는 경우 (하위 호환성)
      const channelPublishes = product.publishedProducts.filter(
        (pp) => pp.channelId && pp.channel?.kind === ChannelKind.RETAIL && pp.channel?.platform !== ChannelPlatform.SHOP
      )
      const shoppingMallPublishes = product.publishedProducts.filter(
        (pp) => !pp.channelId || pp.channel?.platform === ChannelPlatform.SHOP
      )

      const hasChannelPublish = channelPublishes.length > 0
      const hasShoppingMall = shoppingMallPublishes.length > 0

      let publishSummary = '미발행'
      if (hasChannelPublish && hasShoppingMall) {
        publishSummary = '발행완료'
      } else if (hasChannelPublish || hasShoppingMall) {
        publishSummary = '부분발행'
      }

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        thumbnailUrl: mainImage,
        price: mainVariant?.price || product.price,
        wholesalePrice: mainVariant?.wholesalePrice || null,
        stock: mainVariant?.stock || 0,
        channel: product.collectedProduct?.post?.channel,
        // 발행 상태 (유형별)
        publishStatus: {
          retailBand: hasChannelPublish, // 하위 호환성
          channel: hasChannelPublish,
          shoppingMall: hasShoppingMall,
        },
        publishSummary,
        // 발행된 채널 목록
        publishedChannels: channelPublishes.map((pp) => ({
          publishId: pp.id,
          channelId: pp.channel?.id,
          channelName: pp.channel?.name,
          status: 'SUCCESS',
          createdAt: pp.createdAt,
        })),
        // 쇼핑몰 발행 상태
        shoppingMallPublish: shoppingMallPublishes[0]
          ? {
              publishId: shoppingMallPublishes[0].id,
              status: 'SUCCESS',
              createdAt: shoppingMallPublishes[0].createdAt,
            }
          : null,
        createdAt: product.createdAt,
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedProducts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: totalProducts,
        published: publishedProducts,
        unpublished: unpublishedProducts,
      },
    })
  } catch (error) {
    console.error('발행 가능 상품 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/shop/publish
 *
 * Publish products to a selected channel
 * channelId is required - user must select an existing channel
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const body = await request.json()
    const { productIds, channelId } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '발행할 상품을 선택해주세요.' },
        { status: 400 }
      )
    }

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: '발행할 채널을 선택해주세요.' },
        { status: 400 }
      )
    }

    // Validate channel belongs to user and is RETAIL kind
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId,
        kind: ChannelKind.RETAIL,
        isActive: true,
      },
      select: { id: true, name: true, platform: true },
    })

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '선택한 채널을 찾을 수 없거나 발행 권한이 없습니다.' },
        { status: 400 }
      )
    }

    // Validate products belong to user
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        userId,
      },
    })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { success: false, error: '일부 상품을 찾을 수 없습니다.' },
        { status: 400 }
      )
    }

    // Check existing publishes for this channel
    const existingPublishes = await prisma.publishedProduct.findMany({
      where: {
        productId: { in: productIds },
        channelId: channel.id,
      },
      select: {
        productId: true,
      },
    })

    const existingProductIds = new Set(existingPublishes.map((p) => p.productId))

    // Create publish records
    const results: {
      productId: number
      status: 'SUCCESS' | 'SKIPPED' | 'FAILED'
      publishId?: number
      message?: string
    }[] = []

    for (const productId of productIds) {
      if (existingProductIds.has(productId)) {
        results.push({
          productId,
          status: 'SKIPPED',
          message: `이미 ${channel.name} 채널에 발행된 상품입니다.`,
        })
        continue
      }

      try {
        const publish = await prisma.publishedProduct.create({
          data: {
            userId,
            productId,
            channelId: channel.id,
            publishedAt: new Date(),
          },
        })

        results.push({
          productId,
          status: 'SUCCESS',
          publishId: publish.id,
        })
      } catch (error: any) {
        console.error(`채널 발행 실패 (product: ${productId}, channel: ${channel.id}):`, error)
        results.push({
          productId,
          status: 'FAILED',
          message: error.message || '발행에 실패했습니다.',
        })
      }
    }

    const successCount = results.filter((r) => r.status === 'SUCCESS').length
    const skippedCount = results.filter((r) => r.status === 'SKIPPED').length
    const failedCount = results.filter((r) => r.status === 'FAILED').length

    return NextResponse.json({
      success: true,
      message: `${successCount}개 발행 완료, ${skippedCount}개 건너뜀, ${failedCount}개 실패`,
      channel: {
        id: channel.id,
        name: channel.name,
        platform: channel.platform,
      },
      results,
      summary: {
        total: results.length,
        success: successCount,
        skipped: skippedCount,
        failed: failedCount,
      },
    })
  } catch (error) {
    console.error('상품 발행 실패:', error)
    return NextResponse.json(
      { success: false, error: '상품 발행에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/shop/publish
 *
 * Unpublish products from channels
 */
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    const { searchParams } = new URL(request.url)
    const publishIds = searchParams.get('ids')?.split(',').map(Number).filter(Boolean) || []

    if (publishIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 발행을 선택해주세요.' },
        { status: 400 }
      )
    }

    // Delete publish records that belong to user
    const deleteResult = await prisma.publishedProduct.deleteMany({
      where: {
        id: { in: publishIds },
        userId,
      },
    })

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count,
    })
  } catch (error) {
    console.error('발행 취소 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행 취소에 실패했습니다.' },
      { status: 500 }
    )
  }
}
