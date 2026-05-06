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
import {
  createInboxEscalationNotification,
  createInboxAutoOrderNotification,
} from '@/modules/inbox/inbox-notifier'
import { tryCreateAutoOrder } from '@/modules/inbox/auto-order.service'

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
      // 사장님 알림 생성 (Notification — section='sourcing', type='INQUIRY')
      await createInboxEscalationNotification(id, escalation.reason || 'AI 판단')
    }

    // 의도='ORDER' + 신뢰도 충분하면 자동 주문 생성 시도
    let autoOrder: any = null
    if (classification.intent === 'ORDER' && classification.confidence >= 0.7) {
      autoOrder = await tryCreateAutoOrder(id)
      if (autoOrder?.ok) {
        await createInboxAutoOrderNotification(id, {
          orderNumber: autoOrder.orderNumber!,
          totalAmount: autoOrder.totalAmount!,
          productName: classification.productName || '상품',
          quantity: classification.quantity || 1,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: { classification, escalation, autoOrder },
    })
  } catch (err: any) {
    console.error('[Inbox Classify]', err)
    return NextResponse.json(
      { success: false, error: err?.message || '분류 실패' },
      { status: 500 }
    )
  }
}
