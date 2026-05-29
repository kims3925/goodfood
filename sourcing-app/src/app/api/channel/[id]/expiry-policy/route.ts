export const dynamic = 'force-dynamic'

/**
 * 채널별 만료 정책 API (경영밴드 SaaS 운영플로우 부록 B)
 * GET  /api/channel/[id]/expiry-policy — 조회
 * PUT  /api/channel/[id]/expiry-policy — 변경 (expiryDaysNormal/Com, autoExpireEnabled)
 *
 * 만료 일수는 ProductManagerAgent.runContentExpiry 에 반영된다:
 *  - autoExpireEnabled=false → 해당 채널 자동만료 제외
 *  - expiryDays* (기본보다 길게 설정 시) → 더 긴 보존 기간 적용
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

const DEFAULT_NORMAL = 7
const DEFAULT_COM = 30

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 })
  }

  const channel = await prisma.channel.findFirst({
    where: { id, userId: user.userId, deletedAt: null },
    select: { id: true, name: true, kind: true, expiryDaysNormal: true, expiryDaysCom: true, autoExpireEnabled: true },
  })
  if (!channel) {
    return NextResponse.json({ success: false, error: '채널을 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    data: {
      channelId: channel.id,
      name: channel.name,
      kind: channel.kind,
      autoExpireEnabled: channel.autoExpireEnabled,
      expiryDaysNormal: channel.expiryDaysNormal ?? DEFAULT_NORMAL,
      expiryDaysCom: channel.expiryDaysCom ?? DEFAULT_COM,
      // 기본값 사용 중인지 표시 (UI에서 "기본값" 라벨용)
      usingDefaults: {
        normal: channel.expiryDaysNormal == null,
        com: channel.expiryDaysCom == null,
      },
    },
  })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 })
  }

  // 소유권 확인
  const owned = await prisma.channel.findFirst({
    where: { id, userId: user.userId, deletedAt: null },
    select: { id: true },
  })
  if (!owned) {
    return NextResponse.json({ success: false, error: '채널을 찾을 수 없습니다.' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))

  // 일수: 1~365 정수만 허용. null/''=기본값으로 해제. undefined=변경 없음.
  const parseDays = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined
    if (v === null || v === '') return null
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10)
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      throw new Error('만료 일수는 1~365 사이의 값이어야 합니다.')
    }
    return n
  }

  const data: Record<string, unknown> = {}
  try {
    const normal = parseDays(body.expiryDaysNormal)
    if (normal !== undefined) data.expiryDaysNormal = normal
    const com = parseDays(body.expiryDaysCom)
    if (com !== undefined) data.expiryDaysCom = com
    if (typeof body.autoExpireEnabled === 'boolean') data.autoExpireEnabled = body.autoExpireEnabled
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 })
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: '변경할 항목이 없습니다.' }, { status: 400 })
  }

  const updated = await prisma.channel.update({
    where: { id },
    data,
    select: { id: true, name: true, expiryDaysNormal: true, expiryDaysCom: true, autoExpireEnabled: true },
  })

  return NextResponse.json({
    success: true,
    data: {
      channelId: updated.id,
      name: updated.name,
      autoExpireEnabled: updated.autoExpireEnabled,
      expiryDaysNormal: updated.expiryDaysNormal ?? DEFAULT_NORMAL,
      expiryDaysCom: updated.expiryDaysCom ?? DEFAULT_COM,
    },
  })
}
