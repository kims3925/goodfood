/**
 * POST /api/inbox/messages/[id]/reply
 *  → AI 응답 생성 (저장만, 발송 X — 발송은 채널별 어댑터 책임)
 *
 * Body (옵션):
 * - regenerate?: boolean — true 면 기존 aiReply 무시하고 재생성
 * - markReplied?: boolean — true 면 isAutoReplied=true + repliedAt 설정
 *                         (실제 채널 발송 후 사장님이 확인 시 호출)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { generateAndSaveReply } from '@/modules/inbox/inbox.service'
import { hasClaudeApiKey } from '@/modules/ai/claude.client'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    /* empty body OK */
  }
  const regenerate = Boolean(body?.regenerate)
  const markReplied = Boolean(body?.markReplied)

  const msg = await prisma.inboxMessage.findFirst({
    where: { id, userId: me.userId },
    select: { id: true, intent: true, aiReply: true },
  })
  if (!msg) return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 })
  if (!msg.intent) {
    return NextResponse.json(
      { success: false, error: '먼저 의도 분류를 실행하세요.' },
      { status: 400 }
    )
  }

  let reply = msg.aiReply || null
  if (regenerate || !reply) {
    try {
      reply = await generateAndSaveReply(id)
    } catch (err: any) {
      console.error('[Inbox Reply]', err)
      return NextResponse.json(
        { success: false, error: err?.message || '응답 생성 실패' },
        { status: 500 }
      )
    }
  }

  if (markReplied) {
    await prisma.inboxMessage.update({
      where: { id },
      data: {
        isAutoReplied: true,
        repliedAt: new Date(),
      },
    })
  }

  return NextResponse.json({ success: true, data: { aiReply: reply, markReplied } })
}
