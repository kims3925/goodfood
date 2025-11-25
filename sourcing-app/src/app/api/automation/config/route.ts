/**
 * Automation Config API
 * 자동화 설정 CRUD
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { CRON_EXPRESSIONS, CronInterval, updateScheduler } from '@/modules/automation'

const prisma = new PrismaClient()

/**
 * GET /api/automation/config
 * 자동화 설정 조회
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const config = await prisma.automationConfig.findUnique({
      where: { userId: currentUser.userId },
      include: {
        pricingPolicy: {
          select: { id: true, name: true, content: true },
        },
      },
    })

    // 설정이 없으면 기본값 반환
    if (!config) {
      return NextResponse.json({
        success: true,
        data: {
          isEnabled: false,
          cronInterval: '1h' as CronInterval,
          collectFromAllBands: true,
          wholesaleBandIds: [],
          aiProvider: 'GEMINI',
          pricingPolicyId: null,
          autoPublish: false,
          retailBandIds: [],
          lastRunAt: null,
          nextRunAt: null,
        },
      })
    }

    // cronExpression에서 interval 추출
    const cronInterval = getCronIntervalFromExpression(config.cronExpression)

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        cronInterval,
        wholesaleBandIds: config.wholesaleBandIds || [],
        retailBandIds: config.retailBandIds || [],
      },
    })
  } catch (error) {
    console.error('자동화 설정 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/automation/config
 * 자동화 설정 생성/업데이트
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
    const {
      isEnabled,
      cronInterval,
      collectFromAllBands,
      wholesaleBandIds,
      aiProvider,
      pricingPolicyId,
      autoPublish,
      retailBandIds,
    } = body

    // cronInterval을 cronExpression으로 변환
    const cronExpression = cronInterval ? CRON_EXPRESSIONS[cronInterval as CronInterval] : null

    // 다음 실행 시간 계산
    let nextRunAt = null
    if (isEnabled && cronExpression) {
      nextRunAt = calculateNextRunTime(cronExpression)
    }

    const config = await prisma.automationConfig.upsert({
      where: { userId: currentUser.userId },
      create: {
        userId: currentUser.userId,
        isEnabled: isEnabled ?? false,
        cronExpression,
        collectFromAllBands: collectFromAllBands ?? true,
        wholesaleBandIds: wholesaleBandIds || [],
        aiProvider: aiProvider || 'GEMINI',
        pricingPolicyId: pricingPolicyId || null,
        autoPublish: autoPublish ?? false,
        retailBandIds: retailBandIds || [],
        nextRunAt,
      },
      update: {
        isEnabled: isEnabled ?? false,
        cronExpression,
        collectFromAllBands: collectFromAllBands ?? true,
        wholesaleBandIds: wholesaleBandIds || [],
        aiProvider: aiProvider || 'GEMINI',
        pricingPolicyId: pricingPolicyId || null,
        autoPublish: autoPublish ?? false,
        retailBandIds: retailBandIds || [],
        nextRunAt,
      },
    })

    // 스케줄러 업데이트
    await updateScheduler(currentUser.userId)

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        cronInterval: cronInterval || '1h',
      },
    })
  } catch (error) {
    console.error('자동화 설정 저장 실패:', error)
    return NextResponse.json(
      { success: false, error: '설정 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/automation/config
 * 자동화 설정 삭제
 */
export async function DELETE() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    await prisma.automationConfig.delete({
      where: { userId: currentUser.userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('자동화 설정 삭제 실패:', error)
    return NextResponse.json(
      { success: false, error: '설정 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// Helper functions
function getCronIntervalFromExpression(expression: string | null): CronInterval {
  if (!expression) return '1h'

  for (const [interval, cron] of Object.entries(CRON_EXPRESSIONS)) {
    if (cron === expression) {
      return interval as CronInterval
    }
  }
  return '1h'
}

function calculateNextRunTime(cronExpression: string): Date {
  const now = new Date()
  const parts = cronExpression.split(' ')

  if (parts.length !== 5) {
    return new Date(now.getTime() + 60 * 60 * 1000)
  }

  const [minute, hour] = parts

  // 매 시간 실행
  if (minute === '0' && hour === '*') {
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    next.setHours(next.getHours() + 1)
    return next
  }

  // N시간마다
  if (minute === '0' && hour.startsWith('*/')) {
    const interval = parseInt(hour.substring(2))
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    const currentHour = next.getHours()
    const nextHour = Math.ceil((currentHour + 1) / interval) * interval
    next.setHours(nextHour)
    return next
  }

  // 매일 특정 시간
  if (minute === '0' && !isNaN(parseInt(hour))) {
    const targetHour = parseInt(hour)
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    next.setHours(targetHour)
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }
    return next
  }

  return new Date(now.getTime() + 60 * 60 * 1000)
}
