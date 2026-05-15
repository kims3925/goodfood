export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/publish-watchdog/status
 *
 * Phase 2 — 발행 헬스 워치독 상태 조회.
 * 현재 로그인 사용자의 최근 1시간 발행 실패율을 평가하여 반환.
 *
 * 응답:
 *   { success, data: PublishHealth }
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { evaluatePublishHealth } from '@/modules/publish-watchdog/publish-watchdog.service'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const health = await evaluatePublishHealth(currentUser.userId)
    return NextResponse.json({ success: true, data: health })
  } catch (error: any) {
    console.error('[publish-watchdog/status GET] 실패', error)
    return NextResponse.json(
      { success: false, error: error?.message || '발행 헬스 조회 실패' },
      { status: 500 },
    )
  }
}
