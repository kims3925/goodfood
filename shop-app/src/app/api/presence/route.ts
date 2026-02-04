export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, setVisitorPresence, removeVisitorPresence, type VisitorInfo, PRESENCE_PREFIX } from '@/lib/redis'

// 봇/크롤러 User-Agent 패턴
const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /facebookexternalhit/i,
  /Facebot/i,
  /kakaotalk-scrap/i,
  /yeti/i,           // Naver
  /Baiduspider/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Slackbot/i,
  /Discordbot/i,
  /WhatsApp/i,
  /TelegramBot/i,
  /bandapp/i,        // Band 미리보기
  /BAND\//i,         // Band 앱
  /preview/i,
  /HeadlessChrome/i,
]

// 중복 방지 시간 (초) - 이 시간 내 같은 fingerprint 요청은 무시
const DEDUP_WINDOW_SECONDS = 5

/**
 * 봇/크롤러 여부 확인
 */
function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

/**
 * fingerprint 생성 (User-Agent + shopSlug + currentPage)
 */
function createFingerprint(userAgent: string, shopSlug: string, currentPage: string): string {
  // User-Agent의 핵심 부분만 추출 (버전 제외)
  const uaCore = userAgent
    .replace(/Chrome\/[\d.]+/g, 'Chrome')
    .replace(/Safari\/[\d.]+/g, 'Safari')
    .replace(/Version\/[\d.]+/g, 'Version')
    .replace(/Mobile\/[\w]+/g, 'Mobile')

  return `fp:${shopSlug}:${currentPage}:${Buffer.from(uaCore).toString('base64').slice(0, 32)}`
}

/**
 * 중복 요청인지 확인하고, 중복이면 기존 sessionId 반환
 */
async function checkDuplicate(fingerprint: string): Promise<string | null> {
  const client = await getRedisClient()
  if (!client) return null

  try {
    const existingSessionId = await client.get(fingerprint)
    return existingSessionId
  } catch {
    return null
  }
}

/**
 * fingerprint-sessionId 매핑 저장
 */
async function setFingerprintMapping(fingerprint: string, sessionId: string): Promise<void> {
  const client = await getRedisClient()
  if (!client) return

  try {
    await client.setEx(fingerprint, DEDUP_WINDOW_SECONDS, sessionId)
  } catch {
    // 무시
  }
}

/**
 * POST /api/presence
 *
 * 방문자 접속 정보 등록/갱신 (Heartbeat)
 * 또는 sendBeacon을 통한 이탈 처리 (쿼리 파라미터로 sessionId만 전달)
 */
export async function POST(request: NextRequest) {
  try {
    // 봇/크롤러 필터링
    const userAgent = request.headers.get('user-agent')
    if (isBot(userAgent)) {
      return NextResponse.json({ success: true, filtered: 'bot' })
    }

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

    const ua = userAgent || ''

    // fingerprint 기반 중복 체크
    const fingerprint = createFingerprint(ua, shopSlug, currentPage)
    const existingSessionId = await checkDuplicate(fingerprint)

    // 중복 요청이면 기존 세션 갱신
    const effectiveSessionId = existingSessionId || sessionId

    // 새 세션이면 fingerprint 매핑 저장
    if (!existingSessionId) {
      await setFingerprintMapping(fingerprint, sessionId)
    }

    const visitorInfo: VisitorInfo = {
      sessionId: effectiveSessionId,
      shopSlug,
      currentPage,
      productId: productId ? parseInt(productId) : undefined,
      productName,
      device: device || 'desktop',
      referrer,
      startedAt: startedAt || new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      userAgent: ua,
    }

    await setVisitorPresence(visitorInfo)

    return NextResponse.json({ success: true, deduplicated: !!existingSessionId })
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
