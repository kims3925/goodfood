/**
 * POST /api/admin/analytics/aggregate-sales — 판매 집계 수동 트리거 (STEP 5-1)
 * body: { days?: number }  (기본 2 = 어제+오늘, 최대 90 — 초기 백필용)
 *
 * GET /api/admin/analytics/aggregate-sales — 판매 스코어 상위 50 (소싱 의사결정 대시보드용)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { aggregateRecentSales, getSalesScores } from '@/modules/analytics/sales-aggregator.service'

async function requireAdmin() {
  const me = await getCurrentUser()
  if (!me) {
    return { error: NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 }) }
  }
  if (me.role !== 'ADMIN') {
    return { error: NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 }) }
  }
  return { me }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  let days = 2
  try {
    const body = await request.json()
    if (Number.isFinite(Number(body?.days))) {
      days = Math.max(1, Math.min(90, Math.floor(Number(body.days))))
    }
  } catch {
    // body 없으면 기본값
  }

  try {
    const result = await aggregateRecentSales(days)
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[Aggregate Sales]', error)
    return NextResponse.json({ success: false, error: error?.message || '집계 실패' }, { status: 500 })
  }
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const scores = await getSalesScores({ limit: 50 })
    // 상품/카테고리 정보 합성 (어떤 카테고리를 더 소싱할지 의사결정 데이터)
    const products = await prisma.product.findMany({
      where: { id: { in: scores.map((s) => s.productId) } },
      select: { id: true, name: true, categoryId: true, channel: { select: { name: true } } },
    })
    const byId = new Map(products.map((p) => [p.id, p]))

    return NextResponse.json({
      success: true,
      data: scores.map((s) => ({
        ...s,
        name: byId.get(s.productId)?.name ?? null,
        categoryId: byId.get(s.productId)?.categoryId ?? null,
        sourceChannel: byId.get(s.productId)?.channel?.name ?? null,
      })),
    })
  } catch (error: any) {
    console.error('[Sales Scores]', error)
    return NextResponse.json({ success: false, error: '스코어 조회 실패' }, { status: 500 })
  }
}
