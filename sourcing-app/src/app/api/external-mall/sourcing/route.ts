/**
 * POST /api/external-mall/sourcing
 * 외부몰 → Product 일괄 소싱.
 *
 * body: {
 *   connectionId: number,
 *   productIds?: string[],   // 특정 상품만
 *   maxProducts?: number,
 *   minPrice?, maxPrice?,
 *   defaultMargin?: number,  // 시나리오 B 마진 (%)
 * }
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 90

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { MallSourcingService } from '@/modules/external-mall/sourcing/mall-sourcing.service'

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const connectionId = Number(body?.connectionId)
  if (!Number.isFinite(connectionId)) {
    return NextResponse.json({ success: false, error: 'connectionId 필수' }, { status: 400 })
  }

  const service = new MallSourcingService()
  try {
    const result = await service.sourceBatch({
      connectionId,
      userId: me.userId,
      productIds: Array.isArray(body?.productIds) ? body.productIds.map(String) : undefined,
      maxProducts: body?.maxProducts ? Number(body.maxProducts) : undefined,
      minPrice: body?.minPrice ? Number(body.minPrice) : undefined,
      maxPrice: body?.maxPrice ? Number(body.maxPrice) : undefined,
      defaultMargin: body?.defaultMargin ? Number(body.defaultMargin) : undefined,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[external-mall/sourcing]', err)
    return NextResponse.json(
      { success: false, error: err?.message || '소싱 실패' },
      { status: 500 }
    )
  }
}
