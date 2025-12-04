import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind, ChannelPlatform } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { publishService } from '@/modules/publish'

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

    // 통계 계산 (탭과 무관하게 일정한 값)
    const allProducts = await prisma.product.findMany({
      where: { userId },
      select: {
        id: true,
        publishedProducts: {
          select: {
            id: true,
            channelId: true,
            channel: {
              select: {
                kind: true,
                platform: true,
              },
            },
          },
        },
      },
    })

    let totalCount = allProducts.length
    let shoppingMallPublishedCount = 0
    let retailBandPublishedCount = 0

    for (const product of allProducts) {
      // 쇼핑몰 발행: channelId가 없거나 SHOP 플랫폼 채널에 발행된 경우
      const hasShoppingMall = product.publishedProducts.some(
        (pp) => pp.channelId === null || pp.channel?.platform === ChannelPlatform.SHOP
      )
      // 채널 발행: channelId가 있는 모든 발행 (채널 삭제되어도 카운트)
      const hasChannelPublish = product.publishedProducts.some(
        (pp) => pp.channelId !== null
      )

      if (hasShoppingMall) shoppingMallPublishedCount++
      if (hasChannelPublish) retailBandPublishedCount++
    }

    const stats = {
      total: totalCount,
      published: shoppingMallPublishedCount,
      unpublished: totalCount - shoppingMallPublishedCount,
      retailBandPublished: retailBandPublishedCount,
      retailBandUnpublished: totalCount - retailBandPublishedCount,
    }

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
      const mainImage = product.thumbnailUrl
      const mainVariant = product.variants?.[0]

      // 발행 유형별 분류:
      // - channelPublishes: 모든 채널 발행 (매트릭스 UI에서 사용, SHOP 포함)
      // - shoppingMallPublishes: 쇼핑몰 발행 (레거시 null 또는 SHOP 플랫폼)
      const channelPublishes = product.publishedProducts.filter(
        (pp) => pp.channelId !== null
      )
      const shoppingMallPublishes = product.publishedProducts.filter(
        (pp) => pp.channelId === null || pp.channel?.platform === ChannelPlatform.SHOP
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
        price: mainVariant?.price || 0,
        wholesalePrice: mainVariant?.wholesalePrice || null,
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
          channelId: pp.channelId,
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
      stats,
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
 *
 * PublishService를 사용하여 실제 Band API 발행을 수행합니다.
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

    // PublishService를 사용하여 배치 발행 수행
    const batchResult = await publishService.publishBatch({
      userId,
      productIds,
      channelId: channel.id,
    })

    // 결과 변환
    const results = batchResult.results.map((r) => ({
      productId: r.productId,
      status: r.success ? (r.skipped ? 'SKIPPED' : 'SUCCESS') : 'FAILED',
      publishId: r.publishedProductId,
      postKey: r.postKey,
      message: r.skipped ? r.skipReason : r.error,
    }))

    return NextResponse.json({
      success: batchResult.success,
      message: `${batchResult.successCount}개 발행 완료, ${batchResult.skippedCount}개 건너뜀, ${batchResult.failedCount}개 실패`,
      channel: {
        id: channel.id,
        name: channel.name,
        platform: channel.platform,
      },
      results,
      summary: {
        total: batchResult.total,
        success: batchResult.successCount,
        skipped: batchResult.skippedCount,
        failed: batchResult.failedCount,
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
