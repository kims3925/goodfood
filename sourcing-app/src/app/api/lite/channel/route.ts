/**
 * GET   /api/lite/channel — 라이트 셀러 본인의 RETAIL Band 채널 + 세션 상태
 * PATCH /api/lite/channel — 본인 채널의 Band 세션 쿠키 업데이트
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const channels = await prisma.channel.findMany({
    where: { userId: me.userId, kind: 'RETAIL', deletedAt: null },
    select: {
      id: true,
      name: true,
      channelKey: true,
      isActive: true,
      sessionExpiresAt: true,
      bandSessionCookie: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // 세션 쿠키 자체는 클라이언트로 보내지 않고 등록 여부만 노출
  const data = channels.map((c) => ({
    id: c.id,
    name: c.name,
    channelKey: c.channelKey,
    isActive: c.isActive,
    sessionExpiresAt: c.sessionExpiresAt,
    hasSession: !!c.bandSessionCookie,
  }))

  return NextResponse.json({ success: true, data })
}

export async function PATCH(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const channelId = Number(body?.channelId)
  const bandSessionCookie = body?.bandSessionCookie
  if (!Number.isFinite(channelId)) {
    return NextResponse.json({ success: false, error: 'channelId 누락' }, { status: 400 })
  }
  if (!bandSessionCookie || typeof bandSessionCookie !== 'string') {
    return NextResponse.json({ success: false, error: '쿠키 누락' }, { status: 400 })
  }

  // 본인 소유 확인
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, userId: me.userId, kind: 'RETAIL', deletedAt: null },
    select: { id: true },
  })
  if (!channel) {
    return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 })
  }

  // 세션 갱신 — 쿠키 등록 시 만료 시각을 +30일로 가정 (실제 검증은 publish 시 시도)
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await prisma.channel.update({
    where: { id: channelId },
    data: { bandSessionCookie, sessionExpiresAt, isActive: true },
  })

  return NextResponse.json({ success: true })
}
