/**
 * POST /api/admin/agents/product-manager/expire-content
 *
 * ProductManagerAgent.runContentExpiry 즉시 실행 엔드포인트 (cron 03:00 외 수동 트리거).
 *
 * 규칙:
 *  - 일반 카테고리: publishedAt이 7일 초과한 ChannelProduct/ShopProduct 소프트 삭제
 *  - COM(상시상품): publishedAt이 30일 초과 시 소프트 삭제
 *
 * Body:
 *  - dryRun?: boolean (기본 false). true면 DB 변경 없이 카운트만 반환
 *  - limit?: number  (기본 1000). 한 번에 처리 최대 레코드 수
 *
 * 응답: 정리 결과 요약 (cutoffDays / channelProducts / shopProducts / errors)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { productManagerAgent } from '@/modules/agents/implementations/ProductManagerAgent'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const dryRun = body?.dryRun === true
    const limit =
      typeof body?.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 5000) : 1000

    const summary = await productManagerAgent.runContentExpiry({ dryRun, limit })

    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    console.error('[expire-content] 오류:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '실행 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
