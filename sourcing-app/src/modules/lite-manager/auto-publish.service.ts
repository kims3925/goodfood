/**
 * Lite Manager v2 — 라이트 셀러 일일 자동 발행 서비스
 *
 * 기능: 어드민이 미리 가공해둔 Product 풀에서 매일 publishHour:publishMinute (KST)에
 *       dailyCount(기본 20)개를 선정하여 라이트 셀러의 ShopProduct로 자동 등록.
 *
 * 정책:
 * - 카테고리 SEA/AGR/MEA 우선 (농수축산물). 부족 시 MKT/PRC/HLT/ETC 보충
 * - 이미 해당 셀러에게 발행된 Product 제외 (ShopProduct 중복 방지)
 * - Product.isActive=true, deletedAt=null 만 후보
 * - lastRunAt 동일 KST 일자면 스킵 (중복 실행 방지)
 *
 * 호출 경로:
 * - cron: 매분 tick 시 due한 config 모두 처리
 * - 어드민 수동 실행: POST /api/admin/lite/auto-publish/[userId]/run
 */

import prisma from '@bandauto/db'

const PRIMARY_CATEGORIES = ['SEA', 'AGR', 'MEA'] as const
const FALLBACK_CATEGORIES = ['MKT', 'PRC', 'HLT', 'ETC'] as const
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function kstYmd(d: Date): string {
  const k = new Date(d.getTime() + KST_OFFSET_MS)
  const y = k.getUTCFullYear()
  const m = String(k.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(k.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function nowKstHourMinute(now: Date): { hour: number; minute: number } {
  const k = new Date(now.getTime() + KST_OFFSET_MS)
  return { hour: k.getUTCHours(), minute: k.getUTCMinutes() }
}

export interface AutoPublishResult {
  userId: number
  shopId: number | null
  count: number
  productIds: number[]
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED'
  error?: string
  reason?: string
}

/**
 * 단일 라이트 셀러에 대해 자동 발행 실행.
 * @param force true 면 시간/lastRunAt 검사 건너뛰고 즉시 실행 (어드민 수동 실행용)
 */
export async function runAutoPublishForUser(
  userId: number,
  options?: { force?: boolean }
): Promise<AutoPublishResult> {
  const force = options?.force ?? false
  const now = new Date()

  const config = await prisma.liteAutoPublishConfig.findUnique({
    where: { userId },
  })
  if (!config) {
    return { userId, shopId: null, count: 0, productIds: [], status: 'SKIPPED', reason: 'no_config' }
  }
  if (!force && !config.isActive) {
    return { userId, shopId: null, count: 0, productIds: [], status: 'SKIPPED', reason: 'inactive' }
  }

  // 오늘 KST 일자 이미 실행됐으면 스킵
  if (!force && config.lastRunAt && kstYmd(config.lastRunAt) === kstYmd(now)) {
    return { userId, shopId: null, count: 0, productIds: [], status: 'SKIPPED', reason: 'already_today' }
  }

  // 시간 도달 검사 (force=false 시)
  if (!force) {
    const { hour, minute } = nowKstHourMinute(now)
    const dueMinutes = config.publishHour * 60 + config.publishMinute
    const nowMinutes = hour * 60 + minute
    if (nowMinutes < dueMinutes) {
      return { userId, shopId: null, count: 0, productIds: [], status: 'SKIPPED', reason: 'not_due_yet' }
    }
  }

  // 사용자 + 활성 쇼핑몰 조회
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      mode: true,
      deletedAt: true,
      shops: {
        where: { isActive: true, deletedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  })
  if (!user || user.deletedAt || user.mode !== 'lite') {
    return { userId, shopId: null, count: 0, productIds: [], status: 'SKIPPED', reason: 'invalid_user' }
  }
  const shopId = user.shops[0]?.id
  if (!shopId) {
    return { userId, shopId: null, count: 0, productIds: [], status: 'SKIPPED', reason: 'no_shop' }
  }

  // 후보 Product 선정 — 이미 이 셀러에게 발행된 건 제외
  const existingShopProducts = await prisma.shopProduct.findMany({
    where: { shopId, deletedAt: null },
    select: { productId: true },
  })
  const excludeIds = existingShopProducts.map((sp) => sp.productId).filter((v): v is number => v != null)

  const candidates = await pickCandidates(excludeIds, config.dailyCount)

  if (candidates.length === 0) {
    await prisma.liteAutoPublishConfig.update({
      where: { userId },
      data: { lastRunAt: now },
    })
    await prisma.liteAutoPublishLog.create({
      data: {
        userId,
        shopId,
        productIds: [],
        count: 0,
        status: 'PARTIAL',
        errorMessage: '발행 후보 상품 없음 (가공 상품 풀이 비었거나 모두 이미 발행됨)',
      },
    })
    return {
      userId,
      shopId,
      count: 0,
      productIds: [],
      status: 'PARTIAL',
      reason: 'no_candidates',
    }
  }

  // 트랜잭션으로 ShopProduct 일괄 생성
  const productIds: number[] = []
  let failedCount = 0
  for (const p of candidates) {
    try {
      await prisma.shopProduct.create({
        data: {
          productId: p.id,
          shopId,
          userId,
          publishedAt: now,
        },
      })
      productIds.push(p.id)
    } catch (err) {
      failedCount += 1
      console.error(`[auto-publish] user=${userId} product=${p.id} 실패`, (err as Error).message)
    }
  }

  await prisma.liteAutoPublishConfig.update({
    where: { userId },
    data: { lastRunAt: now },
  })

  const status: 'SUCCESS' | 'PARTIAL' = failedCount === 0 ? 'SUCCESS' : 'PARTIAL'
  await prisma.liteAutoPublishLog.create({
    data: {
      userId,
      shopId,
      productIds,
      count: productIds.length,
      status,
      errorMessage: failedCount > 0 ? `${failedCount}건 실패` : null,
    },
  })

  return { userId, shopId, count: productIds.length, productIds, status }
}

/**
 * 모든 활성 config 에 대해 due 한 셀러에 자동 발행 실행 (cron 진입점).
 */
export async function runAllDueAutoPublish(): Promise<AutoPublishResult[]> {
  const configs = await prisma.liteAutoPublishConfig.findMany({
    where: { isActive: true },
    select: { userId: true },
  })
  const results: AutoPublishResult[] = []
  for (const c of configs) {
    try {
      const r = await runAutoPublishForUser(c.userId, { force: false })
      results.push(r)
    } catch (err) {
      results.push({
        userId: c.userId,
        shopId: null,
        count: 0,
        productIds: [],
        status: 'FAILED',
        error: (err as Error).message,
      })
    }
  }
  return results
}

/**
 * 후보 상품 선정 — 농수축산물 우선, 부족하면 다른 카테고리 보충.
 * - 발행되지 않은 (excludeIds 외) Product
 * - 활성 + 이미지 있음
 * - 최신순
 */
async function pickCandidates(
  excludeIds: number[],
  count: number
): Promise<Array<{ id: number; categoryId: string | null }>> {
  const baseWhere = {
    isActive: true,
    deletedAt: null,
    id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
  } as const

  // 1차: 농수축산물
  const primary = await prisma.product.findMany({
    where: {
      ...baseWhere,
      categoryId: { in: [...PRIMARY_CATEGORIES] },
    } as any,
    select: { id: true, categoryId: true },
    orderBy: { createdAt: 'desc' },
    take: count,
  })

  if (primary.length >= count) return primary

  // 2차: 보충
  const remaining = count - primary.length
  const usedIds = primary.map((p) => p.id)
  const fallback = await prisma.product.findMany({
    where: {
      ...baseWhere,
      id: { notIn: [...excludeIds, ...usedIds] },
      categoryId: { in: [...FALLBACK_CATEGORIES] },
    } as any,
    select: { id: true, categoryId: true },
    orderBy: { createdAt: 'desc' },
    take: remaining,
  })

  return [...primary, ...fallback]
}
