/**
 * GET /api/admin/billing
 *
 * 매니저별 구독·결제 상태 통합 조회.
 * - SubscriptionPlan / UserSubscription / 다음 결제일 / 미납 여부
 * - 매니저가 구독 미보유 시 subscription=null 로 반환 (Free 폴백)
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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')
  const q = (searchParams.get('q') || '').trim()

  const where: any = { role: 'MANAGER', deletedAt: null }
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { name: { contains: q } },
      { companyName: { contains: q } },
    ]
  }

  const managers = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      subscription: {
        select: {
          id: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          paymentMethod: true,
          cancelAtPeriodEnd: true,
          cancelledAt: true,
          plan: {
            select: { id: true, slug: true, name: true, priceMonthly: true },
          },
        },
      },
    },
  })

  const now = new Date()
  const data = managers
    .map((m: any) => {
      const sub = m.subscription
      const overdue = sub
        ? sub.status === 'PAST_DUE' || (sub.periodEnd && new Date(sub.periodEnd) < now && sub.status !== 'CANCELLED')
        : false
      return {
        id: m.id,
        email: m.email,
        name: m.name,
        companyName: m.companyName,
        subscription: sub
          ? {
              id: sub.id,
              status: sub.status,
              periodStart: sub.periodStart,
              periodEnd: sub.periodEnd,
              paymentMethod: sub.paymentMethod,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
              cancelledAt: sub.cancelledAt,
              planSlug: sub.plan?.slug,
              planName: sub.plan?.name,
              priceMonthly: sub.plan?.priceMonthly ?? 0,
            }
          : null,
        overdue,
      }
    })
    .filter((row: any) => {
      if (!statusFilter) return true
      if (statusFilter === 'NONE') return row.subscription === null
      return row.subscription?.status === statusFilter
    })

  // 사용 가능한 플랜 목록 (변경 UI용)
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, name: true, priceMonthly: true },
  })

  return NextResponse.json({ success: true, data, plans })
}
