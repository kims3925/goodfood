/**
 * Lite Manager — 코칭 가이드 API (E1+E3 백엔드)
 *
 * GET  /api/lite/coaching         — 미응답 팁 목록 (대시보드 상단 표시)
 * POST /api/lite/coaching/evaluate — 룰 즉시 평가 (베타/개발용 + cron 대신 호출)
 * POST /api/lite/coaching/dismiss — 팁 dismiss (shown=true)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { evaluateAndCreateTips } from '@/modules/lite-manager/coaching-engine'

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 24시간 이내 + shown=false 만 — 너무 옛날 팁은 자동 만료
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const tips = await prisma.coachingTip.findMany({
      where: { userId: user.userId, shown: false, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, ruleKey: true, message: true, ctaUrl: true, createdAt: true },
    })

    return NextResponse.json({ success: true, data: { tips } })
  } catch (error: any) {
    console.error('[Lite Coaching GET]', error)
    return NextResponse.json({ success: false, error: error?.message || '오류' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action

    if (action === 'evaluate') {
      const created = await evaluateAndCreateTips(user.userId)
      return NextResponse.json({ success: true, created })
    }

    if (action === 'dismiss') {
      const tipId = body.tipId
      if (!tipId) {
        return NextResponse.json({ success: false, error: 'tipId 필요' }, { status: 400 })
      }
      await prisma.coachingTip.updateMany({
        where: { id: tipId, userId: user.userId },
        data: { shown: true, shownAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { success: false, error: 'action: evaluate | dismiss' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[Lite Coaching POST]', error)
    return NextResponse.json({ success: false, error: error?.message || '오류' }, { status: 500 })
  }
}
