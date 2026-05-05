/**
 * GET  /api/lite/missions          — 셀러의 미션 + 진행도
 * POST /api/lite/missions/evaluate — 진행도 즉시 재평가 (이벤트/페이지 진입 시)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { getUserMissionStatus, evaluateUserMissions } from '@/modules/lite-manager/mission.service'

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }
    // 진입 시 자동 재평가 (idempotent)
    await evaluateUserMissions(user.userId)
    const missions = await getUserMissionStatus(user.userId)
    const completed = missions.filter((m) => m.completed && m.code !== 'pro_unlock').length
    const proUnlocked = missions.find((m) => m.code === 'pro_unlock')?.completed ?? false
    return NextResponse.json({
      success: true,
      data: { missions, summary: { completed, total: missions.length - 1, proUnlocked } },
    })
  } catch (error: any) {
    console.error('[Lite Missions GET]', error)
    return NextResponse.json({ success: false, error: error?.message || '오류' }, { status: 500 })
  }
}

export async function POST(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }
    const result = await evaluateUserMissions(user.userId)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Lite Missions POST]', error)
    return NextResponse.json({ success: false, error: error?.message || '오류' }, { status: 500 })
  }
}
