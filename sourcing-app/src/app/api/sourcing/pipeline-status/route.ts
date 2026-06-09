export const dynamic = 'force-dynamic'

/**
 * GET /api/sourcing/pipeline-status
 *
 * 소싱 현황판 — 수집(CollectedPost) → AI가공(Product) → 발행(ChannelProduct/ShopProduct)
 * 진행 단계를 게시물 단위로 한눈에 조회한다. 이미 가공된(기존) 게시물도 모두 포함.
 *
 * Query:
 *  - page, limit (20/50/100)
 *  - search:    원본 제목 검색
 *  - channelId: 도매채널 필터
 *  - stage:     all | collected(미가공) | processed(가공완료·미발행) | published(발행완료)
 *  - startDate / endDate: 수집일 범위 (YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/** 활성 발행물(소매밴드 또는 쇼핑몰)을 가진 Product 조건 */
const PRODUCT_HAS_ACTIVE_PUBLISH = {
  OR: [
    { channelProducts: { some: { deletedAt: null } } },
    { shopProducts: { some: { deletedAt: null } } },
  ],
}

export async function GET(request: NextRequest) {
  try {
    const me = await getCurrentUser()
    if (!me) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const sp = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20')))
    const search = (sp.get('search') || '').trim()
    const channelId = sp.get('channelId') ? parseInt(sp.get('channelId')!) : null
    const stage = sp.get('stage') || 'all'
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')

    // 기본 where: 내 게시물 전체 (가공 여부 무관 — "기존 상품까지" 포함)
    const baseWhere: any = {
      userId: me.userId,
      deletedAt: null,
    }
    if (search) baseWhere.title = { contains: search }
    if (channelId) baseWhere.channelId = channelId
    if (startDate || endDate) {
      baseWhere.createdAt = {}
      if (startDate) baseWhere.createdAt.gte = new Date(`${startDate}T00:00:00+09:00`)
      if (endDate) baseWhere.createdAt.lte = new Date(`${endDate}T23:59:59+09:00`)
    }

    // 단계 필터 (deletedAt 있는 가공상품은 미가공으로 간주)
    const stageWhere: Record<string, any> = {
      collected: { products: { none: { deletedAt: null } } },
      processed: {
        AND: [
          { products: { some: { deletedAt: null } } },
          { products: { none: { deletedAt: null, ...PRODUCT_HAS_ACTIVE_PUBLISH } } },
        ],
      },
      published: {
        products: { some: { deletedAt: null, ...PRODUCT_HAS_ACTIVE_PUBLISH } },
      },
    }
    const where =
      stage in stageWhere ? { ...baseWhere, ...stageWhere[stage] } : baseWhere

    // 목록 + 단계별 요약 카운트 (요약은 검색/채널/기간 필터만 반영)
    const [posts, total, cntTotal, cntCollected, cntProcessed, cntPublished] = await Promise.all([
      prisma.collectedPost.findMany({
        where,
        select: {
          id: true,
          title: true,
          createdAt: true,
          externalId: true,
          channel: { select: { id: true, name: true, bandNo: true } },
          products: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              createdAt: true,
              isActive: true,
              channelProducts: {
                where: { deletedAt: null },
                select: {
                  publishedAt: true,
                  postKey: true,
                  channel: { select: { name: true } },
                },
              },
              shopProducts: {
                where: { deletedAt: null },
                select: {
                  publishedAt: true,
                  shop: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.collectedPost.count({ where }),
      prisma.collectedPost.count({ where: baseWhere }),
      prisma.collectedPost.count({ where: { ...baseWhere, ...stageWhere.collected } }),
      prisma.collectedPost.count({ where: { ...baseWhere, ...stageWhere.processed } }),
      prisma.collectedPost.count({ where: { ...baseWhere, ...stageWhere.published } }),
    ])

    const rows = posts.map((post) => {
      const product = post.products[0] ?? null
      const retailPublishes = product
        ? product.channelProducts.map((cp) => ({
            channelName: cp.channel?.name ?? '-',
            publishedAt: cp.publishedAt?.toISOString() ?? null,
            postKey: cp.postKey,
          }))
        : []
      const shopPublishes = product
        ? product.shopProducts.map((sps) => ({
            shopName: sps.shop?.name ?? '-',
            publishedAt: sps.publishedAt?.toISOString() ?? null,
          }))
        : []
      const stageValue = !product
        ? 'collected'
        : retailPublishes.length + shopPublishes.length > 0
          ? 'published'
          : 'processed'

      return {
        postId: post.id,
        title: post.title,
        collectedAt: post.createdAt.toISOString(),
        sourceChannel: { id: post.channel.id, name: post.channel.name },
        sourceUrl: post.channel.bandNo
          ? `https://band.us/band/${post.channel.bandNo}/post/${post.externalId}`
          : null,
        product: product
          ? {
              id: product.id,
              name: product.name,
              processedAt: product.createdAt.toISOString(),
              isActive: product.isActive,
            }
          : null,
        retailPublishes,
        shopPublishes,
        stage: stageValue,
      }
    })

    return NextResponse.json({
      success: true,
      data: rows,
      summary: {
        total: cntTotal,
        collected: cntCollected,
        processed: cntProcessed,
        published: cntPublished,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  } catch (error: any) {
    console.error('[PipelineStatus] 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message || '소싱 현황 조회 중 오류 발생' },
      { status: 500 }
    )
  }
}
