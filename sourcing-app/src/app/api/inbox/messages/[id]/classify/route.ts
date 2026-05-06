/**
 * POST /api/inbox/messages/[id]/classify
 *  → Claude API 로 의도 분류 + 에스컬레이션 판단 + DB 저장
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { classifyMessage, shouldEscalate } from '@/modules/inbox/inbox.service'
import { hasClaudeApiKey } from '@/modules/ai/claude.client'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  if (!hasClaudeApiKey()) {
    return NextResponse.json(
      { success: false, error: 'ANTHROPIC_API_KEY 환경변수가 필요합니다.' },
      { status: 500 }
    )
  }

  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  const exists = await prisma.inboxMessage.findFirst({
    where: { id, userId: me.userId },
    select: { id: true },
  })
  if (!exists) return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 })

  try {
    const classification = await classifyMessage(id)
    const escalation = await shouldEscalate(id)

    if (escalation.escalate) {
      await prisma.inboxMessage.update({
        where: { id },
        data: {
          isEscalated: true,
          escalateReason: escalation.reason || 'AI 판단',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: { classification, escalation },
    })
  } catch (err: any) {
    console.error('[Inbox Classify]', err)
    return NextResponse.json(
      { success: false, error: err?.message || '분류 실패' },
      { status: 500 }
    )
  }
}
