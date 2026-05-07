/**
 * GET /api/inbox/ai-status
 * 본인 Claude API 키 등록 여부 + 모델 정보. 인박스 UI 가 키 미등록 안내 배너 표시용.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { getClaudeConfigForUser } from '@/modules/ai/claude.client'

export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const config = await getClaudeConfigForUser(me.userId)
  return NextResponse.json({
    success: true,
    data: {
      hasKey: !!config,
      model: config?.model || null,
      settingsUrl: '/sourcing/settings/ai',
    },
  })
}
