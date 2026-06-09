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
        sessionAccountEmail: true,
      },
    })

    const now = new Date()

    // 계정별 검증 (2026-06-10): 매니저별로 밴드 계정이 다를 수 있으므로
    // sessionAccountEmail 값별로 그룹핑해 계정당 1개 채널씩만 실제 검증.
    // (같은 계정의 세션은 동일 쿠키이므로 그룹 대표 1개로 충분.
    //  구버전 저장분 null 은 '(unknown)' 그룹으로 묶어 기존처럼 1회 검증.)
    let sessionVerified = false
    let verifiedAt: string | null = null
    const verifyResultByAccount = new Map<string, boolean>()

    if (shouldVerify) {
      const byAccount = new Map<string, (typeof channels)[number]>()
      for (const c of channels) {
        if (!c.bandSessionCookie) continue
        const key = c.sessionAccountEmail ?? '(unknown)'
        if (!byAccount.has(key)) byAccount.set(key, c)
      }
      for (const [account, channel] of Array.from(byAccount.entries())) {
        try {
          console.log(`[Band Session] Verifying session account=${account} via channel ${channel.id}: ${channel.name}`)
          const valid = await sessionManager.testSession(channel.id)
          verifyResultByAccount.set(account, valid)
          sessionVerified = true
          verifiedAt = new Date().toISOString()
          // 세션 무효화는 testSession 내부에서 해당 채널에 대해서만 처리
        } catch (error: any) {
          console.error(`[Band Session] Verify failed (account=${account}):`, error.message)
        }
      }
    }

    // 각 채널의 세션 상태 확인
    const channelStatuses = channels.map((channel) => {
      const hasSession = !!channel.bandSessionCookie
      const expiresAt = channel.sessionExpiresAt
      // 쿠키가 있으면 유효한 것으로 간주 (sessionExpiresAt는 보조 지표)
      // - sessionExpiresAt이 null인 경우에도 쿠키가 있으면 유효 (배포 시점 차이로 null일 수 있음)
      // - sessionExpiresAt이 있고 만료된 경우에만 무효로 처리
      let isValid = hasSession && (expiresAt === null || new Date(expiresAt) > now)

      // 실제 검증 결과 적용 — 같은 계정 그룹의 채널만 만료 처리
      const accountKey = channel.sessionAccountEmail ?? '(unknown)'
      if (sessionVerified && verifyResultByAccount.get(accountKey) === false) {
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
        sessionAccountEmail: channel.sessionAccountEmail,
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
