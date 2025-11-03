import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { tossClientKey, tossSecretKey } = await req.json()

    if (!tossClientKey || !tossSecretKey) {
      return NextResponse.json({
        success: false,
        error: 'API 키가 입력되지 않았습니다.',
      })
    }

    // 토스페이먼츠 결제 위젯 API 키 형식 검증
    // Client Key: test_gck_ 또는 live_gck_ 로 시작
    // Secret Key: test_gsk_ 또는 live_gsk_ 로 시작

    const isValidClientKey = tossClientKey.startsWith('test_gck_') || tossClientKey.startsWith('live_gck_')
    const isValidSecretKey = tossSecretKey.startsWith('test_gsk_') || tossSecretKey.startsWith('live_gsk_')

    if (!isValidClientKey) {
      return NextResponse.json({
        success: false,
        error: '올바른 토스페이먼츠 Client Key 형식이 아닙니다. (test_gck_ 또는 live_gck_로 시작해야 합니다)',
      })
    }

    if (!isValidSecretKey) {
      return NextResponse.json({
        success: false,
        error: '올바른 토스페이먼츠 Secret Key 형식이 아닙니다. (test_gsk_ 또는 live_gsk_로 시작해야 합니다)',
      })
    }

    // 테스트 키인지 라이브 키인지 확인
    if (tossClientKey.startsWith('test_gck_') && tossSecretKey.startsWith('test_gsk_')) {
      return NextResponse.json({
        success: true,
        message: '토스페이먼츠 결제위젯 테스트 키가 확인되었습니다.',
      })
    } else if (tossClientKey.startsWith('live_gck_') && tossSecretKey.startsWith('live_gsk_')) {
      return NextResponse.json({
        success: true,
        message: '토스페이먼츠 결제위젯 라이브 키가 확인되었습니다.',
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Client Key와 Secret Key가 같은 환경(테스트/라이브)이어야 합니다.',
      })
    }
  } catch (error) {
    console.error('Connection test failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Connection test failed',
      },
      { status: 500 }
    )
  }
}
