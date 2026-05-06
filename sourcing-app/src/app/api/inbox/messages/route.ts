/**
 * GET  /api/inbox/messages — 본인 인박스 메시지 목록
 * POST /api/inbox/messages — 새 메시지 추가 (수동 / 채널 어댑터 / 테스트용)
 *
 * Query (GET):
 * - channel: BAND_COMMENT|BAND_CHAT|KAKAO|SMS|all (기본 all)
 * - status: unread|escalated|done|all (기본 all)
 * - threadId: 특정 스레드 메시지만
 * - limit: 기본 100, 최대 500
 *
 * Body (POST): { channel, threadId, senderId, senderName?, content, direction? }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const channel = searchParams.get('channel')
  const status = searchParams.get('status') || 'all'
  const threadId = searchParams.get('threadId')
  const limit = Math.min(Number(searchParams.get('limit') || 100), 500)

  const where: any = { userId: me.userId }
  if (channel && channel !== 'all') where.channel = channel
  if (threadId) where.threadId = threadId

  if (status === 'unread') where.isRead = false
  else if (status === 'escalated') where.isEscalated = true
  else if (status === 'done') where.isAutoReplied = true

  const messages = await prisma.inboxMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      channel: true,
      direction: true,
      threadId: true,
      senderId: true,
      senderName: true,
      content: true,
      intent: true,
      confidence: true,
      aiReply: true,
      isAutoReplied: true,
      isEscalated: true,
      escalateReason: true,
      isRead: true,
      orderId: true,
      productId: true,
      metadata: true,
      createdAt: true,
      repliedAt: true,
    },
  })

  // 통계
  const [unreadCount, escalatedCount] = await Promise.all([
    prisma.inboxMessage.count({ where: { userId: me.userId, isRead: false } }),
    prisma.inboxMessage.count({ where: { userId: me.userId, isEscalated: true, isRead: false } }),
  ])

  return NextResponse.json({
    success: true,
    data: { messages, stats: { unreadCount, escalatedCount } },
  })
}

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const { channel, threadId, senderId, senderName, content, direction } = body || {}
  if (!channel || !threadId || !senderId || !content) {
    return NextResponse.json(
      { success: false, error: 'channel/threadId/senderId/content 필수' },
      { status: 400 }
    )
  }
  if (!['BAND_COMMENT', 'BAND_CHAT', 'KAKAO', 'SMS'].includes(channel)) {
    return NextResponse.json({ success: false, error: '잘못된 channel' }, { status: 400 })
  }

  const created = await prisma.inboxMessage.create({
    data: {
      userId: me.userId,
      channel,
      direction: direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
      threadId: String(threadId),
      senderId: String(senderId),
      senderName: senderName || null,
      content: String(content),
    },
  })

  return NextResponse.json({ success: true, data: created }, { status: 201 })
}
