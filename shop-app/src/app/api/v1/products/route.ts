/**
 * GET /api/v1/products — 상품 목록 (STEP 4-3, scope: products:read)
 *
 * 쿼리:
 * - limit/offset: 페이지네이션 (기본 20, 최대 100)
 * - category: 카테고리 코드 (예: SEA, SEA_FISH — 대분류 코드는 하위 포함 prefix 매칭)
 * - status: active(기본) | soldout | all
 * - updated_after: ISO 날짜 — 증분 동기화용 (updatedAt 기준)
 * - sort: latest(기본) — best_7d/trending 은 Phase 5에서 추가 예정
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
    if (!['latest'].includes(sort)) {
      logApiCall(auth, req, 400)
      return apiError(400, 'INVALID_SORT', `지원하지 않는 sort 값입니다: ${sort}`)
    }

    const where = buildProductWhere(searchParams)

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
