export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { publishService } from '@/modules/publish'
import { bandPlaywrightService } from '@/modules/band-playwright/band-playwright.service'
import { NaverBandClient } from '@/modules/sourcing/domain/src/channel'

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
    const channelId = searchParams.get('channelId')

    // Build where clause
    const where: any = {
      userId,
    }

    // 검색
    if (search) {
      where.name = { contains: search }
    }

    // 도매밴드 필터 (상품의 채널 기준)
    if (channelId) {
      where.channelId = parseInt(channelId)
    }

    // Get total count
    const total = await prisma.product.count({ where })

    // 통계 계산 (탭과 무관하게 일정한 값)
    const allProducts = await prisma.product.findMany({
      where: { userId },
      select: {
        id: true,
        shopProducts: {
          select: {
            id: true,
            shopId: true,
            shop: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        channelProducts: {
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
    let shopPublishedCount = 0
    let retailBandPublishedCount = 0

    for (const product of allProducts) {
      // Shop 발행: shopProducts가 있는 경우
      const hasShopPublish = product.shopProducts.length > 0
      // 채널 발행: channelProducts가 있는 경우
      const hasChannelPublish = product.channelProducts.length > 0

      if (hasShopPublish) shopPublishedCount++
      if (hasChannelPublish) retailBandPublishedCount++
    }

    const stats = {
      total: totalCount,
      published: shopPublishedCount,
      unpublished: totalCount - shopPublishedCount,
      retailBandPublished: retailBandPublishedCount,
      retailBandUnpublished: totalCount - retailBandPublishedCount,
    }

    // Get products with publish info
    const products = await prisma.product.findMany({
      where,
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
        variants: {
          orderBy: { id: 'asc' },
          take: 1,
        },
        shopProducts: {
          select: {
            id: true,
            shopId: true,
            createdAt: true,
            shop: {
              select: {
                id: true,
                name: true,
                subdomain: true,
              },
            },
          },
        },
        channelProducts: {
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
      // - channelProducts: 채널 발행 (매트릭스 UI에서 사용)
      // - shopProducts: Shop 발행
      const channelPublishes = product.channelProducts
      const shopPublishes = product.shopProducts

      const hasChannelPublish = channelPublishes.length > 0
      const hasShopPublish = shopPublishes.length > 0

      let publishSummary = '미발행'
      if (hasChannelPublish && hasShopPublish) {
        publishSummary = '발행완료'
      } else if (hasChannelPublish || hasShopPublish) {
        publishSummary = '부분발행'
      }

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        thumbnailUrl: mainImage,
        price: mainVariant?.price || 0,
        wholesalePrice: mainVariant?.wholesalePrice || null,
        channel: product.channel,
        // 발행 상태 (유형별)
        publishStatus: {
          retailBand: hasChannelPublish, // 하위 호환성
          channel: hasChannelPublish,
          shop: hasShopPublish,
        },
        publishSummary,
        // 발행된 채널 목록
        publishedChannels: channelPublishes.map((cp) => ({
          publishId: cp.id,
          channelId: cp.channelId,
          channelName: cp.channel?.name,
          status: 'SUCCESS',
          createdAt: cp.createdAt,
        })),
        // 발행된 Shop 목록
        publishedShops: shopPublishes.map((sp) => ({
          publishId: sp.id,
          shopId: sp.shopId,
          shopName: sp.shop?.name,
          subdomain: sp.shop?.subdomain,
          status: 'SUCCESS',
          createdAt: sp.createdAt,
        })),
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
 * Publish products to a selected channel or shop
 * Either channelId or shopId is required
 *
 * PublishService를 사용하여 발행을 수행합니다.
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
    const { productIds, channelId, shopId } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '발행할 상품을 선택해주세요.' },
        { status: 400 }
      )
    }

    if (!channelId && !shopId) {
      return NextResponse.json(
        { success: false, error: '발행할 채널 또는 Shop을 선택해주세요.' },
        { status: 400 }
      )
    }

    // Shop 발행
    if (shopId) {
      const shop = await prisma.shop.findFirst({
        where: {
          id: shopId,
          userId,
          isActive: true,
        },
        select: { id: true, name: true, subdomain: true },
      })

      if (!shop) {
        return NextResponse.json(
          { success: false, error: '선택한 Shop을 찾을 수 없거나 발행 권한이 없습니다.' },
          { status: 400 }
        )
      }

      // PublishService를 사용하여 Shop 배치 발행 수행
      const batchResult = await publishService.publishShopBatch({
        userId,
        productIds,
        shopId: shop.id,
      })

      // 결과 변환
      const results = batchResult.results.map((r) => ({
        productId: r.productId,
        status: r.success ? (r.skipped ? 'SKIPPED' : 'SUCCESS') : 'FAILED',
        publishId: r.publishedProductId,
        message: r.skipped ? r.skipReason : r.error,
      }))

      return NextResponse.json({
        success: batchResult.success,
        message: `${batchResult.successCount}개 발행 완료, ${batchResult.skippedCount}개 건너뜀, ${batchResult.failedCount}개 실패`,
        shop: {
          id: shop.id,
          name: shop.name,
          subdomain: shop.subdomain,
        },
        results,
        summary: {
          total: batchResult.total,
          success: batchResult.successCount,
          skipped: batchResult.skippedCount,
          failed: batchResult.failedCount,
        },
      })
    }

    // 채널 발행
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
 * Unpublish products from channels or shops
 * 주문이나 문의가 있는 발행 상품은 삭제 불가 (리뷰는 제외)
 * 채널(소매밴드) 발행의 경우 Band에서도 게시물 삭제
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
    const publishType = searchParams.get('type') as 'shop' | 'channel' | null // 'shop' 또는 'channel'

    if (publishIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 발행을 선택해주세요.' },
        { status: 400 }
      )
    }

    // Shop 발행 삭제
    if (publishType === 'shop') {
      // ShopProduct 조회 (주문, 문의 카운트 포함)
      const shopProducts = await prisma.shopProduct.findMany({
        where: {
          id: { in: publishIds },
          userId,
        },
        include: {
          product: {
            select: { name: true },
          },
          _count: {
            select: {
              orderItems: true,
              inquiries: true,
            },
          },
        },
      })

      // 삭제 불가한 발행 상품 확인
      const cannotDelete: { id: number; name: string; reason: string }[] = []
      const canDeleteIds: number[] = []

      for (const sp of shopProducts) {
        const hasOrders = sp._count.orderItems > 0
        const hasInquiries = sp._count.inquiries > 0

        if (hasOrders || hasInquiries) {
          const reasons: string[] = []
          if (hasOrders) reasons.push(`주문 ${sp._count.orderItems}건`)
          if (hasInquiries) reasons.push(`문의 ${sp._count.inquiries}건`)
          cannotDelete.push({
            id: sp.id,
            name: sp.product?.name || 'Unknown',
            reason: reasons.join(', '),
          })
        } else {
          canDeleteIds.push(sp.id)
        }
      }

      // 삭제 불가한 상품이 있는 경우
      if (cannotDelete.length > 0 && canDeleteIds.length === 0) {
        return NextResponse.json({
          success: false,
          error: '발행을 취소할 수 없습니다.',
          reason: '주문 또는 문의가 존재하는 상품은 발행을 취소할 수 없습니다.',
          cannotDelete,
        }, { status: 400 })
      }

      // Shop 발행 삭제 (DB만)
      let deletedCount = 0
      if (canDeleteIds.length > 0) {
        const deleteResult = await prisma.shopProduct.deleteMany({
          where: {
            id: { in: canDeleteIds },
            userId,
          },
        })
        deletedCount = deleteResult.count
      }

      return NextResponse.json({
        success: true,
        deletedCount,
        cannotDelete: cannotDelete.length > 0 ? cannotDelete : undefined,
        message: cannotDelete.length > 0
          ? `${deletedCount}개 발행 취소 완료, ${cannotDelete.length}개는 주문/문의가 있어 취소 불가`
          : `${deletedCount}개 발행 취소 완료`,
      })
    }

    // Channel 발행 삭제 (기본값 또는 type=channel)
    // ChannelProduct는 orderItems, inquiries 관계가 없으므로 제약 없이 삭제 가능
    const channelProducts = await prisma.channelProduct.findMany({
      where: {
        id: { in: publishIds },
        userId,
      },
      include: {
        product: {
          select: { name: true },
        },
        channel: {
          select: {
            id: true,
            channelKey: true,
            name: true,
          },
        },
      },
    })

    // 삭제 가능한 상품 처리
    let deletedCount = 0
    const bandDeleteErrors: string[] = []
    const successfulDeletes: number[] = []

    for (const cp of channelProducts) {
      console.log(`[Unpublish] 채널 발행 취소 처리: productId=${cp.productId}, channelId=${cp.channelId}`)

      // ChannelProduct에는 postKey가 없으므로, Band 삭제 로직은 별도 처리가 필요
      // 현재는 DB만 삭제
      successfulDeletes.push(cp.id)
    }

    // DB에서 레코드 삭제
    if (successfulDeletes.length > 0) {
      const deleteResult = await prisma.channelProduct.deleteMany({
        where: {
          id: { in: successfulDeletes },
          userId,
        },
      })
      deletedCount = deleteResult.count
    }

    // Band 삭제 실패가 있으면 실패로 처리
    const hasErrors = bandDeleteErrors.length > 0
    const allFailed = deletedCount === 0 && hasErrors

    return NextResponse.json({
      success: !allFailed,
      deletedCount,
      bandDeleteErrors: bandDeleteErrors.length > 0 ? bandDeleteErrors : undefined,
      message: allFailed
        ? '발행 취소 실패: 밴드 게시물을 삭제할 수 없습니다.'
        : hasErrors
        ? `${deletedCount}개 발행 취소 완료, ${bandDeleteErrors.length}개 밴드 삭제 실패`
        : `${deletedCount}개 발행 취소 완료`,
    })
  } catch (error) {
    console.error('발행 취소 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행 취소에 실패했습니다.' },
      { status: 500 }
    )
  }
}
