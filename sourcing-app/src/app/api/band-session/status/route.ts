export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'
import { sessionManager } from '@/modules/band-playwright/band-session-manager'

/**
 * GET /api/band-session/status
 *
 * 소매밴드 채널의 세션 상태를 조회합니다.
 * 30분마다 클라이언트에서 호출하여 세션 만료를 감지합니다.
 *
 * Query Parameters:
 * - verify=true: 실제 Band 로그인 상태 확인 (느리지만 정확)
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const shouldVerify = searchParams.get('verify') === 'true'

    // 소매밴드(RETAIL)만 조회
    const channels = await prisma.channel.findMany({
      where: {
        userId: currentUser.userId,
        kind: 'RETAIL',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        bandSessionCookie: true,
        sessionExpiresAt: true,
      },
    })

    const now = new Date()

    // 같은 계정이므로 하나의 채널만 실제 검증하면 됨
    let sessionVerified = false
    let sessionActuallyValid: boolean | null = null
    let verifiedAt: string | null = null

    // 세션이 있는 첫 번째 채널로 검증
    if (shouldVerify) {
      const channelWithSession = channels.find((c) => c.bandSessionCookie)
      if (channelWithSession) {
        try {
          console.log(`[Band Session] Verifying session via channel ${channelWithSession.id}: ${channelWithSession.name}`)
          sessionActuallyValid = await sessionManager.testSession(channelWithSession.id)
          sessionVerified = true
          verifiedAt = new Date().toISOString()

          // 세션이 실제로 만료된 경우 모든 채널의 세션 무효화
          if (!sessionActuallyValid) {
            console.log('[Band Session] Session expired - invalidating all channels')
            for (const channel of channels) {
              if (channel.bandSessionCookie) {
                await sessionManager.invalidateSession(channel.id)
              }
            }
          }
        } catch (error: any) {
          console.error(`[Band Session] Verify failed:`, error.message)
        }
      }
    }

    // 각 채널의 세션 상태 확인
    const channelStatuses = channels.map((channel) => {
      const hasSession = !!channel.bandSessionCookie
      const expiresAt = channel.sessionExpiresAt
      let isValid = hasSession && expiresAt ? new Date(expiresAt) > now : false

      // 실제 검증 결과 적용 (세션 만료 시 모두 만료)
      if (sessionVerified && sessionActuallyValid === false) {
        isValid = false
      }

      // 만료까지 남은 시간 (분)
      let remainingMinutes: number | null = null
      if (hasSession && expiresAt && isValid) {
        const remaining = new Date(expiresAt).getTime() - now.getTime()
        remainingMinutes = Math.floor(remaining / (1000 * 60))
      }

      return {
        id: channel.id,
        name: channel.name,
        hasSession,
        isValid,
        expiresAt: expiresAt?.toISOString() || null,
        remainingMinutes,
        verifiedAt: sessionVerified ? verifiedAt : null,
      }
    })

    // 전체 요약
    const totalChannels = channels.length
    const validSessions = channelStatuses.filter((c) => c.isValid).length
    const expiredSessions = channelStatuses.filter((c) => c.hasSession && !c.isValid).length
    const noSessions = channelStatuses.filter((c) => !c.hasSession).length

    return NextResponse.json({
      success: true,
      summary: {
        total: totalChannels,
        valid: validSessions,
        expired: expiredSessions,
        none: noSessions,
        allValid: validSessions === totalChannels && totalChannels > 0,
      },
      channels: channelStatuses,
      checkedAt: now.toISOString(),
      verified: shouldVerify,
    })
  } catch (error: any) {
    console.error('[Band Session Status] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
