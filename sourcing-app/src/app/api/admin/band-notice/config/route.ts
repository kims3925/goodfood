export const dynamic = 'force-dynamic'

/**
 * 밴드공지 설정 API
 *
 * GET  /api/admin/band-notice/config — 현재 설정 반환 (없으면 기본값)
 * PUT  /api/admin/band-notice/config — 설정 upsert
 *
 * 참조: BandAuto_데이터활용_1일3회공지_개발계획서_v2.docx
 *
 * 이 시점에 cron 등록까지 하지 않음. MarketingAgent 보강(Day 4-5) 시점에
 * BandNoticeConfig 를 읽어 scheduleTimes 기반으로 cron 발화. 본 단계는 설정 영속화만.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const VALID_CATEGORIES = new Set(['SEA', 'AGR', 'MEA', 'MKT', 'PRC', 'HLT', 'ETC'])
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

interface BandNoticeConfigDto {
  isEnabled: boolean
  scheduleTimes: string[]  // "HH:MM"
  topN: number             // 1-10
  pinAsImportant: boolean
  retailChannelIds: number[]  // 빈 배열 = 전체 RETAIL
  sourceChannelIds: number[]  // 빈 배열 = 전체 WHOLESALE
  categoryCodes: string[]     // 빈 배열 = 전체
  toneHint: string | null
  lastRunAt: string | null
  lastRunMessage: string | null
}

const DEFAULTS: BandNoticeConfigDto = {
  isEnabled: false,
  scheduleTimes: ['11:00', '13:00', '17:00'],
  topN: 5,
  pinAsImportant: true,
  retailChannelIds: [],
  sourceChannelIds: [],
  categoryCodes: [],
  toneHint: null,
  lastRunAt: null,
  lastRunMessage: null,
}

function parseJsonArray(raw: string | null | undefined): any[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function rowToDto(row: any): BandNoticeConfigDto {
  return {
    isEnabled: !!row.isEnabled,
    scheduleTimes: parseJsonArray(row.scheduleTimes).filter((s) => typeof s === 'string' && HHMM_RE.test(s)),
    topN: Math.max(1, Math.min(10, Number(row.topN) || 5)),
    pinAsImportant: !!row.pinAsImportant,
    retailChannelIds: parseJsonArray(row.retailChannelIds).filter((n) => Number.isInteger(n) && n > 0),
    sourceChannelIds: parseJsonArray(row.sourceChannelIds).filter((n) => Number.isInteger(n) && n > 0),
    categoryCodes: parseJsonArray(row.categoryCodes).filter((s) => typeof s === 'string' && VALID_CATEGORIES.has(s)),
    toneHint: row.toneHint || null,
    lastRunAt: row.lastRunAt ? new Date(row.lastRunAt).toISOString() : null,
    lastRunMessage: row.lastRunMessage || null,
  }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const row = await prisma.bandNoticeConfig.findUnique({
      where: { userId: currentUser.userId },
    })

    return NextResponse.json({
      success: true,
      data: row ? rowToDto(row) : DEFAULTS,
    })
  } catch (error: any) {
    console.error('[band-notice GET] 실패', error)
    return NextResponse.json(
      { success: false, error: error?.message || '설정 조회 실패' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }
    const userId = currentUser.userId
    const body = await request.json().catch(() => ({}))

    // ── 입력 정규화/검증 ──
    const isEnabled = !!body.isEnabled
    const pinAsImportant = !!body.pinAsImportant

    const scheduleTimes: string[] = Array.isArray(body.scheduleTimes)
      ? Array.from(new Set(body.scheduleTimes.filter((s: any) => typeof s === 'string' && HHMM_RE.test(s))))
          .sort() as string[]
      : []
    if (isEnabled && scheduleTimes.length === 0) {
      return NextResponse.json(
        { success: false, error: '활성화 시 공지 시간을 1개 이상 입력하세요. (HH:MM)' },
        { status: 400 },
      )
    }

    const topN = Math.max(1, Math.min(10, Math.floor(Number(body.topN) || 5)))

    const retailChannelIds: number[] = Array.isArray(body.retailChannelIds)
      ? body.retailChannelIds.filter((n: any) => Number.isInteger(n) && n > 0)
      : []
    const sourceChannelIds: number[] = Array.isArray(body.sourceChannelIds)
      ? body.sourceChannelIds.filter((n: any) => Number.isInteger(n) && n > 0)
      : []
    const categoryCodes: string[] = Array.isArray(body.categoryCodes)
      ? body.categoryCodes.filter((s: any) => typeof s === 'string' && VALID_CATEGORIES.has(s))
      : []

    // ── 채널 소유권 검증 ──
    if (retailChannelIds.length > 0) {
      const c = await prisma.channel.count({
        where: { id: { in: retailChannelIds }, userId, kind: 'RETAIL' as any, isActive: true },
      })
      if (c !== retailChannelIds.length) {
        return NextResponse.json(
          { success: false, error: '비활성 또는 권한이 없는 소매밴드가 포함되어 있습니다.' },
          { status: 403 },
        )
      }
    }
    if (sourceChannelIds.length > 0) {
      const c = await prisma.channel.count({
        where: { id: { in: sourceChannelIds }, userId, kind: 'WHOLESALE' as any },
      })
      if (c !== sourceChannelIds.length) {
        return NextResponse.json(
          { success: false, error: '권한이 없는 도매방이 포함되어 있습니다.' },
          { status: 403 },
        )
      }
    }

    const toneHint =
      typeof body.toneHint === 'string'
        ? body.toneHint.trim().slice(0, 500) || null
        : null

    // ── upsert ──
    const row = await prisma.bandNoticeConfig.upsert({
      where: { userId },
      create: {
        userId,
        isEnabled,
        scheduleTimes: JSON.stringify(scheduleTimes),
        topN,
        pinAsImportant,
        retailChannelIds: JSON.stringify(retailChannelIds),
        sourceChannelIds: JSON.stringify(sourceChannelIds),
        categoryCodes: JSON.stringify(categoryCodes),
        toneHint,
      },
      update: {
        isEnabled,
        scheduleTimes: JSON.stringify(scheduleTimes),
        topN,
        pinAsImportant,
        retailChannelIds: JSON.stringify(retailChannelIds),
        sourceChannelIds: JSON.stringify(sourceChannelIds),
        categoryCodes: JSON.stringify(categoryCodes),
        toneHint,
      },
    })

    return NextResponse.json({
      success: true,
      data: rowToDto(row),
    })
  } catch (error: any) {
    console.error('[band-notice PUT] 실패', error)
    return NextResponse.json(
      { success: false, error: error?.message || '설정 저장 실패' },
      { status: 500 },
    )
  }
}
