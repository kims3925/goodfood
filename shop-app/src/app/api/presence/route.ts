export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { setVisitorPresence, removeVisitorPresence, type VisitorInfo } from '@/lib/redis'

/**
 * POST /api/presence
 *
 * 방문자 접속 정보 등록/갱신 (Heartbeat)
 * 또는 sendBeacon을 통한 이탈 처리 (쿼리 파라미터로 sessionId만 전달)
 */
export async function POST(request: NextRequest) {
  try {
    // sendBeacon은 POST로 보내지만 body가 없을 수 있음
    // 쿼리 파라미터로 sessionId가 있으면 이탈 처리
    const { searchParams } = new URL(request.url)
    const sessionIdFromQuery = searchParams.get('sessionId')

    if (sessionIdFromQuery) {
      // sendBeacon을 통한 이탈 처리
      await removeVisitorPresence(sessionIdFromQuery)
      return NextResponse.json({ success: true })
    }

    const body = await request.json()
    const {
      sessionId,
      shopSlug,
      currentPage,
      productId,
      productName,
      device,
      referrer,
      startedAt,
    } = body

    if (!sessionId || !shopSlug || !currentPage) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const userAgent = request.headers.get('user-agent') || undefined

    const visitorInfo: VisitorInfo = {
      sessionId,
      shopSlug,
      currentPage,
      productId: productId ? parseInt(productId) : undefined,
      productName,
      device: device || 'desktop',
      referrer,
      startedAt: startedAt || new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      userAgent,
    }

    await setVisitorPresence(visitorInfo)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Presence 등록 실패:', error)
    return NextResponse.json(
      { success: false, error: 'Presence 등록에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/presence
 *
 * 방문자 명시적 이탈 처리
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId가 필요합니다.' },
        { status: 400 }
      )
    }

    await removeVisitorPresence(sessionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Presence 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: 'Presence 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
