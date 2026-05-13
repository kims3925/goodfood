/**
 * POST /api/admin/billing/[managerId]/mark-paid
 *
 * 수동 결제 완료 처리 — 오프라인 입금/계좌이체 등을 어드민이 인정.
 * - 매니저의 UserSubscription 상태를 ACTIVE 로 변경
 * - 옵션: extendDays(기본 30) 만큼 periodEnd 연장
 * - 옵션: planId 변경 (플랜 업/다운그레이드)
 *
 * 실제 결제 게이트웨이 연동(토스/스트라이프 등)은 미구현 — 어드민이 인지한 결제만 반영.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', status: 401 as const }
  if (user.role !== 'ADMIN') return { error: '관리자 권한이 필요합니다.', status: 403 as const }
  return { user }
}

export async function POST(request: NextRequest, ctx: { params: { managerId: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const managerId = Number(ctx.params.managerId)
  if (!Number.isFinite(managerId)) {
    return NextResponse.json({ success: false, error: '잘못된 managerId' }, { status: 400 })
  }

  let body: any = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    body = {}
  }

  const extendDays = Number.isFinite(Number(body.extendDays)) ? Math.max(0, Math.min(366, Number(body.extendDays))) : 30
  const planId = body.planId ? Number(body.planId) : null
  const note = typeof body.note === 'string' ? body.note : null

  const manager = await prisma.user.findFirst({
    where: { id: managerId, role: 'MANAGER' },
    select: {
      id: true,
      subscription: {
        select: { id: true, planId: true, periodEnd: true, status: true },
      },
    },
  })
  if (!manager) {
    return NextResponse.json({ success: false, error: '매니저를 찾을 수 없습니다.' }, { status: 404 })
  }

  const now = new Date()

  // periodEnd 기준 계산 — 기존 periodEnd 가 미래면 거기서 연장, 과거면 now 부터 시작
  const base =
    manager.subscription?.periodEnd && new Date(manager.subscription.periodEnd) > now
      ? new Date(manager.subscription.periodEnd)
      : now
  const newPeriodEnd = new Date(base.getTime() + extendDays * 24 * 60 * 60 * 1000)

  let resolvedPlanId = planId ?? manager.subscription?.planId ?? null
  if (resolvedPlanId === null) {
    // 첫 구독 + 플랜 미지정 — 기본 'free' 플랜으로 폴백
    const freePlan = await prisma.subscriptionPlan.findUnique({
      where: { slug: 'free' },
      select: { id: true },
    })
    if (!freePlan) {
      return NextResponse.json(
        { success: false, error: '대상 매니저에 구독이 없고 기본 플랜도 시드되지 않았습니다. body.planId 를 지정하세요.' },
        { status: 400 }
      )
    }
    resolvedPlanId = freePlan.id
  }

  const updated = await prisma.userSubscription.upsert({
    where: { userId: managerId },
    create: {
      userId: managerId,
      planId: resolvedPlanId,
      status: 'ACTIVE',
      periodStart: now,
      periodEnd: newPeriodEnd,
      paymentMethod: 'MANUAL',
    },
    update: {
      planId: resolvedPlanId,
      status: 'ACTIVE',
      periodEnd: newPeriodEnd,
      paymentMethod: 'MANUAL',
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    },
    select: {
      id: true,
      status: true,
      periodEnd: true,
      planId: true,
    },
  })

  return NextResponse.json({
    success: true,
    data: updated,
    meta: { extendDays, note },
  })
}
