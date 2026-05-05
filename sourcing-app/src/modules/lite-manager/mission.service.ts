/**
 * Lite Manager — 미션 진행도 추적 서비스 (A5)
 *
 * 핵심 기능:
 *  - seedMissions(): Mission 테이블에 5종 idempotent upsert
 *  - getUserMissionStatus(userId): 셀러의 모든 미션 progress + completed 상태
 *  - evaluateUserMissions(userId): 현재 DB 상태로 진행도 재계산 + UserMission 갱신
 *    · 새로 완료된 미션 → liteEventBus emit (B4 알림)
 *  - 트리거 위치 (호출자):
 *    · 주문 발생 (emitOrderCreated 후)
 *    · 후기 작성 (review POST 후)
 *    · /lite/missions 페이지 진입 (idempotent — 동일 진행도면 no-op)
 */
import prisma from '@bandauto/db'
import { MISSIONS, type MissionDef } from '@/lib/lite-missions'
import { liteEventBus } from '@/lib/lite-events'

export interface MissionStatus {
  code: string
  title: string
  description: string
  emoji: string
  rewardType: 'badge' | 'pro_trial'
  rewardValue: string
  targetValue: number
  progress: number
  completed: boolean
  completedAt: string | null
  sortOrder: number
}

/**
 * Mission 테이블 idempotent seed
 * 누락된 코드만 INSERT, 기존은 그대로 유지 (운영 중 정의 변경 안전)
 */
export async function seedMissions(): Promise<{ created: number; existing: number }> {
  let created = 0
  let existing = 0
  for (const def of MISSIONS) {
    const found = await prisma.mission.findUnique({ where: { code: def.code } })
    if (found) {
      existing++
      continue
    }
    await prisma.mission.create({
      data: {
        code: def.code,
        title: def.title,
        description: def.description,
        targetValue: def.targetValue,
        rewardType: def.rewardType,
        rewardValue: def.rewardValue,
        sortOrder: def.sortOrder,
        isActive: true,
      },
    })
    created++
  }
  return { created, existing }
}

interface ProgressContext {
  totalOrders: number
  maxOrdersInOneDay: number
  totalRevenue: number
  totalReviews: number
  completedOtherMissions: number // pro_unlock 평가용
}

