import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus, ProductStatus, PublishChannelType } from '@bandauto/db'
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
    const status = searchParams.get('status') || 'COLLECTED' // 기본: COLLECTED 상품만

    // Build where clause
    const where: any = {
      userId,
    }

    // 상태 필터 (COLLECTED가 기본, ARCHIVED 제외)
    if (status !== 'ALL') {
      where.status = status as ProductStatus
    } else {
      // ALL이어도 ARCHIVED는 제외
      where.status = ProductStatus.COLLECTED
    }

    // 검색
    if (search) {
      where.name = { contains: search }
    }

    // Get total count
    const total = await prisma.product.count({ where })

    // Get products with publish info
    const products = await prisma.product.findMany({
      where,
      include: {
        post: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
            wholesaleBand: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        variants: {
          orderBy: { id: 'asc' },
          take: 1,
        },
        productPublishes: {
          include: {
            retailBand: {
              select: {
                id: true,
                name: true,
              },
            },
            publishChannel: {
              select: {
                id: true,
                type: true,
                name: true,
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
      const mainImage = product.post?.images?.[0]?.imageUrl || product.thumbnailUrl
      const mainVariant = product.variants?.[0]

      // 발행처별 상태 계산
      const successPublishes = product.productPublishes.filter((pp) => pp.status === PublishStatus.SUCCESS)
      const retailBandPublishes = successPublishes.filter((pp) => pp.publishChannel?.type === PublishChannelType.RETAIL_BAND)
      const shoppingMallPublishes = successPublishes.filter((pp) => pp.publishChannel?.type === PublishChannelType.SHOPPING_MALL)

      // 발행 현황 계산
      const hasRetailBand = retailBandPublishes.length > 0
      const hasShoppingMall = shoppingMallPublishes.length > 0
      let publishSummary = '미발행'
      if (hasRetailBand && hasShoppingMall) {
        publishSummary = '발행완료'
      } else if (hasRetailBand || hasShoppingMall) {
        publishSummary = '부분발행'
      }

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        thumbnailUrl: mainImage,
        price: mainVariant?.price || product.price,
        wholesalePrice: mainVariant?.wholesalePrice || product.wholesalePrice,
        stock: mainVariant?.stock || 0,
        status: product.status,
        wholesaleBand: product.post?.wholesaleBand,
        // 발행 상태 (채널별)
        publishStatus: {
          retailBand: hasRetailBand,
          shoppingMall: hasShoppingMall,
        },
        publishSummary,
        // 기존 호환용
        publishedBands: retailBandPublishes.map((pp) => ({
          publishId: pp.id,
          retailBandId: pp.retailBand?.id,
          retailBandName: pp.retailBand?.name,
          channelType: pp.publishChannel?.type,
          channelName: pp.publishChannel?.name,
          status: pp.status,
          createdAt: pp.createdAt,
        })),
        // 쇼핑몰 발행 상태
        shoppingMallPublish: shoppingMallPublishes[0] ? {
          publishId: shoppingMallPublishes[0].id,
          channelName: shoppingMallPublishes[0].publishChannel?.name,
          status: shoppingMallPublishes[0].status,
          createdAt: shoppingMallPublishes[0].createdAt,
        } : null,
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
 * Publish products to retail bands
 * Creates ProductPublish records for each product-band combination
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
    const { productIds } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '발행할 상품을 선택해주세요.' },
        { status: 400 }
      )
    }

    // Validate products belong to user and are COLLECTED
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        userId,
        status: ProductStatus.COLLECTED,
      },
    })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { success: false, error: '일부 상품을 찾을 수 없거나 수집 상태가 아닙니다.' },
        { status: 400 }
      )
    }

    // 쇼핑몰 발행 채널 조회 또는 생성
    let shoppingMallChannel = await prisma.publishChannel.findFirst({
      where: {
        userId,
        type: PublishChannelType.SHOPPING_MALL,
      },
    })

    if (!shoppingMallChannel) {
      shoppingMallChannel = await prisma.publishChannel.create({
        data: {
          userId,
          type: PublishChannelType.SHOPPING_MALL,
          name: '쇼핑몰',
        },
      })
    }

    // Check existing publishes to avoid duplicates
    const existingPublishes = await prisma.productPublish.findMany({
      where: {
        productId: { in: productIds },
        publishChannelId: shoppingMallChannel.id,
      },
      select: {
        productId: true,
        publishChannelId: true,
      },
    })

    const existingSet = new Set(
      existingPublishes.map((p) => `${p.productId}-${p.publishChannelId}`)
    )

    // Create publish records
    const results: {
      productId: number
      publishChannelId: number
      status: 'SUCCESS' | 'SKIPPED' | 'FAILED'
      publishId?: number
      message?: string
    }[] = []

    for (const productId of productIds) {
      const key = `${productId}-${shoppingMallChannel.id}`

      if (existingSet.has(key)) {
        results.push({
          productId,
          publishChannelId: shoppingMallChannel.id,
          status: 'SKIPPED',
          message: '이미 쇼핑몰에 발행된 상품입니다.',
        })
        continue
      }

      try {
        const publish = await prisma.productPublish.create({
          data: {
            userId,
            productId,
            publishChannelId: shoppingMallChannel.id,
            status: PublishStatus.SUCCESS,
          },
        })

        results.push({
          productId,
          publishChannelId: shoppingMallChannel.id,
          status: 'SUCCESS',
          publishId: publish.id,
        })
      } catch (error: any) {
        console.error(`쇼핑몰 발행 실패 (product: ${productId}):`, error)
        results.push({
          productId,
          publishChannelId: shoppingMallChannel.id,
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
 * Unpublish products from retail bands
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
    const deleteResult = await prisma.productPublish.deleteMany({
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
