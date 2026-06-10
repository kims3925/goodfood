export const dynamic = 'force-dynamic'

/**
 * 확장프로그램 전용 API 키 발급/조회
 *
 * 밴드 세션 저장(save-all)을 소싱앱 JWT(7일 만료)와 무관하게 인증하기 위한
 * 장기 키. 권한은 세션 저장 1개로 한정 — save-all 의 X-Extension-Key 분기 참조.
 * 키 원문은 발급(POST) 응답에서만 노출하고, 조회(GET)는 끝 6자리만 회신.
 */

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 발급 여부만 회신 (키 원문은 발급 시점에만 노출)
export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: me.userId },
    select: { extensionApiKey: true, extensionApiKeyCreatedAt: true },
  })
  return NextResponse.json({
    success: true,
    data: {
      issued: !!user?.extensionApiKey,
      createdAt: user?.extensionApiKeyCreatedAt ?? null,
      keyTail: user?.extensionApiKey ? user.extensionApiKey.slice(-6) : null,
    },
  })
}

// POST: 발급/재발급 (기존 키 즉시 무효화)
export async function POST() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  const key = `bsk_${crypto.randomBytes(24).toString('hex')}` // 52자
  await prisma.user.update({
    where: { id: me.userId },
    data: { extensionApiKey: key, extensionApiKeyCreatedAt: new Date() },
  })
  return NextResponse.json({ success: true, data: { key } })
}
