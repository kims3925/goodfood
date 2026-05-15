export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/band-session/health
 *
 * 현재 로그인 사용자의 활성 RETAIL 채널 세션 헬스 요약 반환.
 * 대시보드 SessionHealthBanner 가 폴링.
 *
 * Phase 1 — SaaS-grade 예방책 (BandAuto 작업지침 v2 §SaaS 예방).
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { evaluateSessionHealth } from '@/modules/band-session/band-session-health'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const summary = await evaluateSessionHealth(currentUser.userId)

    return NextResponse.json({ success: true, data: summary })
  } catch (error: any) {
    console.error('[band-session/health GET] 실패', error)
    return NextResponse.json(
      { success: false, error: error?.message || '세션 헬스 조회 실패' },
      { status: 500 },
    )
  }
}
