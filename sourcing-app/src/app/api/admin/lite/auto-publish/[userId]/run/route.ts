/**
 * POST /api/admin/lite/auto-publish/[userId]/run — 어드민이 즉시 자동 발행 실행
 *
 * 시간 검사 우회 (force=true). 단 같은 KST 일자에 이미 실행된 경우는 force 와 무관하게
 * 별도 정책으로 결정 — 여기서는 force=true 로 강제 재실행 가능 (테스트/누락 보충용).
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { runAutoPublishForUser } from '@/modules/lite-manager/auto-publish.service'

export async function POST(_request: NextRequest, { params }: { params: { userId: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })
  if (me.role !== 'ADMIN')
    return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 })

  const userId = Number(params.userId)
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ success: false, error: '잘못된 userId' }, { status: 400 })
  }

  try {
    const result = await runAutoPublishForUser(userId, { force: true })
    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || '실행 실패' },
      { status: 500 }
    )
  }
}
