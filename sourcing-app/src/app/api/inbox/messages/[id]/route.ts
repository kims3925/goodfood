/**
 * GET   /api/inbox/messages/[id] — 메시지 상세 + 같은 thread 의 다른 메시지
 * PATCH /api/inbox/messages/[id] — isRead/isEscalated/aiReply 수정
 * DELETE /api/inbox/messages/[id] — 메시지 삭제
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  const msg = await prisma.inboxMessage.findFirst({
    where: { id, userId: me.userId },
  })
  if (!msg) return NextResponse.json({ success: false, error: '없음' }, { status: 404 })

  // 같은 스레드 메시지 (시간순)
  const thread = await prisma.inboxMessage.findMany({
    where: { userId: me.userId, threadId: msg.threadId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      channel: true,
      direction: true,
      senderName: true,
      content: true,
      intent: true,
      aiReply: true,
      isAutoReplied: true,
      isEscalated: true,
      createdAt: true,
      repliedAt: true,
    },
  })

  return NextResponse.json({ success: true, data: { message: msg, thread } })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const exists = await prisma.inboxMessage.findFirst({
    where: { id, userId: me.userId },
    select: { id: true },
  })
  if (!exists) return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 })

  const updates: any = {}
  if (body.isRead !== undefined) updates.isRead = Boolean(body.isRead)
  if (body.isEscalated !== undefined) updates.isEscalated = Boolean(body.isEscalated)
  if (body.escalateReason !== undefined) updates.escalateReason = body.escalateReason || null
  if (body.aiReply !== undefined) updates.aiReply = body.aiReply || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: '변경 항목 없음' }, { status: 400 })
  }

  await prisma.inboxMessage.update({ where: { id }, data: updates })
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  const exists = await prisma.inboxMessage.findFirst({
    where: { id, userId: me.userId },
    select: { id: true },
  })
  if (!exists) return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 })

  await prisma.inboxMessage.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
