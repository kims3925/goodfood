/**
 * POST /api/lite/events/test
 * Lite Manager — 베타/개발 검증용 수동 이벤트 트리거
 *
 * Body:
 *  - { orderId: number } — 기존 Order 로 emit (DB 기록 + SSE push)
 *  - { mock: true }      — 가짜 mock 이벤트 (DB 기록 없음, SSE 만)
 *
 * 인증: 로그인된 셀러만 자기 자신에게 emit 가능 (안전)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { emitOrderCreated } from '@/modules/lite-manager/order-event.service'
import { liteEventBus } from '@/lib/lite-events'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))

  // 모드 1: 가짜 mock — UI 검증용
  if (body.mock === true) {
    const payload = {
      orderId: -1,
      shopId: null,
      userId: user.userId,
      totalAmount: 30000,
      itemCount: 1,
      buyer: { name: '홍**', phone: '***-****-5678' },
      topItem: {
        productName: '테스트 상품 — 첫 판매 시뮬레이션',
        optionSummary: '기본',
        quantity: 1,
      },
      orderedAt: new Date().toISOString(),
    }
    liteEventBus.emitOrderCreated(payload)
    return NextResponse.json({ success: true, payload, note: 'mock 이벤트 emit (DB 미기록)' })
  }

  // 모드 2: 실제 Order
  const orderId = Number(body.orderId)
  if (!orderId) {
    return NextResponse.json(
      { success: false, error: 'orderId 또는 mock:true 필요' },
      { status: 400 }
    )
  }

  const result = await emitOrderCreated(orderId)
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.reason || 'emit 실패' },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true, payload: result.payload })
}