async function buildProgressContext(userId: number, completedCodesExceptUnlock: Set<string>): Promise<ProgressContext> {
  const shops = await prisma.shop.findMany({
    where: { userId, isActive: true },
    select: { id: true },
  })
  const shopIds = shops.map((s) => s.id)

  if (shopIds.length === 0) {
    return {
      totalOrders: 0,
      maxOrdersInOneDay: 0,
      totalRevenue: 0,
      totalReviews: 0,
      completedOtherMissions: completedCodesExceptUnlock.size,
    }
  }

  const validStatuses = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const

  const [totalOrderAgg, ordersTimestamps, totalReviews] = await Promise.all([
    prisma.order.aggregate({
      where: { shopId: { in: shopIds }, status: { in: validStatuses as any } },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    // 모든 주문 시각 fetch — JS 에서 KST 자정 기준 그룹핑 (안전)
    prisma.order.findMany({
      where: { shopId: { in: shopIds }, status: { in: validStatuses as any } },
      select: { orderedAt: true },
    }),
    prisma.review.count({ where: { userId } }).catch(() => 0),
  ])

  // KST 자정 기준 일별 그룹핑 → 최대값
  const dayCount = new Map<string, number>()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  for (const o of ordersTimestamps) {
    const kst = new Date(o.orderedAt.getTime() + kstOffsetMs)
    const dayKey = kst.toISOString().slice(0, 10) // YYYY-MM-DD KST
    dayCount.set(dayKey, (dayCount.get(dayKey) || 0) + 1)
  }
  let maxOrdersInOneDay = 0
  dayCount.forEach((cnt) => {
    if (cnt > maxOrdersInOneDay) maxOrdersInOneDay = cnt
  })

  return {
    totalOrders: totalOrderAgg._count.id,
    maxOrdersInOneDay,
    totalRevenue: Number(totalOrderAgg._sum.totalAmount || 0),
    totalReviews,
    completedOtherMissions: completedCodesExceptUnlock.size,
  }
}

function evaluateProgress(def: MissionDef, ctx: ProgressContext): number {
  switch (def.code) {
    case 'first_sale':
      return Math.min(ctx.totalOrders, def.targetValue)
    case '3_sales':
      return Math.min(ctx.maxOrdersInOneDay, def.targetValue)
    case '10man_revenue':
      return Math.min(ctx.totalRevenue, def.targetValue)
    case 'review_5':
      return Math.min(ctx.totalReviews, def.targetValue)
    case 'pro_unlock':
      return Math.min(ctx.completedOtherMissions, def.targetValue)
    default:
      return 0
  }
}

/**
 * 셀러의 미션 진행도 재계산 + UserMission 업데이트
 * 새로 완료된 미션이 있으면 liteEventBus 로 알림
 */
export async function evaluateUserMissions(userId: number): Promise<{
  newlyCompleted: string[]
  totalCompleted: number
}> {
  // Mission 테이블 보장
  await seedMissions()

  // 기존 완료 상태 (pro_unlock 제외)
  const existingCompleted = await prisma.userMission.findMany({
    where: { userId, completed: true },
    include: { mission: { select: { code: true } } },
  })
  const completedCodesExceptUnlock = new Set(
    existingCompleted.map((um) => um.mission.code).filter((c) => c !== 'pro_unlock')
  )

  const ctx = await buildProgressContext(userId, completedCodesExceptUnlock)

  const dbMissions = await prisma.mission.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  const newlyCompletedCodes: string[] = []

  for (const def of MISSIONS) {
    const dbMission = dbMissions.find((m) => m.code === def.code)
    if (!dbMission) continue

    const progress = evaluateProgress(def, ctx)
    const completed = progress >= def.targetValue

    const existing = await prisma.userMission.findUnique({
      where: { userId_missionId: { userId, missionId: dbMission.id } },
    })

    const wasCompleted = existing?.completed ?? false

    await prisma.userMission.upsert({
      where: { userId_missionId: { userId, missionId: dbMission.id } },
      create: {
        userId,
        missionId: dbMission.id,
        progress,
        completed,
        completedAt: completed ? new Date() : null,
      },
      update: {
        progress,
        completed,
        completedAt: completed && !existing?.completed ? new Date() : existing?.completedAt,
      },
    })

    if (completed && !wasCompleted) {
      newlyCompletedCodes.push(def.code)
      // 이벤트 발행 (B4) — OrderNotifier 의 mission:completed 핸들러가 받음
      liteEventBus.emitMissionCompleted({
        userId,
        missionCode: def.code,
        missionTitle: def.title,
        rewardType: def.rewardType,
        rewardValue: def.rewardValue,
      })
    }
  }

  // pro_unlock 만 별도 재평가 — 다른 미션이 막 완료된 경우 즉시 unlock
  if (newlyCompletedCodes.length > 0) {
    const proUnlock = MISSIONS.find((m) => m.code === 'pro_unlock')!
    const proDb = dbMissions.find((m) => m.code === 'pro_unlock')
    if (proDb) {
      // 다시 진행도 카운트 — 방금 완료된 것까지 포함
      const updatedCompletedSet = new Set([
        ...completedCodesExceptUnlock,
        ...newlyCompletedCodes.filter((c) => c !== 'pro_unlock'),
      ])
      const progress = Math.min(updatedCompletedSet.size, proUnlock.targetValue)
      const completed = progress >= proUnlock.targetValue

      const existing = await prisma.userMission.findUnique({
        where: { userId_missionId: { userId, missionId: proDb.id } },
      })

      if (completed && !existing?.completed) {
        await prisma.userMission.update({
          where: { userId_missionId: { userId, missionId: proDb.id } },
          data: { progress, completed: true, completedAt: new Date() },
        })
        newlyCompletedCodes.push('pro_unlock')
        liteEventBus.emitMissionCompleted({
          userId,
          missionCode: 'pro_unlock',
          missionTitle: proUnlock.title,
          rewardType: proUnlock.rewardType,
          rewardValue: proUnlock.rewardValue,
        })
        // 자동 mode 전환 NOT done — 사용자가 직접 Pro 전환 클릭해야 (철학)
      }
    }
  }

  const totalCompleted = await prisma.userMission.count({
    where: { userId, completed: true },
  })

  return { newlyCompleted: newlyCompletedCodes, totalCompleted }
}

/**
 * 셀러의 모든 미션 + 진행도 (UI 표시용)
 */
export async function getUserMissionStatus(userId: number): Promise<MissionStatus[]> {
  await seedMissions()

  const dbMissions = await prisma.mission.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  const userMissions = await prisma.userMission.findMany({
    where: { userId },
  })
  const userMissionMap = new Map(userMissions.map((um) => [um.missionId, um]))

  return dbMissions.map((m) => {
    const def = MISSIONS.find((d) => d.code === m.code)
    const um = userMissionMap.get(m.id)
    return {
      code: m.code,
      title: m.title,
      description: m.description,
      emoji: def?.emoji || '🎯',
      rewardType: m.rewardType as 'badge' | 'pro_trial',
      rewardValue: m.rewardValue,
      targetValue: m.targetValue,
      progress: um?.progress ?? 0,
      completed: um?.completed ?? false,
      completedAt: um?.completedAt?.toISOString() ?? null,
      sortOrder: m.sortOrder,
    }
  })
}
