export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel Hobby 한도 300s (장시간 작업은 분할 실행)

/**
 * POST /api/sourcing/cleanup/execute
 *
 * 수동 상품 삭제 실행 — preview 에서 사용자가 "삭제"로 선택한 발행물 ID 만 처리.
 *  - ShopProduct: soft-delete (쇼핑몰에서 즉시 비노출, 가역)
 *  - ChannelProduct: soft-delete + (옵션) Playwright 로 소매밴드 실제 게시글 삭제
 *  - 도매밴드는 건드리지 않음 (모니터링 전용 — 삭제 권한/이유 없음)
 *
 * Body:
 *  - channelProductIds?: number[]
 *  - shopProductIds?: number[]
 *  - deleteBandPosts?: boolean (기본 false). true 면 postKey 있는 소매밴드 글 실삭제.
 *    Playwright 1건당 ~10-15초 → 1회 호출당 최대 BAND_DELETE_CAP 건. 남으면 응답에
 *    remainingBandPosts 로 알려주고, UI 가 재호출하도록 한다.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const BAND_DELETE_CAP = 30

export async function POST(request: NextRequest) {
  try {
    const me = await getCurrentUser()
    if (!me) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const channelProductIds: number[] = Array.isArray(body?.channelProductIds)
      ? body.channelProductIds.filter((id: any) => typeof id === 'number')
      : []
    const shopProductIds: number[] = Array.isArray(body?.shopProductIds)
      ? body.shopProductIds.filter((id: any) => typeof id === 'number')
      : []
    const deleteBandPosts = body?.deleteBandPosts === true

    if (channelProductIds.length === 0 && shopProductIds.length === 0) {
      return NextResponse.json({ success: false, error: '삭제할 항목을 선택하세요.' }, { status: 400 })
    }

    const now = new Date()
    const result = {
      shopProducts: { requested: shopProductIds.length, softDeleted: 0 },
      channelProducts: { requested: channelProductIds.length, softDeleted: 0 },
      bandPosts: { attempted: 0, deleted: 0, failed: 0, sessionMissing: 0 },
      remainingBandPosts: 0,
      errors: [] as string[],
    }

    // ── 1) ShopProduct soft-delete (소유권: product.userId 로 검증) ──
    if (shopProductIds.length > 0) {
      const res = await prisma.shopProduct.updateMany({
        where: {
          id: { in: shopProductIds },
          deletedAt: null,
          product: { is: { userId: me.userId } },
        },
        data: { deletedAt: now },
      })
      result.shopProducts.softDeleted = res.count
    }

    // ── 2) ChannelProduct 조회 (소유권 검증 + 밴드 삭제용 정보) ──
    let bandDeleteTargets: Array<{
      id: number
      postKey: string
      channelId: number
      channelKey: string
      channelName: string
    }> = []

    if (channelProductIds.length > 0) {
      const cps = await prisma.channelProduct.findMany({
        where: {
          id: { in: channelProductIds },
          deletedAt: null,
          product: { is: { userId: me.userId } },
        },
        select: {
          id: true,
          postKey: true,
          channelId: true,
          channel: { select: { channelKey: true, name: true } },
        },
      })

      const res = await prisma.channelProduct.updateMany({
        where: { id: { in: cps.map((c) => c.id) } },
        data: { deletedAt: now, isActive: false },
      })
      result.channelProducts.softDeleted = res.count

      if (deleteBandPosts) {
        bandDeleteTargets = cps
          .filter((c) => c.postKey && c.channel)
          .map((c) => ({
            id: c.id,
            postKey: c.postKey!,
            channelId: c.channelId,
            channelKey: c.channel!.channelKey,
            channelName: c.channel!.name,
          }))
      }
    }

    // ── 3) 소매밴드 실제 게시글 삭제 (best-effort, 1회 호출당 상한) ──
    if (deleteBandPosts && bandDeleteTargets.length > 0) {
      const batch = bandDeleteTargets.slice(0, BAND_DELETE_CAP)
      result.remainingBandPosts = Math.max(0, bandDeleteTargets.length - batch.length)

      const { bandPlaywrightService } = await import('@/modules/band-playwright')
      for (const target of batch) {
        result.bandPosts.attempted++
        try {
          const del = await bandPlaywrightService.deletePost({
            channelId: target.channelId,
            bandKey: target.channelKey,
            bandName: target.channelName,
            postKey: target.postKey,
          })
          if (del.success) {
            result.bandPosts.deleted++
          } else {
            result.bandPosts.failed++
            if (del.error?.includes('세션')) result.bandPosts.sessionMissing++
            if (del.error) result.errors.push(`cp#${target.id} (${target.channelName}): ${del.error}`)
          }
        } catch (err: any) {
          result.bandPosts.failed++
          result.errors.push(`cp#${target.id} (${target.channelName}): ${err?.message || err}`)
        }
      }
    }

    console.log(
      `[cleanup/execute] userId=${me.userId} shop=${result.shopProducts.softDeleted} ` +
        `channel=${result.channelProducts.softDeleted} band=${result.bandPosts.deleted}/${result.bandPosts.attempted} ` +
        `remaining=${result.remainingBandPosts}`
    )

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error('[cleanup/execute] 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '삭제 실행 중 오류 발생' },
      { status: 500 }
    )
  }
}
