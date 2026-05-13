/**
 * GET /api/admin/tenants
 *
 * 멀티테넌트 SaaS 운영 어드민용 — 매니저(테넌트) 목록 + 사용 통계.
 * - User where role='MANAGER' AND deletedAt=null
 * - 각 매니저별 channels / shops / products(활성) / orders(이번 달) 카운트
 * - 검색(q) + 페이지네이션(page, pageSize)
 *
 * 참고: User.managerId 필드는 현재 스키마에 없음 → staff(부하 스태프) 카운트는 0 으로 폴백.
 *       managerId 가 추가되면 _count.subordinates 로 자동 노출 가능.
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
  const q = (searchParams.get('q') || '').trim()
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 20)))

  // 이번 달 시작 시각(UTC) — 단순한 KST 보정 없이 UTC 기준 월 경계 사용
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const where: any = {
    role: 'MANAGER',
    deletedAt: null,
  }
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { name: { contains: q } },
      { companyName: { contains: q } },
      { phone: { contains: q } },
    ]
  }

  const [total, managers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        companyName: true,
        mode: true,
        createdAt: true,
        signupCompletedAt: true,
        deletedAt: true,
        _count: {
          select: {
            channels: true,
            shops: true,
            products: true,
          },
        },
        subscription: {
          select: {
            status: true,
            plan: { select: { slug: true, name: true } },
            periodEnd: true,
          },
        },
      },
    }),
  ])

  // 이번 달 주문 수 + 스태프 수 (매니저별) — 별도 집계
  const managerIds = managers.map((m: any) => m.id)
  const orderCounts: Record<number, number> = {}
  const staffCounts: Record<number, number> = {}
  if (managerIds.length > 0) {
    const grouped = await prisma.order.groupBy({
      by: ['userId'],
      where: {
        userId: { in: managerIds },
        createdAt: { gte: monthStart },
      },
      _count: { _all: true },
    })
    for (const g of grouped) {
      orderCounts[g.userId] = g._count._all
    }
    // managerId 기반 스태프 수 (Prisma _count.staff 가 CI 환경에서 인식 안 되는 케이스 회피)
    const staffGrouped = await prisma.user.groupBy({
      by: ['managerId'],
      where: {
        managerId: { in: managerIds },
        deletedAt: null,
      },
      _count: { _all: true },
    })
    for (const g of staffGrouped) {
      if (g.managerId != null) staffCounts[g.managerId] = g._count._all
    }
  }

  const data = managers.map((m: any) => ({
    id: m.id,
    email: m.email,
    name: m.name,
    phone: m.phone,
    companyName: m.companyName,
    mode: m.mode,
    isActive: m.deletedAt === null,
    createdAt: m.createdAt,
    signupCompletedAt: m.signupCompletedAt,
    stats: {
      staffCount: staffCounts[m.id] ?? 0,
      channelCount: m._count?.channels ?? 0,
      shopCount: m._count?.shops ?? 0,
      productCount: m._count?.products ?? 0,
      ordersThisMonth: orderCounts[m.id] ?? 0,
    },
    subscription: m.subscription
      ? {
          status: m.subscription.status,
          planSlug: m.subscription.plan?.slug ?? null,
          planName: m.subscription.plan?.name ?? null,
          periodEnd: m.subscription.periodEnd,
        }
      : null,
  }))

  return NextResponse.json({
    success: true,
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}
