/**
 * POST /api/admin/band-deletion/custom-expire
 *
 * 커스텀 날짜 기준 ChannelProduct 만료 처리 + Playwright Band 게시글 삭제.
 * (기본 runContentExpiry의 7일/30일 고정 cutoff 대신, 임의 cutoffDate 사용)
 *
 * Body:
 *  - cutoffDate: string (ISO 또는 YYYY-MM-DD). 이 날짜 이전에 발행된 게시글 대상.
 *  - channelIds?: number[]   대상 채널 ID 목록. 미지정 시 전체 활성 RETAIL 채널.
 *  - dryRun?: boolean        (기본 true). false로 명시해야 실제 삭제 실행.
 *  - limit?: number          (기본 100, 최대 500). Playwright 1건당 ~10-15초.
 *  - skipPlaywright?: boolean (기본 false). true면 DB soft-delete만 실행.
 *  - skipShopProducts?: boolean (기본 false). true면 ShopProduct 처리 건너뜀.
 *
 * 응답: 삭제 결과 요약 (cutoffDate / channelProducts / shopProducts / bandPosts / errors)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import prisma from '@bandauto/db'
import { bandPlaywrightService } from '@/modules/band-playwright'

export const dynamic = 'force-dynamic'
export const maxDuration = 1800 // 30분

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    // ── 파라미터 파싱 ──
    const cutoffDateStr = body?.cutoffDate
    if (!cutoffDateStr || typeof cutoffDateStr !== 'string') {
      return NextResponse.json(
        { success: false, error: 'cutoffDate (YYYY-MM-DD 또는 ISO) 필수입니다.' },
        { status: 400 }
      )
    }
    const cutoffDate = new Date(cutoffDateStr)
    if (isNaN(cutoffDate.getTime())) {
      return NextResponse.json(
        { success: false, error: `유효하지 않은 날짜: ${cutoffDateStr}` },
        { status: 400 }
      )
    }

    const dryRun = body?.dryRun !== false // 기본 true (안전)
    const skipPlaywright = body?.skipPlaywright === true
    const skipShopProducts = body?.skipShopProducts === true
    const limit =
      typeof body?.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 500) : 100
    const channelIds: number[] | undefined = Array.isArray(body?.channelIds)
      ? body.channelIds.filter((id: any) => typeof id === 'number')
      : undefined

    const now = new Date()

    console.log(
      `[custom-expire] 시작: cutoffDate=${cutoffDate.toISOString()}, dryRun=${dryRun}, limit=${limit}, skipPlaywright=${skipPlaywright}, channelIds=${channelIds?.join(',') || 'ALL'}`
    )

    // ── 1) 만료 ChannelProduct 조회 ──
    const channelWhere: any = { isActive: true, kind: 'RETAIL' }
    if (channelIds && channelIds.length > 0) {
      channelWhere.id = { in: channelIds }
    }

    const expiredChannelProducts = await prisma.channelProduct.findMany({
      where: {
        deletedAt: null,
        publishedAt: { not: null, lt: cutoffDate },
        channel: { is: channelWhere },
      },
      select: {
        id: true,
        productId: true,
        channelId: true,
        postKey: true,
        publishedAt: true,
        product: { select: { id: true, categoryId: true, name: true } },
        channel: { select: { id: true, channelKey: true, name: true, isActive: true } },
      },
      take: limit,
      orderBy: { publishedAt: 'asc' },
    })

    // ── 2) 만료 ShopProduct 조회 (옵션) ──
    let expiredShopProducts: any[] = []
    if (!skipShopProducts) {
      expiredShopProducts = await prisma.shopProduct.findMany({
        where: {
          deletedAt: null,
          publishedAt: { not: null, lt: cutoffDate },
          shop: { is: { isActive: true } },
        },
        select: {
          id: true,
          productId: true,
          shopId: true,
          publishedAt: true,
          product: { select: { id: true, categoryId: true, name: true } },
          shop: { select: { id: true, name: true } },
        },
        take: limit,
        orderBy: { publishedAt: 'asc' },
      })
    }

    // ── 채널별 통계 맵 ──
    const channelStatsMap = new Map<
      number,
      {
        channelId: number
        channelName: string
        found: number
        attempted: number
        deleted: number
        failed: number
        sessionMissing: number
      }
    >()
    for (const cp of expiredChannelProducts) {
      const cur = channelStatsMap.get(cp.channelId) ?? {
        channelId: cp.channelId,
        channelName: cp.channel?.name || `Ch#${cp.channelId}`,
        found: 0,
        attempted: 0,
        deleted: 0,
        failed: 0,
        sessionMissing: 0,
      }
      cur.found++
      channelStatsMap.set(cp.channelId, cur)
    }

    const shopStatsMap = new Map<number, { shopId: number; shopName: string; deleted: number }>()
    for (const sp of expiredShopProducts) {
      const cur = shopStatsMap.get(sp.shopId) ?? {
        shopId: sp.shopId,
        shopName: sp.shop?.name || `Shop#${sp.shopId}`,
        deleted: 0,
      }
      shopStatsMap.set(sp.shopId, cur)
    }

    const result = {
      cutoffDate: cutoffDate.toISOString(),
      channelProducts: { found: expiredChannelProducts.length, softDeleted: 0 },
      shopProducts: { found: expiredShopProducts.length, softDeleted: 0 },
      bandPosts: { attempted: 0, deleted: 0, failed: 0, sessionMissing: 0 },
      byChannel: [] as any[],
      byShop: [] as any[],
      productsAffected: 0,
      errors: [] as { id: number; error: string; type: 'channel' | 'shop' | 'band' }[],
      dryRun,
      limit,
      hasMore: expiredChannelProducts.length >= limit,
    }

    // ── dryRun: 통계만 반환 ──
    if (dryRun) {
      const affected = new Set<number>()
      for (const cp of expiredChannelProducts) if (cp.productId) affected.add(cp.productId)
      for (const sp of expiredShopProducts) if (sp.productId) affected.add(sp.productId)
      result.productsAffected = affected.size
      result.byChannel = Array.from(channelStatsMap.values()).sort((a, b) => b.found - a.found)
      result.byShop = Array.from(shopStatsMap.values()).sort((a, b) => a.shopId - b.shopId)

      // 전체 건수도 포함 (limit과 무관하게)
      const totalChannelCount = await prisma.channelProduct.count({
        where: {
          deletedAt: null,
          publishedAt: { not: null, lt: cutoffDate },
          channel: { is: channelWhere },
        },
      })
      const totalShopCount = skipShopProducts
        ? 0
        : await prisma.shopProduct.count({
            where: {
              deletedAt: null,
              publishedAt: { not: null, lt: cutoffDate },
              shop: { is: { isActive: true } },
            },
          })

      return NextResponse.json({
        success: true,
        summary: {
          ...result,
          totalChannelProductsBeforeCutoff: totalChannelCount,
          totalShopProductsBeforeCutoff: totalShopCount,
          note: `dryRun=true. 실제 삭제하려면 dryRun: false 전송.`,
        },
      })
    }

    // ── 실행 모드: ChannelProduct 처리 ──
    for (const cp of expiredChannelProducts) {
      // (a) DB soft-delete
      try {
        await prisma.channelProduct.update({
          where: { id: cp.id },
          data: { deletedAt: now, isActive: false },
        })
        result.channelProducts.softDeleted++
      } catch (err: any) {
        result.errors.push({ id: cp.id, error: err.message || String(err), type: 'channel' })
        continue
      }

      // (b) Playwright 실 삭제
      if (!skipPlaywright && cp.postKey && cp.channel?.channelKey) {
        result.bandPosts.attempted++
        const chStats = channelStatsMap.get(cp.channelId)!
        chStats.attempted++
        try {
          const r = await bandPlaywrightService.deletePost({
            channelId: cp.channelId,
            bandKey: cp.channel.channelKey,
            bandName: cp.channel.name,
            postKey: cp.postKey,
          })
          if (r.success) {
            result.bandPosts.deleted++
            chStats.deleted++
          } else {
            result.bandPosts.failed++
            chStats.failed++
            const isSession =
              !!r.error &&
              (r.error.includes('세션') ||
                r.error.includes('session') ||
                r.error.includes('쿠키'))
            if (isSession) {
              result.bandPosts.sessionMissing++
              chStats.sessionMissing++
            }
            console.warn(
              `[custom-expire] Band 삭제 실패 (${cp.channel.name} post=${cp.postKey}): ${r.error}`
            )
            result.errors.push({
              id: cp.id,
              error: `[${cp.channel.name}] ${r.error || '실패'}`,
              type: 'band',
            })
          }
        } catch (err: any) {
          result.bandPosts.failed++
          chStats.failed++
          console.error(
            `[custom-expire] Band 삭제 예외 (${cp.channel.name} post=${cp.postKey}): ${err.message || err}`
          )
          result.errors.push({
            id: cp.id,
            error: `[${cp.channel.name}] ${err.message || String(err)}`,
            type: 'band',
          })
        }
      }
    }

    // ── ShopProduct 처리: DB soft-delete만 ──
    for (const sp of expiredShopProducts) {
      try {
        await prisma.shopProduct.update({
          where: { id: sp.id },
          data: { deletedAt: now },
        })
        result.shopProducts.softDeleted++
        const shopStats = shopStatsMap.get(sp.shopId)
        if (shopStats) shopStats.deleted++
      } catch (err: any) {
        result.errors.push({ id: sp.id, error: err.message || String(err), type: 'shop' })
      }
    }

    const affected = new Set<number>()
    for (const cp of expiredChannelProducts) if (cp.productId) affected.add(cp.productId)
    for (const sp of expiredShopProducts) if (sp.productId) affected.add(sp.productId)
    result.productsAffected = affected.size
    result.byChannel = Array.from(channelStatsMap.values()).sort((a, b) => b.found - a.found)
    result.byShop = Array.from(shopStatsMap.values()).sort((a, b) => a.shopId - b.shopId)

    console.log(
      `[custom-expire] 완료: CP soft-deleted=${result.channelProducts.softDeleted}, band deleted=${result.bandPosts.deleted}, failed=${result.bandPosts.failed}, SP soft-deleted=${result.shopProducts.softDeleted}`
    )

    return NextResponse.json({ success: true, summary: result })
  } catch (error: any) {
    console.error('[custom-expire] 오류:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '실행 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
