/**
 * POST /api/admin/agents/product-manager/expire-content
 *
 * ProductManagerAgent.runContentExpiry 즉시 실행 엔드포인트 (cron 03:00 외 수동 트리거).
 *
 * 규칙:
 *  - 일반 카테고리: publishedAt이 7일 초과한 ChannelProduct/ShopProduct 정리
 *  - COM(상시상품): publishedAt이 30일 초과 시 정리
 *  - ChannelProduct: DB soft-delete + Playwright Band 게시글 실제 삭제 (best-effort)
 *  - ShopProduct: DB soft-delete
 *
 * Body:
 *  - dryRun?: boolean         (기본 false). true면 DB 변경 없이 카운트만 반환
 *  - limit?: number           (기본 100, 최대 500). Playwright 호출 1건당 ~10-15초이므로
 *                              limit=100이면 최악의 경우 약 25분. 너무 크게 잡지 말 것.
 *  - skipPlaywright?: boolean (기본 false). true면 DB만 정리, Band 게시글은 그대로 둠.
 *                              백필/마이그레이션 또는 Playwright 점검 시 사용.
 *
 * 응답: 정리 결과 요약 (cutoffDays / channelProducts / shopProducts / bandPosts / errors)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { productManagerAgent } from '@/modules/agents/implementations/ProductManagerAgent'

export const dynamic = 'force-dynamic'
// Playwright Band 삭제는 1건당 ~10-15초. limit=100이면 최악 25분.
// nginx 600s를 넘기지 않게 limit로 자제하는 책임은 호출자에 있음.
export const maxDuration = 300 // Vercel Hobby 한도 300s

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const dryRun = body?.dryRun === true
    const skipPlaywright = body?.skipPlaywright === true
    const limit =
      typeof body?.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 500) : 100

    const summary = await productManagerAgent.runContentExpiry({ dryRun, limit, skipPlaywright })

    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    console.error('[expire-content] 오류:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '실행 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
