export const dynamic = 'force-dynamic'

/**
 * POST /api/sourcing/cleanup/preview
 *
 * 수동 상품 삭제(소매밴드·쇼핑몰 발행물) 미리보기 — 조건에 맞는 후보를 상품 단위로 반환.
 * 실제 삭제는 /api/sourcing/cleanup/execute 가 사용자가 선택한 ID 만 수행한다.
 * (에이전트 자동삭제 cron 은 2026-05-04 사고로 비활성 — 이 메뉴가 수동 대체 경로)
 *
 * Body:
 *  - cutoffDate: string (YYYY-MM-DD) — 이 날짜 이전 발행분 대상
 *  - targets: { retail: boolean; shop: boolean }   기본 둘 다 true
 *  - categoryIds?: string[]   선택 카테고리만 (미지정 시 전체). 'NULL' = 미분류
 *  - excludeCom?: boolean     상시상품(COM) 제외 (기본 true)
 *  - channelIds?: number[]    소매밴드 채널 필터
 *  - includeMissingSource?: boolean  도매 원본 소실/품절로 비활성(Product.isActive=false)된
 *                                    상품은 기준일과 무관하게 포함 (기본 false)
 *  - limit?: number           상품 단위 최대 (기본 300, 최대 1000)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function POST(request: NextRequest) {
  try {
    const me = await getCurrentUser()
    if (!me) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const cutoffDateStr: string | undefined = body?.cutoffDate
    if (!cutoffDateStr) {
      return NextResponse.json({ success: false, error: 'cutoffDate (YYYY-MM-DD) 필수입니다.' }, { status: 400 })
    }
    const cutoffDate = new Date(`${cutoffDateStr}T23:59:59+09:00`)
    if (isNaN(cutoffDate.getTime())) {
      return NextResponse.json({ success: false, error: `유효하지 않은 날짜: ${cutoffDateStr}` }, { status: 400 })
    }

    const targets = {
      retail: body?.targets?.retail !== false,
      shop: body?.targets?.shop !== false,
    }
    const excludeCom = body?.excludeCom !== false // 기본 true — 상시상품 보호
    const categoryIds: string[] | undefined = Array.isArray(body?.categoryIds)
      ? body.categoryIds.filter((c: any) => typeof c === 'string')
      : undefined
    const channelIds: number[] | undefined = Array.isArray(body?.channelIds)
      ? body.channelIds.filter((id: any) => typeof id === 'number')
      : undefined
    const includeMissingSource = body?.includeMissingSource === true
    const limit = Math.min(1000, Math.max(1, body?.limit ?? 300))

    // 카테고리 where 조각 ('NULL' = 미분류 포함 선택)
    const categoryWhere = (() => {
      const conds: any[] = []
      if (categoryIds && categoryIds.length > 0) {
        const codes = categoryIds.filter((c) => c !== 'NULL')
        const withNull = categoryIds.includes('NULL')
        const or: any[] = []
        if (codes.length > 0) or.push({ categoryId: { in: codes } })
        if (withNull) or.push({ categoryId: null })
        if (or.length > 0) conds.push({ OR: or })
      }
      if (excludeCom) {
        conds.push({ OR: [{ categoryId: { not: 'COM' } }, { categoryId: null }] })
      }
      return conds
    })()

    // 상품 단위 조건:
    //  A) 기준일 이전 발행물을 가진 상품
    //  B) (옵션) 도매 원본 소실/품절 비활성 상품 — 기준일 무관
    const expiredPublishOr: any[] = []
    if (targets.retail) {
      expiredPublishOr.push({
        channelProducts: {
          some: {
            deletedAt: null,
            publishedAt: { not: null, lt: cutoffDate },
            ...(channelIds && channelIds.length > 0 ? { channelId: { in: channelIds } } : {}),
            channel: { is: { kind: 'RETAIL', isActive: true } },
          },
        },
      })
    }
    if (targets.shop) {
      expiredPublishOr.push({
        shopProducts: {
          some: {
            deletedAt: null,
            publishedAt: { not: null, lt: cutoffDate },
          },
        },
      })
    }

    const candidateOr: any[] = []
    if (expiredPublishOr.length > 0) candidateOr.push({ OR: expiredPublishOr })
    if (includeMissingSource) {
      // 모니터링(WholesaleWatch)이 원본 삭제/품절 감지 시 isActive=false 처리한 상품 —
      // 남아있는 활성 발행물이 있으면 기준일과 무관하게 후보에 포함
      candidateOr.push({
        isActive: false,
        OR: [
          { channelProducts: { some: { deletedAt: null } } },
          { shopProducts: { some: { deletedAt: null } } },
        ],
      })
    }
    if (candidateOr.length === 0) {
      return NextResponse.json({ success: false, error: '대상(소매밴드/쇼핑몰)을 하나 이상 선택하세요.' }, { status: 400 })
    }

    const where = {
      userId: me.userId,
      deletedAt: null,
      AND: [...categoryWhere, { OR: candidateOr }],
    }

    const [products, totalProducts] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          categoryId: true,
          isActive: true,
          channelProducts: {
            where: {
              deletedAt: null,
              ...(channelIds && channelIds.length > 0 ? { channelId: { in: channelIds } } : {}),
              channel: { is: { kind: 'RETAIL' } },
            },
            select: {
              id: true,
              publishedAt: true,
              postKey: true,
              channel: { select: { id: true, name: true } },
            },
          },
          shopProducts: {
            where: { deletedAt: null },
            select: {
              id: true,
              publishedAt: true,
              shop: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
        take: limit,
      }),
      prisma.product.count({ where }),
    ])

    const rows = products.map((p) => {
      const missingSource = includeMissingSource && !p.isActive
      return {
        productId: p.id,
        name: p.name,
        categoryId: p.categoryId,
        reason: missingSource ? 'missing_source' : 'expired',
        retailPublishes: p.channelProducts
          // 사유가 기간 만료면 기준일 이전 발행분만, 원본 소실이면 전체 발행분 표시
          .filter((cp) => missingSource || (cp.publishedAt && cp.publishedAt < cutoffDate))
          .map((cp) => ({
            channelProductId: cp.id,
            channelId: cp.channel?.id,
            channelName: cp.channel?.name ?? '-',
            publishedAt: cp.publishedAt?.toISOString() ?? null,
            hasBandPost: !!cp.postKey,
          })),
        shopPublishes: p.shopProducts
          .filter((sps) => missingSource || (sps.publishedAt && sps.publishedAt < cutoffDate))
          .map((sps) => ({
            shopProductId: sps.id,
            shopName: sps.shop?.name ?? '-',
            publishedAt: sps.publishedAt?.toISOString() ?? null,
          })),
      }
    })
    // 필터 결과 발행물이 하나도 안 남은 상품은 제외
    const filtered = rows.filter((r) => r.retailPublishes.length > 0 || r.shopPublishes.length > 0)

    return NextResponse.json({
      success: true,
      data: filtered,
      summary: {
        productCount: filtered.length,
        totalMatched: totalProducts,
        truncated: totalProducts > limit,
        retailPublishCount: filtered.reduce((s, r) => s + r.retailPublishes.length, 0),
        shopPublishCount: filtered.reduce((s, r) => s + r.shopPublishes.length, 0),
        bandPostCount: filtered.reduce(
          (s, r) => s + r.retailPublishes.filter((rp) => rp.hasBandPost).length,
          0
        ),
      },
      conditions: { cutoffDate: cutoffDateStr, targets, excludeCom, categoryIds, channelIds, includeMissingSource },
    })
  } catch (error: any) {
    console.error('[cleanup/preview] 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '미리보기 중 오류 발생' },
      { status: 500 }
    )
  }
}
