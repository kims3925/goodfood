/**
 * Band Browser Pool
 * Playwright 브라우저 인스턴스와 컨텍스트를 관리
 */

import { chromium, Browser, BrowserContext, Cookie } from 'playwright'

// 컨텍스트 TTL (30분)
const CONTEXT_TTL_MS = 30 * 60 * 1000
// 최대 컨텍스트 수
const MAX_CONTEXTS = 5

interface ContextInfo {
  context: BrowserContext
  lastUsed: Date
  channelId: number
}

class BandBrowserPool {
  private browser: Browser | null = null
  private contexts: Map<number, ContextInfo> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // 5분마다 만료된 컨텍스트 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredContexts()
    }, 5 * 60 * 1000)
  }

  /**
   * 브라우저 인스턴스 가져오기 (없으면 생성)
   */
  async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('[BandBrowserPool] Launching new browser instance')
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      })
    }
    return this.browser
  }

  /**
   * 채널별 브라우저 컨텍스트 가져오기
   */
  async getContext(channelId: number, cookies?: string): Promise<BrowserContext> {
    // 기존 컨텍스트가 있고 유효하면 재사용
    const existing = this.contexts.get(channelId)
    if (existing) {
      const age = Date.now() - existing.lastUsed.getTime()
      if (age < CONTEXT_TTL_MS) {
        existing.lastUsed = new Date()
        console.log(`[BandBrowserPool] Reusing context for channel ${channelId}`)
        return existing.context
      } else {
        // 만료된 컨텍스트 삭제
        await this.closeContext(channelId)
      }
    }

    // 컨텍스트 수 제한 확인
    if (this.contexts.size >= MAX_CONTEXTS) {
      await this.evictOldestContext()
    }

    // 새 컨텍스트 생성
    const browser = await this.getBrowser()
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ko-KR',
    })

    // 쿠키 설정
    if (cookies) {
      const parsedCookies = this.parseCookies(cookies)
      await context.addCookies(parsedCookies)
    }

    this.contexts.set(channelId, {
      context,
      lastUsed: new Date(),
      channelId,
    })

    console.log(`[BandBrowserPool] Created new context for channel ${channelId}`)
    return context
  }

  /**
   * 컨텍스트 사용 완료 표시 (즉시 삭제하지 않음)
   */
  async releaseContext(channelId: number): Promise<void> {
    const info = this.contexts.get(channelId)
    if (info) {
      info.lastUsed = new Date()
    }
  }

  /**
   * 특정 채널의 컨텍스트 닫기
   */
  async closeContext(channelId: number): Promise<void> {
    const info = this.contexts.get(channelId)
    if (info) {
      try {
        await info.context.close()
      } catch (error) {
        console.error(`[BandBrowserPool] Error closing context for channel ${channelId}:`, error)
      }
      this.contexts.delete(channelId)
    }
  }

  /**
   * 가장 오래된 컨텍스트 제거
   */
  private async evictOldestContext(): Promise<void> {
    let oldest: ContextInfo | null = null
    let oldestId: number | null = null

    for (const [id, info] of this.contexts) {
      if (!oldest || info.lastUsed < oldest.lastUsed) {
        oldest = info
        oldestId = id
      }
    }

    if (oldestId !== null) {
      console.log(`[BandBrowserPool] Evicting oldest context: channel ${oldestId}`)
      await this.closeContext(oldestId)
    }
  }

  /**
   * 만료된 컨텍스트 정리
   */
  private async cleanupExpiredContexts(): Promise<void> {
    const now = Date.now()
    const toRemove: number[] = []

    for (const [id, info] of this.contexts) {
      if (now - info.lastUsed.getTime() > CONTEXT_TTL_MS) {
        toRemove.push(id)
      }
    }

    for (const id of toRemove) {
      console.log(`[BandBrowserPool] Cleaning up expired context: channel ${id}`)
      await this.closeContext(id)
    }
  }

  /**
   * 쿠키 문자열 파싱
   * JSON 배열 형식 지원 (Playwright 형식 및 cookieStore.getAll() 형식 모두 지원)
   */
  private parseCookies(cookieString: string): Cookie[] {
    // JSON 형식인지 확인
    if (cookieString.startsWith('[')) {
      try {
        const parsed = JSON.parse(cookieString) as any[]

        // cookieStore.getAll() 형식인지 확인 (domain이 점으로 시작 안 함)
        const needsConversion = parsed.some(c => c.domain && !c.domain.startsWith('.') && !c.domain.startsWith('auth') && !c.domain.startsWith('www'))

        if (needsConversion) {
          console.log(`[BandBrowserPool] Converting cookieStore format to Playwright format`)
          // cookieStore 형식을 Playwright 형식으로 변환 + 필요한 도메인 추가
          const convertedCookies: Cookie[] = []

          for (const c of parsed) {
            // 도메인 정규화 (band.us -> .band.us)
            let domain = c.domain || '.band.us'
            if (domain === 'band.us') {
              domain = '.band.us'
            }

            // expires 변환 (밀리초 -> 초, null -> -1)
            let expires = -1
            if (c.expires && typeof c.expires === 'number') {
              // 밀리초인 경우 (1799217375909 같은 큰 숫자)
              expires = c.expires > 9999999999 ? Math.floor(c.expires / 1000) : c.expires
            }

            // sameSite 변환 (소문자 -> 첫글자 대문자)
            let sameSite: 'Strict' | 'Lax' | 'None' = 'Lax'
            if (c.sameSite) {
              const s = c.sameSite.toLowerCase()
              if (s === 'strict') sameSite = 'Strict'
              else if (s === 'none') sameSite = 'None'
              else sameSite = 'Lax'
            }

            const baseCookie = {
              name: c.name,
              value: c.value,
              path: c.path || '/',
              expires,
              httpOnly: c.httpOnly || false,
              secure: c.secure || false,
              sameSite,
            }

            // .band.us 도메인
            convertedCookies.push({ ...baseCookie, domain: '.band.us' })

            // auth.band.us 도메인 (인증에 필수)
            convertedCookies.push({ ...baseCookie, domain: 'auth.band.us' })

            // .auth.band.us 도메인
            convertedCookies.push({ ...baseCookie, domain: '.auth.band.us' })

            // www.band.us 도메인
            convertedCookies.push({ ...baseCookie, domain: 'www.band.us' })

            // nid.naver.com 도메인 (네이버 로그인 세션)
            convertedCookies.push({ ...baseCookie, domain: '.nid.naver.com' })

            // .naver.com 도메인 (네이버 인증)
            convertedCookies.push({ ...baseCookie, domain: '.naver.com' })
          }

          console.log(`[BandBrowserPool] Converted ${parsed.length} cookies to ${convertedCookies.length} cookies (added all required domains)`)
          return convertedCookies
        }

        console.log(`[BandBrowserPool] Parsed ${parsed.length} cookies from JSON (Playwright format)`)
        return parsed as Cookie[]
      } catch (e) {
        console.error('[BandBrowserPool] Failed to parse cookies as JSON:', e)
      }
    }

    // 레거시 형식: "name=value; name2=value2"
    const naverCookieNames = [
      'NID', 'NID_SES', 'NID_AUT', 'NID_JKL', 'NNB', 'nid_inf', 'NACT',
      'JSESSIONID', 'PM_CK_loc', 'page_uid', '_ga_', '_gid'
    ]

    const cookies: Cookie[] = []
    const pairs = cookieString.split('; ')

    for (const pair of pairs) {
      const [name, ...valueParts] = pair.split('=')
      const cookieName = name.trim()
      const cookieValue = valueParts.join('=')

      if (!cookieName || !cookieValue) continue

      // 네이버 쿠키인지 확인
      const isNaverCookie = naverCookieNames.some(n =>
        cookieName.startsWith(n) || cookieName.includes('naver')
      )

      // Band 도메인 (.band.us)
      cookies.push({
        name: cookieName,
        value: cookieValue,
        domain: '.band.us',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: true,
        sameSite: 'Lax' as const,
      })

      // Band 인증 도메인 (auth.band.us) - 로그인 유지에 필수
      cookies.push({
        name: cookieName,
        value: cookieValue,
        domain: 'auth.band.us',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: true,
        sameSite: 'Lax' as const,
      })

      // Naver 도메인 (인증 관련 쿠키만)
      if (isNaverCookie) {
        cookies.push({
          name: cookieName,
          value: cookieValue,
          domain: '.naver.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: true,
          sameSite: 'Lax' as const,
        })
      }
    }

    console.log(`[BandBrowserPool] Parsed ${cookies.length} cookies from legacy string (including auth.band.us)`)
    return cookies
  }

  /**
   * 브라우저 예열 (배치 발행 전)
   */
  async warmUp(): Promise<void> {
    await this.getBrowser()
  }

  /**
   * 모든 리소스 정리
   */
  async cleanup(): Promise<void> {
    console.log('[BandBrowserPool] Cleaning up all resources')

    // cleanup interval 중지
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    // 모든 컨텍스트 닫기
    for (const [id] of this.contexts) {
      await this.closeContext(id)
    }

    // 브라우저 닫기
    if (this.browser) {
      try {
        await this.browser.close()
      } catch (error) {
        console.error('[BandBrowserPool] Error closing browser:', error)
      }
      this.browser = null
    }
  }
}

// 싱글톤 인스턴스
export const browserPool = new BandBrowserPool()

// 프로세스 종료 시 정리
process.on('beforeExit', async () => {
  await browserPool.cleanup()
})
