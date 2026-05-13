/**
 * POST /api/order/external/from-text
 *
 * Phase 4 — 외부주문 간소화 입력. 자유 텍스트(전화/카톡/밴드댓글 받은 주문)
 * + 발신자 정보 + 분류(소매/도매)를 받아 Claude AI 로 추출 후 GuestOrder 생성.
 *
 * Body:
 * {
 *   "externalKind": "RETAIL" | "WHOLESALE",
 *   "rawText": "...자유 텍스트...",
 *   "senderName": "김영자",  (선택)
 *   "senderPhone": "010-...", (선택)
 *   "shopId": 1               (선택 — 없으면 첫 활성 쇼핑몰)
 * }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { createExternalOrderFromText } from '@/modules/order/external-order.service'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '요청 본문이 올바르지 않습니다.' }, { status: 400 })
  }

  const externalKind = body?.externalKind === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL'
  const rawText = String(body?.rawText || '').trim()
  if (!rawText) {
    return NextResponse.json({ success: false, error: '주문 텍스트가 비어 있습니다.' }, { status: 400 })
  }

  try {
    const result = await createExternalOrderFromText({
      userId: user.userId,
      shopId: Number.isFinite(body?.shopId) ? Number(body.shopId) : null,
      source: 'MANUAL',
      externalKind,
      rawText,
      senderName: body?.senderName ? String(body.senderName) : null,
      senderPhone: body?.senderPhone ? String(body.senderPhone) : null,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('외부주문 텍스트 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '외부주문 생성에 실패했습니다.' },
      { status: 400 }
    )
  }
}
