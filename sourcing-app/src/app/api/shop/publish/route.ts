import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus, ProductStatus, PublishType } from '@bandauto/db'
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

    // 전체 통계 계산 (탭과 무관하게 일정한 값)
    const allProductsWithPublish = await prisma.product.findMany({
      where: {
        userId,
        status: ProductStatus.COLLECTED,
      },
      select: {
        id: true,
        productPublishes: {
          where: {
            status: PublishStatus.SUCCESS,
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
          where: { status: PublishStatus.SUCCESS },
          select: {
            id: true,
            publishType: true,
            status: true,
            createdAt: true,
            retailBand: {
              select: {
                id: true,
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

      // 발행 유형별 분류
      const retailBandPublishes = product.productPublishes.filter(
        (pp) => pp.publishType === PublishType.RETAIL_BAND
      )
      const shoppingMallPublishes = product.productPublishes.filter(
        (pp) => pp.publishType === PublishType.SHOPPING_MALL
      )

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
        // 발행 상태 (유형별)
        publishStatus: {
          retailBand: hasRetailBand,
          shoppingMall: hasShoppingMall,
        },
        publishSummary,
        // 발행된 밴드 목록
        publishedBands: retailBandPublishes.map((pp) => ({
          publishId: pp.id,
          retailBandId: pp.retailBand?.id,
          retailBandName: pp.retailBand?.name,
          status: pp.status,
          createdAt: pp.createdAt,
        })),
        // 쇼핑몰 발행 상태
        shoppingMallPublish: shoppingMallPublishes[0]
          ? {
              publishId: shoppingMallPublishes[0].id,
              status: shoppingMallPublishes[0].status,
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
 * Publish products to shopping mall
 * Creates ProductPublish records with publishType = SHOPPING_MALL
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

    // Check existing shopping mall publishes to avoid duplicates
    const existingPublishes = await prisma.productPublish.findMany({
      where: {
        productId: { in: productIds },
        publishType: PublishType.SHOPPING_MALL,
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
          message: '이미 쇼핑몰에 발행된 상품입니다.',
        })
        continue
      }

      try {
        const publish = await prisma.productPublish.create({
          data: {
            userId,
            productId,
            publishType: PublishType.SHOPPING_MALL,
            // retailBandId is null for shopping mall
            status: PublishStatus.SUCCESS,
            publishedAt: new Date(),
          },
        })

        results.push({
          productId,
          status: 'SUCCESS',
          publishId: publish.id,
        })
      } catch (error: any) {
        console.error(`쇼핑몰 발행 실패 (product: ${productId}):`, error)
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
