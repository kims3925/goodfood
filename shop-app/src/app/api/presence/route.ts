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
// Band 앱 → 외부 브라우저 전환 등을 고려하여 60초로 설정
const DEDUP_WINDOW_SECONDS = 60

/**
 * 봇/크롤러 여부 확인
 */
function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

/**
 * 클라이언트 IP 추출
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

/**
 * fingerprint 생성 (IP + screenSize + shopSlug)
 *
 * Band 인앱 WebView → 외부 브라우저 전환 시 User-Agent가 달라지지만,
 * IP와 화면 크기는 동일하므로 같은 방문자로 정확히 식별 가능
 */
function createFingerprint(ip: string, screenSize: string, shopSlug: string): string {
  const raw = `${ip}:${screenSize}:${shopSlug}`
  return `fp:${Buffer.from(raw).toString('base64').slice(0, 40)}`
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
      screenSize,
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

    // fingerprint 기반 중복 체크 (IP + 화면 크기로 동일 기기 식별)
    const clientIp = getClientIp(request)
    const fingerprint = createFingerprint(clientIp, screenSize || '0x0', shopSlug)
    const existingSessionId = await checkDuplicate(fingerprint)

    // 중복 요청이면 기존 세션 갱신
    const effectiveSessionId = existingSessionId || sessionId

    // fingerprint 매핑을 항상 갱신 (heartbeat마다 TTL 리셋)
    await setFingerprintMapping(fingerprint, effectiveSessionId)

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
