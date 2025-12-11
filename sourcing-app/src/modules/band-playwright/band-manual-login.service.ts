/**
 * Band 수동 로그인 서비스
 * 2FA가 설정된 네이버 계정을 위한 수동 로그인 지원
 * headless: false로 브라우저를 열어 사용자가 직접 로그인
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright'
import prisma from '@bandauto/db'

const BAND_LOGIN_URL = 'https://auth.band.us/login_page'
const BAND_HOME_URL = 'https://band.us/home'
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000 // 5분 대기
const SESSION_EXPIRY_DAYS = 14

interface ManualLoginSession {
  browser: Browser
  context: BrowserContext
  page: Page
  status: 'waiting' | 'completed' | 'failed' | 'cancelled'
  error?: string
}

// 진행 중인 수동 로그인 세션
const activeSessions = new Map<string, ManualLoginSession>()

export class BandManualLoginService {
  /**
   * 수동 로그인 시작
   * headless: false로 브라우저를 열어 사용자가 직접 로그인
   */
  async startManualLogin(channelId: number): Promise<{ sessionId: string; success: boolean; error?: string }> {
    const sessionId = `manual_${channelId}_${Date.now()}`

    try {
      console.log(`[BandManualLogin] Starting manual login for channel ${channelId}`)

      // 브라우저 시작 (headless: false)
      const browser = await chromium.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      })

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'ko-KR',
      })

      const page = await context.newPage()

      // 세션 저장
      activeSessions.set(sessionId, {
        browser,
        context,
        page,
        status: 'waiting',
      })

      // Band 로그인 페이지로 이동
      await page.goto(BAND_LOGIN_URL, { timeout: 30000 })
      console.log(`[BandManualLogin] Opened login page for session ${sessionId}`)

      // 로그인 완료 대기 (백그라운드에서)
      this.waitForLoginCompletion(sessionId, channelId).catch(console.error)

      return { sessionId, success: true }
    } catch (error: any) {
      console.error(`[BandManualLogin] Failed to start manual login:`, error)
      return { sessionId, success: false, error: error.message }
    }
  }

  /**
   * 로그인 완료 대기 및 세션 저장
   */
  private async waitForLoginCompletion(sessionId: string, channelId: number): Promise<void> {
    const session = activeSessions.get(sessionId)
    if (!session) return

    const { page, context, browser } = session

    try {
      // 로그인 완료 대기 - Band 홈 페이지 도달 확인
      // auth.band.us나 nid.naver.com은 아직 로그인 중이므로 제외
      console.log(`[BandManualLogin] Waiting for login completion (session: ${sessionId})...`)
      console.log(`[BandManualLogin] 2FA 인증을 완료해주세요. Band 홈으로 이동하면 자동으로 세션이 저장됩니다.`)

      // Band 홈 페이지(band.us/home 또는 band.us/band/)에 도달할 때까지 대기
      await page.waitForURL(
        (url) => {
          const urlStr = url.toString()
          // Band 메인 페이지 도달 확인 (로그인/인증 페이지 제외)
          const isBandHome = urlStr.includes('band.us/home') ||
                            urlStr.includes('band.us/band/') ||
                            (urlStr.includes('band.us') &&
                             !urlStr.includes('auth.band.us') &&
                             !urlStr.includes('login') &&
                             !urlStr.includes('nid.naver.com'))
          if (isBandHome) {
            console.log(`[BandManualLogin] Band home detected: ${urlStr}`)
          }
          return isBandHome
        },
        { timeout: LOGIN_TIMEOUT_MS }
      )

      // 페이지가 완전히 로드될 때까지 추가 대기
      await page.waitForTimeout(3000)

      console.log(`[BandManualLogin] Login detected, extracting cookies...`)

      // Band 홈으로 이동하여 모든 쿠키 확보
      await page.goto(BAND_HOME_URL, { timeout: 30000, waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      // 쿠키 추출
      const cookies = await context.cookies()
      const bandCookies = cookies.filter(
        (c) => c.domain.includes('band.us') || c.domain.includes('naver.com')
      )

      if (bandCookies.length === 0) {
        throw new Error('쿠키를 추출하지 못했습니다.')
      }

      console.log(`[BandManualLogin] Extracted ${bandCookies.length} cookies`)

      // DB에 세션 저장
      const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      await prisma.channel.update({
        where: { id: channelId },
        data: {
          bandSessionCookie: JSON.stringify(bandCookies),
          sessionExpiresAt: expiresAt,
        },
      })

      console.log(`[BandManualLogin] Session saved to DB for channel ${channelId}`)

      // 세션 상태 업데이트
      session.status = 'completed'
      activeSessions.set(sessionId, session)

      // 브라우저 닫기
      await browser.close()
      console.log(`[BandManualLogin] Browser closed for session ${sessionId}`)

    } catch (error: any) {
      console.error(`[BandManualLogin] Login failed:`, error)
      session.status = 'failed'
      session.error = error.message
      activeSessions.set(sessionId, session)

      // 브라우저 닫기
      try {
        await browser.close()
      } catch {
        // ignore
      }
    }
  }

  /**
   * 세션 상태 확인
   */
  getSessionStatus(sessionId: string): { status: string; error?: string } {
    const session = activeSessions.get(sessionId)
    if (!session) {
      return { status: 'not_found' }
    }
    return {
      status: session.status,
      error: session.error,
    }
  }

  /**
   * 세션 취소
   */
  async cancelSession(sessionId: string): Promise<void> {
    const session = activeSessions.get(sessionId)
    if (!session) return

    session.status = 'cancelled'
    try {
      await session.browser.close()
    } catch {
      // ignore
    }
    activeSessions.delete(sessionId)
    console.log(`[BandManualLogin] Session ${sessionId} cancelled`)
  }

  /**
   * 채널의 세션 상태 조회
   */
  async getChannelSessionStatus(channelId: number): Promise<{
    hasSession: boolean
    isValid: boolean
    expiresAt: Date | null
  }> {
    const channel = await prisma.channel.findFirst({
      where: { id: channelId },
      select: {
        bandSessionCookie: true,
        sessionExpiresAt: true,
      },
    })

    if (!channel || !channel.bandSessionCookie || !channel.sessionExpiresAt) {
      return { hasSession: false, isValid: false, expiresAt: null }
    }

    const now = new Date()
    const expiresAt = new Date(channel.sessionExpiresAt)
    const isValid = expiresAt > now

    return {
      hasSession: true,
      isValid,
      expiresAt,
    }
  }

  /**
   * 세션 삭제
   */
  async deleteSession(channelId: number): Promise<void> {
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        bandSessionCookie: null,
        sessionExpiresAt: null,
      },
    })
    console.log(`[BandManualLogin] Session deleted for channel ${channelId}`)
  }

  /**
   * 쿠키 직접 저장 (서버 환경용)
   * 브라우저 개발자 도구에서 복사한 쿠키를 JSON 배열 형식으로 저장
   *
   * 쿠키 추출 방법:
   * 1. band.us 접속 후 F12 → Application → Cookies
   * 2. 콘솔(Console)에서 실행:
   *    copy(JSON.stringify(await cookieStore.getAll()))
   * 3. 붙여넣기
   */
  async saveSessionCookieDirect(channelId: number, cookieString: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[BandManualLogin] Saving cookie directly for channel ${channelId}`)

      const trimmed = cookieString.trim()

      // JSON 배열 형식만 지원
      if (!trimmed.startsWith('[')) {
        return {
          success: false,
          error: 'JSON 배열 형식만 지원합니다. 콘솔에서 copy(JSON.stringify(await cookieStore.getAll())) 실행 후 붙여넣기 하세요.'
        }
      }

      let cookies: any[]
      try {
        cookies = JSON.parse(trimmed)
        if (!Array.isArray(cookies)) {
          return { success: false, error: '쿠키는 JSON 배열 형식이어야 합니다.' }
        }
      } catch {
        return { success: false, error: '유효한 JSON 형식이 아닙니다.' }
      }

      // 필수 쿠키 확인 (band.us 또는 naver.com 도메인)
      const validCookies = cookies.filter(
        (c) => c.domain && (c.domain.includes('band.us') || c.domain.includes('naver.com'))
      )

      if (validCookies.length === 0) {
        return { success: false, error: 'Band 또는 Naver 관련 쿠키가 없습니다.' }
      }

      // band_session 쿠키 필수 확인
      const hasBandSession = validCookies.some(c => c.name === 'band_session')
      if (!hasBandSession) {
        return { success: false, error: 'band_session 쿠키가 포함되어 있지 않습니다.' }
      }

      // DB에 세션 저장
      const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      await prisma.channel.update({
        where: { id: channelId },
        data: {
          bandSessionCookie: JSON.stringify(validCookies),
          sessionExpiresAt: expiresAt,
        },
      })

      console.log(`[BandManualLogin] Direct cookie saved for channel ${channelId} (${validCookies.length} cookies)`)
      return { success: true }
    } catch (error: any) {
      console.error(`[BandManualLogin] Failed to save cookie directly:`, error)
      return { success: false, error: error.message }
    }
  }
}

export const manualLoginService = new BandManualLoginService()
