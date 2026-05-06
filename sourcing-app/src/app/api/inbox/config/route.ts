/**
 * GET   /api/inbox/config — 본인 의도별 자동응답 설정 (12개)
 * PATCH /api/inbox/config — 단일 의도 설정 변경
 *                          body: { intent, isEnabled?, template?, escalateAlways?, replyDelaySec? }
 * POST  /api/inbox/config/seed — 12개 기본 설정 시드 (idempotent)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { isValidIntent, INTENTS, INTENT_ALWAYS_ESCALATE } from '@/lib/inbox-intents'
import { seedAutoReplyConfigs } from '@/modules/inbox/inbox.service'

export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  // 첫 호출 시 자동 시드
  const existingCount = await prisma.autoReplyConfig.count({
    where: { userId: me.userId },
  })
  if (existingCount === 0) {
    await seedAutoReplyConfigs(me.userId)
  } else if (existingCount < INTENTS.length) {
    // 일부 누락 시 보충
    await seedAutoReplyConfigs(me.userId)
  }

  const configs = await prisma.autoReplyConfig.findMany({
    where: { userId: me.userId },
    orderBy: { intent: 'asc' },
  })

  // 의도 순서대로 정렬 (frontend 표시 순서)
  const ordered = INTENTS.map(
    (intent) =>
      configs.find((c) => c.intent === intent) || {
        id: 0,
        intent,
        isEnabled: true,
        template: null,
        aiPromptHint: null,
        escalateAlways: INTENT_ALWAYS_ESCALATE[intent],
        replyDelaySec: 30,
        maxAutoRetries: 2,
      }
  )

  return NextResponse.json({ success: true, data: ordered })
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

  const intent = body?.intent
  if (!isValidIntent(intent)) {
    return NextResponse.json({ success: false, error: '잘못된 intent' }, { status: 400 })
  }

  const updates: any = {}
  if (body.isEnabled !== undefined) updates.isEnabled = Boolean(body.isEnabled)
  if (body.template !== undefined) updates.template = body.template || null
  if (body.aiPromptHint !== undefined) updates.aiPromptHint = body.aiPromptHint || null
  if (body.escalateAlways !== undefined) updates.escalateAlways = Boolean(body.escalateAlways)
  if (body.replyDelaySec !== undefined) {
    const n = Number(body.replyDelaySec)
    updates.replyDelaySec = Number.isFinite(n) ? Math.max(0, Math.min(600, Math.floor(n))) : 30
  }
  if (body.maxAutoRetries !== undefined) {
    const n = Number(body.maxAutoRetries)
    updates.maxAutoRetries = Number.isFinite(n) ? Math.max(0, Math.min(5, Math.floor(n))) : 2
  }

  await prisma.autoReplyConfig.upsert({
    where: { userId_intent: { userId: me.userId, intent } },
    create: {
      userId: me.userId,
      intent,
      isEnabled: updates.isEnabled ?? true,
      escalateAlways: updates.escalateAlways ?? INTENT_ALWAYS_ESCALATE[intent],
      template: updates.template ?? null,
      aiPromptHint: updates.aiPromptHint ?? null,
      replyDelaySec: updates.replyDelaySec ?? 30,
      maxAutoRetries: updates.maxAutoRetries ?? 2,
    },
    update: updates,
  })

  return NextResponse.json({ success: true })
}

export async function POST(_req: NextRequest) {
  // 시드 명령 (수동 호출용)
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  await seedAutoReplyConfigs(me.userId)
  return NextResponse.json({ success: true })
}
