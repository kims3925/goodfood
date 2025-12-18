export const dynamic = 'force-dynamic'

/**
 * Toss Payments Webhook API
 * 토스페이먼츠 웹훅 수신 엔드포인트
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWebhookHandler } from '@/modules/payments/services/webhook-handler.service'

/**
 * POST /api/payments/webhook
 * 토스페이먼츠 웹훅 이벤트 수신
 *
 * 웹훅 이벤트 타입:
 * - PAYMENT_STATUS_CHANGED: 결제 상태 변경 시
 * - PAYMENT_CANCELED: 결제 취소 시
 * - VIRTUAL_ACCOUNT_ISSUED: 가상계좌 발급 시
 * - VIRTUAL_ACCOUNT_DEPOSIT: 가상계좌 입금 시
 */
export async function POST(req: NextRequest) {
  try {
    console.log('토스페이먼츠 웹훅 이벤트 수신')

    // 웹훅 핸들러 인스턴스 생성
    const webhookHandler = getWebhookHandler()

    // 웹훅 이벤트 처리
    const result = await webhookHandler.handleWebhook(req)

    if (result.success) {
      console.log('웹훅 처리 성공:', result.message)
      return NextResponse.json(
        { success: true, message: result.message },
        { status: 200 }
      )
    } else {
      console.error('웹훅 처리 실패:', result.message)
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('웹훅 처리 오류:', error)

    // 웹훅 실패 시 토스페이먼츠가 재시도하므로 5xx 에러 반환
    return NextResponse.json(
      {
        success: false,
        error: '웹훅 처리 중 오류가 발생했습니다',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/payments/webhook
 * 웹훅 엔드포인트 상태 확인용 (개발/테스트)
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: '토스페이먼츠 웹훅 엔드포인트가 정상 작동 중입니다',
    endpoint: '/api/payments/webhook',
    methods: ['POST'],
    webhookSecret: process.env.TOSS_PAYMENTS_WEBHOOK_SECRET ? '설정됨' : '미설정'
  })
}
