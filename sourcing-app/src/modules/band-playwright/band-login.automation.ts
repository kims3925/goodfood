/**
 * Band 로그인 자동화
 * 네이버 계정으로 Band에 로그인하고 세션 쿠키 추출
 */

import { Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { BandCredentials, BandLoginResult, BandPlaywrightError, BandPlaywrightErrorCode } from './types'

const NAVER_LOGIN_URL = 'https://nid.naver.com/nidlogin.login'
const BAND_SIGNIN_URL = 'https://band.us/signin'
const BAND_HOME_URL = 'https://band.us/home'
const LOGIN_TIMEOUT_MS = 30000
const DEBUG_SCREENSHOT_DIR = '/tmp/band-playwright-debug'

export class BandLoginAutomation {
  /**
   * 디버그 스크린샷 저장
   */
  private async saveDebugScreenshot(page: Page, name: string): Promise<void> {
    try {
      if (!fs.existsSync(DEBUG_SCREENSHOT_DIR)) {
        fs.mkdirSync(DEBUG_SCREENSHOT_DIR, { recursive: true })
      }
      const filepath = path.join(DEBUG_SCREENSHOT_DIR, `login-${name}-${Date.now()}.png`)
      await page.screenshot({ path: filepath, fullPage: true })
      console.log(`[BandLoginAutomation] Debug screenshot saved: ${filepath}`)
    } catch (error) {
      console.error('[BandLoginAutomation] Failed to save debug screenshot:', error)
    }
  }

  /**
   * 네이버 로그인 수행
   */
  async login(page: Page, credentials: BandCredentials): Promise<BandLoginResult> {
    const { naverId, naverPassword } = credentials

    try {
      console.log('[BandLoginAutomation] Starting login process')

      // 1. 네이버 로그인 페이지로 이동
      console.log('[BandLoginAutomation] Step 1: Navigating to Naver login page')
      await page.goto(NAVER_LOGIN_URL, {
        waitUntil: 'networkidle',
        timeout: LOGIN_TIMEOUT_MS,
      })

      await this.saveDebugScreenshot(page, 'step1-naver-login-page')

      // 2. 로그인 폼 대기
      await page.waitForSelector('#id', { timeout: 10000 })

      // 3. JavaScript 주입으로 아이디/비밀번호 입력 (복사방지 우회)
      console.log('[BandLoginAutomation] Step 2: Entering credentials')
      await page.evaluate(({ id, pw }) => {
        const idInput = document.querySelector('#id') as HTMLInputElement
        const pwInput = document.querySelector('#pw') as HTMLInputElement
        if (idInput) {
          idInput.value = id
          idInput.dispatchEvent(new Event('input', { bubbles: true }))
        }
        if (pwInput) {
          pwInput.value = pw
          pwInput.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }, { id: naverId, pw: naverPassword })

      // 약간의 딜레이 (보안 체크 우회)
      await page.waitForTimeout(500)

      await this.saveDebugScreenshot(page, 'step2-credentials-entered')

      // 4. 로그인 버튼 클릭
      console.log('[BandLoginAutomation] Step 3: Clicking login button')
      const loginButton = await page.$('#log\\.login, .btn_login, button[type="submit"]')
      if (loginButton) {
        await loginButton.click()
      } else {
        await this.saveDebugScreenshot(page, 'error-no-login-button')
        throw new BandPlaywrightError(
          '로그인 버튼을 찾을 수 없습니다.',
          BandPlaywrightErrorCode.LOGIN_FAILED
        )
      }

      // 5. 로그인 결과 대기
      await page.waitForTimeout(3000)

      await this.saveDebugScreenshot(page, 'step3-after-login-click')

      // CAPTCHA 체크
      const captchaElement = await page.$('#captcha, .captcha, [class*="captcha"]')
      if (captchaElement) {
        await this.saveDebugScreenshot(page, 'error-captcha')
        throw new BandPlaywrightError(
          'CAPTCHA 인증이 필요합니다. 직접 로그인해주세요.',
          BandPlaywrightErrorCode.CAPTCHA_REQUIRED
        )
      }

      // 추가 인증 화면 체크 (2단계 인증, 기기 인증 등)
      const additionalAuthSelectors = [
        '#new_device', // 새 기기 인증
        '.login_verify', // 2단계 인증
        '[class*="deviceAuth"]',
        '[class*="secondAuth"]',
      ]
      for (const selector of additionalAuthSelectors) {
        const authElement = await page.$(selector)
        if (authElement && await authElement.isVisible()) {
          await this.saveDebugScreenshot(page, 'error-additional-auth')
          throw new BandPlaywrightError(
            '추가 인증이 필요합니다. 직접 로그인해주세요.',
            BandPlaywrightErrorCode.LOGIN_FAILED
          )
        }
      }

      // 에러 메시지 체크
      const errorElement = await page.$('.error_message, #err_common, .err_message')
      if (errorElement) {
        const errorText = await errorElement.textContent()
        await this.saveDebugScreenshot(page, 'error-login-failed')
        throw new BandPlaywrightError(
          `로그인 실패: ${errorText || '아이디 또는 비밀번호를 확인해주세요.'}`,
          BandPlaywrightErrorCode.LOGIN_FAILED
        )
      }

      // 6. Band 홈으로 이동하여 세션 확인
      console.log('[BandLoginAutomation] Step 4: Navigating to Band home')
      await page.goto(BAND_HOME_URL, {
        waitUntil: 'networkidle',
        timeout: LOGIN_TIMEOUT_MS,
      })

      await this.saveDebugScreenshot(page, 'step4-band-home')

      // 7. 로그인 상태 확인
      const isLoggedIn = await this.checkLoginStatus(page)
      if (!isLoggedIn) {
        await this.saveDebugScreenshot(page, 'error-not-logged-in')
        throw new BandPlaywrightError(
          '로그인 실패: Band에 로그인되지 않았습니다.',
          BandPlaywrightErrorCode.LOGIN_FAILED
        )
      }

      // 8. 쿠키 추출
      const cookies = await this.extractCookies(page)
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14일

      console.log('[BandLoginAutomation] Login successful')
      await this.saveDebugScreenshot(page, 'success-logged-in')

      return {
        success: true,
        cookies,
        expiresAt,
      }
    } catch (error: any) {
      console.error('[BandLoginAutomation] Login failed:', error)
      await this.saveDebugScreenshot(page, 'error-exception')

      if (error instanceof BandPlaywrightError) {
        return { success: false, error: error.message }
      }

      return {
        success: false,
        error: error.message || '로그인 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * Band 로그인 상태 확인
   */
  private async checkLoginStatus(page: Page): Promise<boolean> {
    // 여러 가지 로그인 상태 표시 요소 확인
    const selectors = [
      '.profileImage',
      '.uPhoto',
      '[class*="profile"]',
      '[class*="myInfo"]',
      '.gnb_my',
    ]

    for (const selector of selectors) {
      const element = await page.$(selector)
      if (element) {
        return true
      }
    }

    // URL로 확인 (로그인 페이지로 리다이렉트되지 않았는지)
    const currentUrl = page.url()
    if (currentUrl.includes('band.us') && !currentUrl.includes('login')) {
      return true
    }

    return false
  }

  /**
   * 쿠키 추출 (도메인 정보 포함 JSON으로 저장)
   */
  private async extractCookies(page: Page): Promise<string> {
    const cookies = await page.context().cookies()

    // Band 관련 쿠키 필터링
    const bandCookies = cookies.filter(c =>
      c.domain.includes('band.us') ||
      c.domain.includes('naver.com') ||
      c.domain.includes('.band.us')
    )

    console.log(`[BandLoginAutomation] Extracted ${bandCookies.length} cookies`)

    // 쿠키를 JSON 배열로 저장 (도메인 정보 보존)
    return JSON.stringify(bandCookies)
  }

  /**
   * 세션 유효성 테스트
   */
  async testSession(page: Page): Promise<boolean> {
    try {
      await page.goto(BAND_HOME_URL, {
        waitUntil: 'networkidle',
        timeout: 15000,
      })

      return await this.checkLoginStatus(page)
    } catch (error) {
      console.error('[BandLoginAutomation] Session test failed:', error)
      return false
    }
  }
}

export const loginAutomation = new BandLoginAutomation()
