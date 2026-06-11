export const dynamic = 'force-dynamic'

/**
 * Automation Config API
 * 자동화 설정 CRUD
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { CRON_EXPRESSIONS, CronInterval, updateScheduler, selectedHoursToCron, cronToSelectedHours, scheduleTimesToCrons, cronsToScheduleTimes } from '@/modules/automation'

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
    })

    // 설정이 없으면 기본값 반환
    if (!config) {
      // 활성화된 AI 설정에서 provider 조회
      const activeAiConfig = await prisma.aiApiConfig.findFirst({
        where: { userId: currentUser.userId, isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { provider: true },
      })
      const defaultAiProvider = activeAiConfig?.provider || 'GEMINI'

      return NextResponse.json({
        success: true,
        data: {
          isEnabled: false,
          cronInterval: '1h' as CronInterval,
          scheduleTimes: [],
          selectedHours: [],
          channelIds: [],
          wholesaleChannelIds: [],
          retailChannelIds: [],
          aiProvider: defaultAiProvider,
          lastRunAt: null,
          nextRunAt: null,
          shopIds: [],
          pipelineSteps: {
            collection: true,
            transform: true,
            productCreate: true,
            publish: true,
          },
          collectionLimit: 10,
          publishTarget: 'BOTH',
        },
      })
    }

    // cronExpression에서 interval 추출
    const cronInterval = getCronIntervalFromExpression(config.cronExpression)

    // cronExpression에서 scheduleTimes, selectedHours 추출
    const scheduleTimes = cronsToScheduleTimes(config.cronExpression)
    const selectedHours = cronToSelectedHours(config.cronExpression)

    // Parse JSON strings back to arrays/objects
    let channelIds: number[] = []
    let retailChannelIds: number[] = []
    let shopIds: number[] = []
    let pipelineSteps: { collection: boolean; transform: boolean; productCreate: boolean; publish: boolean } = {
      collection: true,
      transform: true,
      productCreate: true,
      publish: true,
    }
    let collectionLimitByChannel: Record<number, number> = {}
    let autoPublishLimitByShop: Record<number, number> = {}
    let autoPublishLimitByChannel: Record<number, number> = {}
    try {
      channelIds = config.channelIds ? JSON.parse(config.channelIds) : []
    } catch { channelIds = [] }
    try {
      retailChannelIds = config.retailChannelIds ? JSON.parse(config.retailChannelIds) : []
    } catch { retailChannelIds = [] }
    try {
      shopIds = config.shopIds ? JSON.parse(config.shopIds) : []
    } catch { shopIds = [] }
    try {
      pipelineSteps = config.pipelineSteps ? JSON.parse(config.pipelineSteps) : pipelineSteps
    } catch { /* use default */ }
    try {
      collectionLimitByChannel = config.collectionLimitByChannel ? JSON.parse(config.collectionLimitByChannel) : {}
    } catch { collectionLimitByChannel = {} }
    try {
      autoPublishLimitByShop = config.autoPublishLimitByShop ? JSON.parse(config.autoPublishLimitByShop) : {}
    } catch { autoPublishLimitByShop = {} }
    try {
      autoPublishLimitByChannel = config.autoPublishLimitByChannel ? JSON.parse(config.autoPublishLimitByChannel) : {}
    } catch { autoPublishLimitByChannel = {} }

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        cronInterval,
        scheduleTimes,
        selectedHours,
        channelIds,
        wholesaleChannelIds: channelIds,
        retailChannelIds,
        shopIds,
        pipelineSteps,
        collectionLimit: config.collectionLimit ?? 10,
        collectionLimitByChannel,
        autoPublishLimit: config.autoPublishLimit ?? 20,
        autoPublishLimitByShop,
        autoPublishLimitByChannel,
        // 종합발행 설정 (DB 마이그레이션 전이면 기본값 반환)
        digestMode: (config as any).digestMode ?? 'individual',
        digestProductsPerPost: (config as any).digestProductsPerPost ?? 20,
        digestImagesPerProduct: (config as any).digestImagesPerProduct ?? 1,
        // 발행 타깃 (B2B 공급몰 전환 STEP 1-1)
        publishTarget: (config as any).publishTarget ?? 'BOTH',
      },
    })
  } catch (error: any) {
    console.error('자동화 설정 조회 실패:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack?.split('\n').slice(0, 5),
    })
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
      scheduleTimes,
      selectedHours,
      channelIds,
      wholesaleChannelIds,
      aiProvider,
      retailChannelIds,
      shopIds,
      pipelineSteps,
      collectionLimit,
      collectionLimitByChannel,
      autoPublishLimit,
      autoPublishLimitByShop,
      autoPublishLimitByChannel,
      digestMode,
      digestProductsPerPost,
      digestImagesPerProduct,
      bandPublishMethod,
      publishTarget,
    } = body

    // 발행 타깃 (STEP 1-1) — 'SHOP_ONLY' | 'BAND_ONLY' | 'BOTH' 만 허용. 미전달 시 변경 없음(undefined).
    const validPublishTargets = ['SHOP_ONLY', 'BAND_ONLY', 'BOTH']
    const finalPublishTarget: string | undefined = validPublishTargets.includes(publishTarget)
      ? publishTarget
      : undefined

    // 밴드 발행 방식 전체 스위치 — 'CROSSPOST' | 'COMPOSE' 만 허용. 미전달 시 변경 없음(undefined).
    const finalBandPublishMethod: 'COMPOSE' | 'CROSSPOST' | undefined =
      bandPublishMethod === 'CROSSPOST' ? 'CROSSPOST'
        : bandPublishMethod === 'COMPOSE' ? 'COMPOSE'
          : undefined

    // 종합발행 설정 검증/기본값
    const validDigestModes = ['individual', 'digest', 'both']
    const finalDigestMode = validDigestModes.includes(digestMode) ? digestMode : 'individual'
    const finalDigestProductsPerPost = typeof digestProductsPerPost === 'number' && digestProductsPerPost > 0
      ? Math.min(digestProductsPerPost, 20)
      : 20
    const finalDigestImagesPerProduct = [1, 2, 4].includes(digestImagesPerProduct) ? digestImagesPerProduct : 1

    // wholesaleChannelIds 또는 channelIds 둘 다 지원 (하위 호환성)
    const finalChannelIds = wholesaleChannelIds || channelIds || []
    const finalRetailChannelIds = retailChannelIds || []
    const finalShopIds = shopIds || []
    const finalPipelineSteps = pipelineSteps || {
      collection: true,
      transform: true,
      productCreate: true,
      publish: true,
    }
    const finalCollectionLimit = typeof collectionLimit === 'number' ? collectionLimit : 10
    const finalCollectionLimitByChannel = collectionLimitByChannel && typeof collectionLimitByChannel === 'object' ? collectionLimitByChannel : {}
    const finalAutoPublishLimit = typeof autoPublishLimit === 'number' ? autoPublishLimit : 20
    const finalAutoPublishLimitByShop = autoPublishLimitByShop && typeof autoPublishLimitByShop === 'object' ? autoPublishLimitByShop : {}
    const finalAutoPublishLimitByChannel = autoPublishLimitByChannel && typeof autoPublishLimitByChannel === 'object' ? autoPublishLimitByChannel : {}

    // scheduleTimes 우선, 없으면 selectedHours 하위 호환, 없으면 cronInterval
    let cronExpression: string | null = null
    if (scheduleTimes && Array.isArray(scheduleTimes) && scheduleTimes.length > 0) {
      cronExpression = scheduleTimesToCrons(scheduleTimes)
    } else if (selectedHours && Array.isArray(selectedHours) && selectedHours.length > 0) {
      cronExpression = selectedHoursToCron(selectedHours)
    } else if (cronInterval) {
      cronExpression = CRON_EXPRESSIONS[cronInterval as CronInterval] || null
    }

    // 다음 실행 시간 계산
    let nextRunAt = null
    if (isEnabled && cronExpression) {
      nextRunAt = calculateNextRunTime(cronExpression)
    }

    // 기본 필드로 upsert (DB 컬럼이 확실히 존재하는 필드만)
    const config = await prisma.automationConfig.upsert({
      where: { userId: currentUser.userId },
      create: {
        userId: currentUser.userId,
        isEnabled: isEnabled ?? false,
        cronExpression,
        channelIds: JSON.stringify(finalChannelIds),
        aiProvider: aiProvider || 'GEMINI',
        retailChannelIds: JSON.stringify(finalRetailChannelIds),
        shopIds: JSON.stringify(finalShopIds),
        pipelineSteps: JSON.stringify(finalPipelineSteps),
        collectionLimit: finalCollectionLimit,
        nextRunAt,
      },
      update: {
        isEnabled: isEnabled ?? false,
        cronExpression,
        channelIds: JSON.stringify(finalChannelIds),
        aiProvider: aiProvider || 'GEMINI',
        retailChannelIds: JSON.stringify(finalRetailChannelIds),
        shopIds: JSON.stringify(finalShopIds),
        pipelineSteps: JSON.stringify(finalPipelineSteps),
        collectionLimit: finalCollectionLimit,
        nextRunAt,
      },
    })

    // 신규 컬럼 별도 업데이트 (DB 마이그레이션 미적용 환경 대응)
    try {
      await prisma.automationConfig.update({
        where: { userId: currentUser.userId },
        data: {
          collectionLimitByChannel: JSON.stringify(finalCollectionLimitByChannel),
          autoPublishLimit: finalAutoPublishLimit,
          autoPublishLimitByShop: JSON.stringify(finalAutoPublishLimitByShop),
          autoPublishLimitByChannel: JSON.stringify(finalAutoPublishLimitByChannel),
        },
      })
    } catch (e: any) {
      console.warn('[AutomationConfig] 신규 컬럼 업데이트 실패 (DB 마이그레이션 필요):', e?.message)
    }

    // 종합발행 컬럼 별도 업데이트 (DB 마이그레이션 미적용 환경 대응)
    try {
      await prisma.automationConfig.update({
        where: { userId: currentUser.userId },
        data: {
          digestMode: finalDigestMode,
          digestProductsPerPost: finalDigestProductsPerPost,
          digestImagesPerProduct: finalDigestImagesPerProduct,
        } as any,
      })
    } catch (e: any) {
      console.warn('[AutomationConfig] digest 컬럼 업데이트 실패 (DB 마이그레이션 필요):', e?.message)
    }

    // 발행 타깃 컬럼 별도 업데이트 (DB 마이그레이션 미적용 환경 대응) — 명시 전달된 경우에만 적용
    if (finalPublishTarget) {
      try {
        await prisma.automationConfig.update({
          where: { userId: currentUser.userId },
          data: { publishTarget: finalPublishTarget } as any,
        })
      } catch (e: any) {
        console.warn('[AutomationConfig] publishTarget 컬럼 업데이트 실패 (DB 마이그레이션 필요):', e?.message)
      }
    }

    // 밴드 발행 방식 전체 스위치 — 명시 전달된 경우에만 적용.
    // 전역 값을 저장하고, 동시에 사용자의 활성 RETAIL 채널 bandPublishMethod 에 일괄 반영한다.
    // (발행 로직은 channel.bandPublishMethod 를 읽으므로 이 일괄 적용으로 즉시 유효.)
    if (finalBandPublishMethod) {
      try {
        await prisma.automationConfig.update({
          where: { userId: currentUser.userId },
          data: { bandPublishMethod: finalBandPublishMethod } as any,
        })
        const applied = await prisma.channel.updateMany({
          where: { userId: currentUser.userId, kind: 'RETAIL', deletedAt: null },
          data: { bandPublishMethod: finalBandPublishMethod } as any,
        })
        console.log(`[AutomationConfig] 발행방식 '${finalBandPublishMethod}' → RETAIL 채널 ${applied.count}개 일괄 적용 (user ${currentUser.userId})`)
      } catch (e: any) {
        console.warn('[AutomationConfig] bandPublishMethod 적용 실패 (DB 마이그레이션 필요):', e?.message)
      }
    }

    // 스케줄러 업데이트
    await updateScheduler(currentUser.userId)

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        cronInterval: cronInterval || '1h',
      },
    })
  } catch (error: any) {
    console.error('자동화 설정 저장 실패:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack?.split('\n').slice(0, 5),
    })
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
  if (expression.includes('|')) return 'custom'

  for (const [interval, cron] of Object.entries(CRON_EXPRESSIONS)) {
    if (cron === expression) {
      return interval as CronInterval
    }
  }
  return 'custom'
}

