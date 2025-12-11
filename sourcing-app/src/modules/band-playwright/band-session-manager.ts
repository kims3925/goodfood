/**
 * Band 세션 관리
 * DB에서 세션 조회/저장, 세션 유효성 확인, 자동 재로그인
 */

import prisma from '@bandauto/db'
import { browserPool } from './band-browser-pool'
import { loginAutomation } from './band-login.automation'
import { BandSession, BandCredentials, BandPlaywrightError, BandPlaywrightErrorCode } from './types'

// 세션 유효 기간 (14일)
const SESSION_EXPIRY_DAYS = 14
// 갱신 시작 시점 (만료 24시간 전)
const REFRESH_BEFORE_HOURS = 24

export class BandSessionManager {
  /**
   * 유효한 세션 가져오기 (없거나 만료되면 재로그인)
   */
  async getValidSession(
    channelId: number,
    credentials?: BandCredentials
  ): Promise<BandSession | null> {
    // 1. DB에서 채널의 세션 정보 조회
    const channel = await prisma.channel.findFirst({
      where: { id: channelId },
      select: {
        bandSessionCookie: true,
        sessionExpiresAt: true,
        naverId: true,
        naverPassword: true,
      },
    })

    if (!channel) {
      console.error(`[BandSessionManager] Channel ${channelId} not found`)
      return null
    }

    // 2. 기존 세션 유효성 확인
    if (channel.bandSessionCookie && channel.sessionExpiresAt) {
      const now = new Date()
      const expiresAt = new Date(channel.sessionExpiresAt)

      if (expiresAt > now) {
        // 갱신 필요 여부 확인 (만료 24시간 전)
        const refreshThreshold = new Date(
          expiresAt.getTime() - REFRESH_BEFORE_HOURS * 60 * 60 * 1000
        )

        // 아직 유효하면 기존 세션 반환
        console.log(`[BandSessionManager] Using existing session for channel ${channelId}`)

        // 갱신 필요하면 백그라운드에서 갱신
        if (now > refreshThreshold) {
          const creds = credentials || this.getCredentialsFromChannel(channel)
          if (creds) {
            this.refreshSessionBackground(channelId, creds).catch(console.error)
          }
        }

        return {
          cookies: channel.bandSessionCookie,
          expiresAt,
          isValid: true,
        }
      }
    }

    // 3. 세션 없거나 만료됨 -> 새 로그인 필요
    const creds = credentials || this.getCredentialsFromChannel(channel)
    if (!creds) {
      console.error(`[BandSessionManager] No credentials for channel ${channelId}`)
      throw new BandPlaywrightError(
        '네이버 계정 정보가 설정되지 않았습니다. 채널 설정에서 네이버 ID/비밀번호를 입력해주세요.',
        BandPlaywrightErrorCode.LOGIN_FAILED
      )
    }

    // 자동 로그인 시도
    console.log(`[BandSessionManager] No valid session, attempting auto-login for channel ${channelId}`)
    return this.acquireNewSession(channelId, creds)
  }

  /**
   * 새 세션 획득 (Playwright 로그인)
   */
  async acquireNewSession(
    channelId: number,
    credentials: BandCredentials
  ): Promise<BandSession | null> {
    console.log(`[BandSessionManager] Acquiring new session for channel ${channelId}`)

    const browser = await browserPool.getBrowser()
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      locale: 'ko-KR',
    })
    const page = await context.newPage()

    try {
      const result = await loginAutomation.login(page, credentials)

      if (!result.success || !result.cookies) {
        throw new BandPlaywrightError(
          result.error || '로그인 실패',
          BandPlaywrightErrorCode.LOGIN_FAILED
        )
      }

      // DB에 세션 저장
      await this.saveSession(channelId, result.cookies, result.expiresAt!)

      return {
        cookies: result.cookies,
        expiresAt: result.expiresAt!,
        isValid: true,
      }
    } catch (error) {
      console.error(`[BandSessionManager] Failed to acquire session for channel ${channelId}:`, error)
      throw error
    } finally {
      await context.close()
    }
  }

  /**
   * 세션 무효화
   */
  async invalidateSession(channelId: number): Promise<void> {
    console.log(`[BandSessionManager] Invalidating session for channel ${channelId}`)

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        bandSessionCookie: null,
        sessionExpiresAt: null,
      },
    })

    // 브라우저 컨텍스트도 정리
    await browserPool.closeContext(channelId)
  }

  /**
   * 세션 저장
   */
  private async saveSession(
    channelId: number,
    cookies: string,
    expiresAt: Date
  ): Promise<void> {
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        bandSessionCookie: cookies,
        sessionExpiresAt: expiresAt,
      },
    })

    console.log(`[BandSessionManager] Session saved for channel ${channelId}`)
  }

  /**
   * 백그라운드에서 세션 갱신
   */
  private async refreshSessionBackground(
    channelId: number,
    credentials: BandCredentials
  ): Promise<void> {
    console.log(`[BandSessionManager] Refreshing session in background for channel ${channelId}`)

    try {
      await this.acquireNewSession(channelId, credentials)
      console.log(`[BandSessionManager] Session refreshed for channel ${channelId}`)
    } catch (error) {
      console.error(`[BandSessionManager] Background refresh failed for channel ${channelId}:`, error)
    }
  }

  /**
   * 채널 정보에서 자격증명 추출
   */
  private getCredentialsFromChannel(channel: {
    naverId: string | null
    naverPassword: string | null
  }): BandCredentials | null {
    if (channel.naverId && channel.naverPassword) {
      return {
        naverId: channel.naverId,
        naverPassword: channel.naverPassword,
      }
    }
    return null
  }

  /**
   * 세션 테스트 (실제로 로그인되어 있는지 확인)
   */
  async testSession(channelId: number): Promise<boolean> {
    const session = await this.getValidSession(channelId)
    if (!session) {
      return false
    }

    const context = await browserPool.getContext(channelId, session.cookies)
    const page = await context.newPage()

    try {
      const isValid = await loginAutomation.testSession(page)
      if (!isValid) {
        await this.invalidateSession(channelId)
      }
      return isValid
    } finally {
      await page.close()
      await browserPool.releaseContext(channelId)
    }
  }
}

export const sessionManager = new BandSessionManager()
