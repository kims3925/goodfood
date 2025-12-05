import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 발행상품 목록 조회 (Product 기준 그룹핑)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const channelId = searchParams.get('channelId')
    const sourcePlatform = searchParams.get('sourcePlatform')
    const onlyShoppingMall = searchParams.get('onlyShoppingMall') === 'true'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Product 기준 조건 생성
    const where: any = {
      userId: currentUser.userId,
      publishedProducts: { some: {} }, // 발행 레코드가 있는 상품만
    }

    // 상품명 검색
    if (search) {
      where.name = { contains: search }
    }

    // publishedProducts 필터 조건
    const publishedProductsFilter: any = {}

    // 발행 채널 플랫폼 필터 (쇼핑몰, Band 등)
    if (onlyShoppingMall) {
      // 쇼핑몰 필터: channelId가 null인 상품만
      publishedProductsFilter.channelId = null
    } else if (sourcePlatform) {
      // Band 등 다른 플랫폼 필터: 해당 플랫폼에 발행된 상품
      publishedProductsFilter.channel = {
        is: {
          platform: sourcePlatform,
        },
      }
    } else if (channelId) {
      // 특정 채널 필터: 해당 채널에 발행된 상품
      publishedProductsFilter.channelId = parseInt(channelId)
    }

    // 날짜 필터: 해당 날짜에 발행된 상품
    if (startDate || endDate) {
      publishedProductsFilter.createdAt = {}
      if (startDate) {
        publishedProductsFilter.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        publishedProductsFilter.createdAt.lte = end
      }
    }

    // publishedProducts 필터가 있으면 적용
    if (Object.keys(publishedProductsFilter).length > 0) {
      where.publishedProducts = { some: publishedProductsFilter }
    }

    console.log('Published Product API - onlyShoppingMall:', onlyShoppingMall)
    console.log('Published Product API - publishedProductsFilter:', JSON.stringify(publishedProductsFilter, null, 2))
    console.log('Published Product API - where:', JSON.stringify(where, null, 2))
    console.log('Published Product API - page:', page, 'limit:', limit, 'skip:', skip)

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          collectedProduct: {
            select: {
              post: {
                select: {
                  channel: {
                    select: {
                      id: true,
                      name: true,
                      platform: true,
                    },
                  },
                },
              },
            },
          },
          publishedProducts: {
            include: {
              channel: {
                select: {
                  id: true,
                  name: true,
                  coverUrl: true,
                  platform: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ])

    // 응답 데이터 변환
    const data = products.map((product) => ({
      productId: product.id,
      product: {
        id: product.id,
        name: product.name,
        thumbnailUrl: product.thumbnailUrl,
        collectedProduct: product.collectedProduct,
      },
      publishedChannels: product.publishedProducts.map((pp) => ({
        publishId: pp.id,
        channelId: pp.channelId,
        channelName: pp.channel?.name || null,
        channelCoverUrl: pp.channel?.coverUrl || null,
        platform: pp.channel?.platform || null,
        publishedAt: pp.publishedAt,
        createdAt: pp.createdAt,
        updatedAt: pp.updatedAt,
      })),
      latestPublishedAt: product.publishedProducts[0]?.publishedAt || product.publishedProducts[0]?.createdAt,
      createdAt: product.createdAt,
    }))

    console.log('Published Product API - total:', total, 'data.length:', data.length)

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      limit,
    })
  } catch (error) {
    console.error('발행상품 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행상품 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 발행상품 삭제
// 주문이나 문의가 있는 발행 상품은 삭제 불가 (리뷰는 제외)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')

    if (!idParam) {
      return NextResponse.json(
        { success: false, error: 'id가 필요합니다.' },
        { status: 400 }
      )
    }

    const id = parseInt(idParam, 10)
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 id입니다.' },
        { status: 400 }
      )
    }

    // 발행상품 확인 (주문, 문의 카운트 포함)
    const publishedProduct = await prisma.publishedProduct.findFirst({
      where: { id, userId: currentUser.userId },
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

    if (!publishedProduct) {
      return NextResponse.json(
        { success: false, error: '발행상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 주문 또는 문의가 있는지 확인
    const hasOrders = publishedProduct._count.orderItems > 0
    const hasInquiries = publishedProduct._count.inquiries > 0

    if (hasOrders || hasInquiries) {
      const reasons: string[] = []
      if (hasOrders) reasons.push(`주문 ${publishedProduct._count.orderItems}건`)
      if (hasInquiries) reasons.push(`문의 ${publishedProduct._count.inquiries}건`)

      return NextResponse.json({
        success: false,
        error: '발행상품을 삭제할 수 없습니다.',
        reason: `${reasons.join(', ')}이 존재하는 상품은 삭제할 수 없습니다.`,
        details: {
          productName: publishedProduct.product.name,
          orderCount: publishedProduct._count.orderItems,
          inquiryCount: publishedProduct._count.inquiries,
        },
      }, { status: 400 })
    }

    await prisma.publishedProduct.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('발행상품 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '발행상품 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
