import { NextRequest, NextResponse } from 'next/server'

// 미들웨어의 캐시에 접근하기 위한 전역 변수
// 미들웨어에서 이 Map을 import해서 사용
declare global {
  var channelCacheRef: Map<string, { data: unknown; timestamp: number }> | null
}

export async function POST(req: NextRequest) {
  // 내부 API 키 검증
  const internalKey = req.headers.get('x-internal-key')
  const expectedKey = process.env.INTERNAL_API_KEY || 'dev-internal-key'

  if (internalKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { subdomain } = await req.json()

    if (!subdomain) {
      return NextResponse.json({ error: 'subdomain is required' }, { status: 400 })
    }

    // 전역 캐시 참조가 있으면 해당 서브도메인 캐시 삭제
    if (global.channelCacheRef) {
      global.channelCacheRef.delete(subdomain)
      console.log(`[Cache Invalidation] Channel cache invalidated for subdomain: ${subdomain}`)
    }

    return NextResponse.json({
      success: true,
      message: `Cache invalidated for subdomain: ${subdomain}`
    })
  } catch (error) {
    console.error('Failed to invalidate channel cache:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
