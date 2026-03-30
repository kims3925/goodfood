export const dynamic = 'force-dynamic'

/**
 * Automation Session Validate API
 * 자동화 파이프라인 실행 전 밴드 세션 유효성 검증
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { createSessionMissingNotification } from '@/services/notification.service'

interface ChannelSessionInfo {
  id: number
  name: string
  kind: 'WHOLESALE' | 'RETAIL'
  hasSession: boolean
  isExpired: boolean
  expiresAt: Date | null
}

/**
 * POST /api/automation/session/validate
 * 선택된 채널들의 밴드 세션 유효성 검증
 *
 * Request Body:
 * - wholesaleChannelIds?: number[] - 도매 채널 ID 목록
 * - retailChannelIds?: number[] - 소매 채널 ID 목록
 * - type?: 'collect' | 'publish' | 'full' - 검증 타입 (해당 타입에 필요한 채널만 검증)
 * - createNotification?: boolean - 세션 없을 때 알림 생성 여부 (기본 false)
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { wholesaleChannelIds, retailChannelIds, type, createNotification } = body

    // 자동화 설정에서 채널 ID 조회 (body에 없으면)
    let finalWholesaleIds: number[] = wholesaleChannelIds || []
    let finalRetailIds: number[] = retailChannelIds || []

    if (finalWholesaleIds.length === 0 || finalRetailIds.length === 0) {
      const automationConfig = await prisma.automationConfig.findUnique({
        where: { userId: currentUser.userId },
      })

      if (automationConfig) {
        if (finalWholesaleIds.length === 0 && automationConfig.channelIds) {
          try {
            finalWholesaleIds = JSON.parse(automationConfig.channelIds)
          } catch {
            finalWholesaleIds = []
          }
        }
        if (finalRetailIds.length === 0 && automationConfig.retailChannelIds) {
          try {
            finalRetailIds = JSON.parse(automationConfig.retailChannelIds)
          } catch {
            finalRetailIds = []
          }
        }
      }
    }

    // 소매채널(발행용)만 세션 검증 필요 (도매채널은 세션 불필요)
    let channelIdsToValidate: number[] = []
    if (type === 'publish' || type === 'full') {
      channelIdsToValidate = finalRetailIds
    }

    if (channelIdsToValidate.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          isValid: true,
          channels: [],
          invalidChannels: [],
          message: '검증할 채널이 없습니다.',
        },
      })
    }

    // 채널 정보 및 세션 상태 조회
    const channels = await prisma.channel.findMany({
      where: { id: { in: channelIdsToValidate } },
      select: {
        id: true,
        name: true,
        kind: true,
        bandSessionCookie: true,
        sessionExpiresAt: true,
      },
    })

    const now = new Date()
    const channelSessionInfos: ChannelSessionInfo[] = channels.map((channel) => {
      const hasSession = !!channel.bandSessionCookie
      // sessionExpiresAt이 null이면 만료일 없는 세션 쿠키 → 만료되지 않음
      const isExpired = channel.sessionExpiresAt
        ? new Date(channel.sessionExpiresAt) <= now
        : false

      return {
        id: channel.id,
        name: channel.name,
        kind: channel.kind as 'WHOLESALE' | 'RETAIL',
        hasSession,
        isExpired: hasSession ? isExpired : true,
        expiresAt: channel.sessionExpiresAt,
      }
    })

    // 세션이 없거나 만료된 채널 필터링
    const invalidChannels = channelSessionInfos.filter(
      (ch) => !ch.hasSession || ch.isExpired
    )

    const isValid = invalidChannels.length === 0

    // 세션이 없을 때 알림 생성
    if (!isValid && createNotification) {
      const channelNames = invalidChannels.map((ch) => ch.name).join(', ')
      await createSessionMissingNotification(currentUser.userId, {
        channelNames,
        channelCount: invalidChannels.length,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        isValid,
        channels: channelSessionInfos,
        invalidChannels,
        message: isValid
          ? '모든 채널의 세션이 유효합니다.'
          : `${invalidChannels.length}개 채널의 밴드 세션이 없거나 만료되었습니다.`,
      },
    })
  } catch (error) {
    console.error('세션 검증 실패:', error)
    return NextResponse.json(
      { success: false, error: '세션 검증에 실패했습니다.' },
      { status: 500 }
    )
  }
}
