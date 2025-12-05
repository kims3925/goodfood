import { NextRequest, NextResponse } from 'next/server'

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

    // 전역 캐시 참조에서 특정 서브도메인 캐시 삭제
    if (global.shopCacheRef) {
      global.shopCacheRef.delete(subdomain)
    }

    return NextResponse.json({
      success: true,
      message: `Cache invalidated for subdomain: ${subdomain}`,
    })
  } catch (error) {
    console.error('Failed to invalidate shop cache:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
