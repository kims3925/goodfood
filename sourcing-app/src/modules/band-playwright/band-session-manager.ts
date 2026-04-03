/**
 * Band 세션 관리
 * DB에서 세션 조회/저장, 세션 유효성 확인, 자동 재로그인
 */

import prisma from '@bandauto/db'
import { browserPool } from './band-browser-pool'
import { BandSession, BandPlaywrightError, BandPlaywrightErrorCode } from './types'

export class BandSessionManager {
  /**
   * 유효한 세션 가져오기 (DB에서 쿠키 조회)
   */
  async getValidSession(channelId: number): Promise<BandSession | null> {
    // DB에서 채널의 세션 정보 조회
    const channel = await prisma.channel.findFirst({
      where: { id: channelId },
      select: {
        bandSessionCookie: true,
        sessionExpiresAt: true,
      },
    })

    if (!channel) {
      console.error(`[BandSessionManager] Channel ${channelId} not found`)
      return null
    }

    // 기존 세션 유효성 확인
    // bandSessionCookie가 존재하면 유효한 것으로 간주 (sessionExpiresAt는 보조 지표)
    if (channel.bandSessionCookie) {
      // sessionExpiresAt이 null이면 세션 쿠키 → 만료 체크 없이 유효로 처리
      if (!channel.sessionExpiresAt) {
        console.log(`[BandSessionManager] Using session cookie (no expiry) for channel ${channelId}`)
        return {
          cookies: channel.bandSessionCookie,
          expiresAt: null,
          isValid: true,
        }
      }

      const now = new Date()

      // sessionExpiresAt이 있고 만료된 경우에만 무효로 처리
      if (channel.sessionExpiresAt) {
        const expiresAt = new Date(channel.sessionExpiresAt)
        if (expiresAt <= now) {
          console.error(`[BandSessionManager] Session expired for channel ${channelId} (expired at ${expiresAt.toISOString()})`)
          throw new BandPlaywrightError(
            '세션이 만료되었습니다. 채널 설정에서 쿠키를 다시 등록해주세요.',
            BandPlaywrightErrorCode.SESSION_EXPIRED
          )
        }
      }

      // sessionExpiresAt이 null이거나 아직 만료 전인 경우 - 유효한 세션으로 처리
      console.log(`[BandSessionManager] Using existing session for channel ${channelId}${channel.sessionExpiresAt ? '' : ' (no expiry set)'}`)
      return {
        cookies: channel.bandSessionCookie,
        expiresAt: channel.sessionExpiresAt ? new Date(channel.sessionExpiresAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 만료일 없으면 14일 후로 설정
        isValid: true,
      }
    }

    // 세션 없음
    console.error(`[BandSessionManager] No session cookie for channel ${channelId}`)
    throw new BandPlaywrightError(
      '세션이 없습니다. 채널 설정에서 쿠키를 등록해주세요.',
      BandPlaywrightErrorCode.SESSION_EXPIRED
    )
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
  async saveSession(
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
   * 세션 테스트 (실제로 로그인되어 있는지 확인)
   */
  async testSession(channelId: number): Promise<boolean> {
    try {
      const session = await this.getValidSession(channelId)
      if (!session) {
        return false
      }

      const context = await browserPool.getContext(channelId, session.cookies)
      const page = await context.newPage()

      try {
        await page.goto('https://band.us/home', { waitUntil: 'networkidle', timeout: 15000 })
        const currentUrl = page.url()
        const isValid = currentUrl.includes('band.us') && !currentUrl.includes('login')

        if (!isValid) {
          await this.invalidateSession(channelId)
        }
        return isValid
      } finally {
        await page.close()
        await browserPool.releaseContext(channelId)
      }
    } catch (error) {
      console.error(`[BandSessionManager] Session test failed for channel ${channelId}:`, error)
      return false
    }
  }
}

export const sessionManager = new BandSessionManager()