function calculateNextRunTime(cronExpression: string): Date {
  const now = new Date()

  // 파이프 구분 다중 cron인 경우: 각 cron의 다음 실행 시간 중 가장 빠른 것
  if (cronExpression.includes('|')) {
    const cronParts = cronExpression.split('|').map(c => c.trim()).filter(Boolean)
    const nextTimes = cronParts.map(c => calculateNextRunTimeForSingleCron(c, now))
    return nextTimes.reduce((earliest, t) => t < earliest ? t : earliest)
  }

  return calculateNextRunTimeForSingleCron(cronExpression, now)
}

function calculateNextRunTimeForSingleCron(cronExpression: string, now: Date): Date {
  const parts = cronExpression.split(' ')

  if (parts.length !== 5) {
    return new Date(now.getTime() + 60 * 60 * 1000)
  }

  const [minutePart, hourPart] = parts
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const targetMinute = minutePart === '*' ? 0 : parseInt(minutePart)

  // 매 시간 실행
  if (minutePart === '0' && hourPart === '*') {
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    next.setHours(next.getHours() + 1)
    return next
  }

  // N시간마다
  if (minutePart === '0' && hourPart.startsWith('*/')) {
    const interval = parseInt(hourPart.substring(2))
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    const nextHour = Math.ceil((currentHour + 1) / interval) * interval
    next.setHours(nextHour)
    return next
  }

  // 콤마로 구분된 여러 시간 또는 단일 시간
  const hours = hourPart.includes(',')
    ? hourPart.split(',').map(h => parseInt(h)).filter(h => !isNaN(h)).sort((a, b) => a - b)
    : [parseInt(hourPart)].filter(h => !isNaN(h))

  if (hours.length === 0) {
    return new Date(now.getTime() + 60 * 60 * 1000)
  }

  // 오늘 남은 시간 중 가장 가까운 것 찾기
  for (const h of hours) {
    if (h > currentHour || (h === currentHour && currentMinute < targetMinute)) {
      const next = new Date(now)
      next.setHours(h, targetMinute, 0, 0)
      return next
    }
  }

  // 오늘 남은 시간이 없으면 내일 첫 번째 시간
  const next = new Date(now)
  next.setDate(next.getDate() + 1)
  next.setHours(hours[0], targetMinute, 0, 0)
  return next
}
