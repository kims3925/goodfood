/**
 * PATCH /api/admin/users/sellers/[id] — 셀러 mode/maxShops 변경 + 정지/활성화
 *
 * body:
 * - mode?: 'pro' | 'lite' | 'lite_band'
 * - maxShops?: number (>=1, lite/lite_band 면 자동 1 로 강제)
 * - isActive?: boolean (false → deletedAt 설정 / true → deletedAt=null)
 *
 * mode 변경 부수 효과:
 * - pro → lite/lite_band: liteStartAt=now, maxShops=1 강제
 * - lite/lite_band → pro: proStartAt=now (maxShops 는 명시 입력 안 하면 1 유지)
 * - 어떤 모드든 LiteAutoPublishConfig 가 없으면 자동 생성 (lite/lite_band 인 경우)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { isValidUserMode } from '@/lib/lite-modes'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })
  if (me.role !== 'ADMIN')
    return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 })

  const userId = Number(params.id)
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, mode: true, role: true, maxShops: true, shopId: true },
  })
  if (!target) return NextResponse.json({ success: false, error: '없음' }, { status: 404 })
  if (target.role === 'ADMIN')
    return NextResponse.json({ success: false, error: '관리자는 변경 불가' }, { status: 403 })
  if (target.shopId != null)
    return NextResponse.json(
      { success: false, error: '쇼핑몰 회원은 셀러 관리 대상이 아닙니다.' },
      { status: 403 }
    )

  const updates: any = {}
  let needsLiteConfig = false
  let resolvedMode = target.mode

  if (body.mode !== undefined) {
    if (!isValidUserMode(body.mode))
      return NextResponse.json(
        { success: false, error: '잘못된 mode (pro|lite|lite_band)' },
        { status: 400 }
      )
    updates.mode = body.mode
    resolvedMode = body.mode
    const now = new Date()
    if (body.mode === 'pro' && target.mode !== 'pro') {
      updates.proStartAt = now
    } else if (body.mode !== 'pro' && target.mode === 'pro') {
      updates.liteStartAt = now
    }
    if (body.mode === 'lite' || body.mode === 'lite_band') {
      needsLiteConfig = true
      // 라이트 전환 시 maxShops 1 강제
      updates.maxShops = 1
    }
  }

  if (body.maxShops !== undefined) {
    const n = Number(body.maxShops)
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json(
        { success: false, error: 'maxShops 는 1 이상의 정수 (무제한은 9999)' },
        { status: 400 }
      )
    }
    // lite/lite_band 는 1 강제
    const isLiteResolved = resolvedMode === 'lite' || resolvedMode === 'lite_band'
    const targetMax = Math.floor(n)
    updates.maxShops = isLiteResolved ? 1 : targetMax

    // 새 한도가 현재 보유 쇼핑몰 갯수보다 작으면 차단 (무제한=9999 는 항상 통과)
    if (!isLiteResolved && targetMax < 9999) {
      const currentShopCount = await prisma.shop.count({
        where: { userId, deletedAt: null },
      })
      if (targetMax < currentShopCount) {
        return NextResponse.json(
          {
            success: false,
            error: `현재 ${currentShopCount}개의 쇼핑몰을 보유 중이라 ${targetMax} 미만으로 줄일 수 없습니다.`,
          },
          { status: 409 }
        )
      }
    }
  }

  if (body.isActive !== undefined) {
    updates.deletedAt = body.isActive ? null : new Date()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: '변경 항목 없음' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: updates })

    if (needsLiteConfig) {
      const existing = await tx.liteAutoPublishConfig.findUnique({ where: { userId } })
      if (!existing) {
        await tx.liteAutoPublishConfig.create({
          data: { userId, publishHour: 10, publishMinute: 0, dailyCount: 20, isActive: true },
        })
      }
    }
  })

  return NextResponse.json({ success: true })
}
