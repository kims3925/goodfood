import { NextRequest, NextResponse } from 'next/server'
import { getWebhookHandler } from '@/domain/payments'

export async function POST(request: NextRequest) {
  try {
    console.log('토스페이먼츠 웹훅 수신')

    // 웹훅 핸들러로 처리
    const webhookHandler = getWebhookHandler()
    const result = await webhookHandler.handleWebhook(request)

    if (result.success) {
      console.log('웹훅 처리 성공:', result.message)
      return NextResponse.json({ success: true })
    } else {
      console.error('웹훅 처리 실패:', result.message)
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('웹훅 처리 중 오류:', error)

    // 웹훅은 토스페이먼츠에서 재시도하므로 500 에러 반환
    return NextResponse.json(
      {
        success: false,
        error: '웹훅 처리 중 서버 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET 요청은 허용하지 않음 (보안상의 이유)
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}