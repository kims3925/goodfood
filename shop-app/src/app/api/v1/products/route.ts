/**
 * GET /api/v1/products — 상품 목록 (STEP 4-3 + STEP 5-2, scope: products:read)
 *
 * 쿼리:
 * - limit/offset: 페이지네이션 (기본 20, 최대 100)
 * - category: 카테고리 코드 (예: SEA, SEA_FISH — 대분류 코드는 하위 포함 prefix 매칭)
 * - status: active(기본) | soldout | all
 * - updated_after: ISO 날짜 — 증분 동기화용 (updatedAt 기준)
 * - sort: latest(기본) | best_7d(7일 판매량) | trending(3일 급상승)
 *   — 판매량 데이터는 일배치(ProductSalesDaily) 기반. "이걸 가져다 팔아라" 시그널.
 *
 * 응답: { data: [...], pagination: { limit, offset, total } } — 카페24 스타일.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { authenticateApiRequest, logApiCall, parsePagination, apiError } from '@/lib/openapi/auth'
import { buildProductWhere, formatProductSummary } from '@/lib/openapi/products'

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'products:read')
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const { limit, offset } = parsePagination(req)

    const sort = searchParams.get('sort') || 'latest'
    if (!['latest', 'best_7d', 'trending'].includes(sort)) {
      logApiCall(auth, req, 400)
      return apiError(400, 'INVALID_SORT', `지원하지 않는 sort 값입니다: ${sort}`)
    }

    const where = buildProductWhere(searchParams)

    if (sort === 'best_7d' || sort === 'trending') {
      // 판매량 기반 랭킹 (STEP 5-2) — ProductSalesDaily 일배치 집계 기반
      const windowDays = sort === 'best_7d' ? 7 : 3
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
      const ranked = await prisma.productSalesDaily.groupBy({
        by: ['productId'],
        where: { date: { gte: since } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 500,
      })
      const rankedIds = ranked.map((r) => r.productId)

      // where 조건과 교집합 (노출 범위/카테고리/상태 필터 유지)
      const matching = rankedIds.length
        ? await prisma.product.findMany({
            where: { ...where, id: { in: rankedIds } },
            select: { id: true },
          })
        : []
      const matchingSet = new Set(matching.map((p) => p.id))
      const orderedIds = rankedIds.filter((id) => matchingSet.has(id))
      const pageIds = orderedIds.slice(offset, offset + limit)

      const products = pageIds.length
        ? await prisma.product.findMany({ where: { id: { in: pageIds } } })
        : []
      const productById = new Map(products.map((p) => [p.id, p]))
      const qtyById = new Map(ranked.map((r) => [r.productId, r._sum.qty ?? 0]))

      const res = NextResponse.json({
        data: pageIds
          .map((id) => productById.get(id))
          .filter(Boolean)
          .map((p: any) => ({
            ...formatProductSummary(p),
            sales_qty_window: qtyById.get(p.id) ?? 0,
            sort_window_days: windowDays,
          })),
        pagination: { limit, offset, total: orderedIds.length },
      })
      logApiCall(auth, req, 200)
      return res
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: offset,
        take: limit,
      }),
    ])

    const res = NextResponse.json({
      data: products.map(formatProductSummary),
      pagination: { limit, offset, total },
    })
    logApiCall(auth, req, 200)
    return res
  } catch (error: any) {
    console.error('[OpenAPI products]', error)
    logApiCall(auth, req, 500)
    return apiError(500, 'INTERNAL_ERROR', '상품 목록 조회에 실패했습니다.')
  }
}
