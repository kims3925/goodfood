/**
 * GET /api/admin/usage
 *
 * 매니저별 월간 사용량 + 구독 한도 vs 실사용.
 * 쿼리:
 *   - month=YYYY-MM (생략 시 현재 월)
 *   - managerId=NUMBER (생략 시 전체 매니저)
 *
 * 응답:
 *   - managers[]: 매니저별 총합 + 한도 + 초과 여부
 *   - daily[]: (managerId 지정 시) 일별 사용량 추이 (차트용)
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

function parseMonth(input: string | null): { start: Date; end: Date; label: string } {
  const now = new Date()
  let year = now.getUTCFullYear()
  let month = now.getUTCMonth() // 0~11
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split('-').map(Number)
    year = y
    month = m - 1
  }
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1))
  const label = `${year}-${String(month + 1).padStart(2, '0')}`
  return { start, end, label }
}

function parseLimits(json: string | null | undefined): Record<string, any> {
  if (!json) return {}
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const month = parseMonth(searchParams.get('month'))
  const managerIdRaw = searchParams.get('managerId')
  const managerId = managerIdRaw ? Number(managerIdRaw) : null

  // 매니저 목록
  const managerWhere: any = { role: 'MANAGER', deletedAt: null }
  if (managerId) managerWhere.id = managerId

  const managers = await prisma.user.findMany({
    where: managerWhere,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      subscription: {
        select: {
          status: true,
          plan: { select: { slug: true, name: true, limits: true } },
        },
      },
    },
  })

  const managerIds = managers.map((m: any) => m.id)
  if (managerIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: { month: month.label, managers: [], daily: [] },
    })
  }

  // 월간 합계 (UsageLog 집계)
  const aggregates = await prisma.usageLog.groupBy({
    by: ['userId'],
    where: {
      userId: { in: managerIds },
      date: { gte: month.start, lt: month.end },
    },
    _sum: {
      aiCalls: true,
      collections: true,
      publishes: true,
      apiCalls: true,
    },
  })
  const aggMap: Record<number, any> = {}
  for (const a of aggregates) aggMap[a.userId] = a._sum

  const managersOut = managers.map((m: any) => {
    const sum = aggMap[m.id] || {}
    const limits = parseLimits(m.subscription?.plan?.limits)
    const aiQuota = typeof limits.aiCallsPerMonth === 'number' ? limits.aiCallsPerMonth : null
    const aiUsed = sum.aiCalls ?? 0
    const overLimit = aiQuota !== null && aiQuota >= 0 && aiUsed > aiQuota
    return {
      id: m.id,
      email: m.email,
      name: m.name,
      companyName: m.companyName,
      planSlug: m.subscription?.plan?.slug ?? null,
      planName: m.subscription?.plan?.name ?? null,
      subscriptionStatus: m.subscription?.status ?? null,
      usage: {
        aiCalls: aiUsed,
        collections: sum.collections ?? 0,
        publishes: sum.publishes ?? 0,
        apiCalls: sum.apiCalls ?? 0,
      },
      limits: {
        aiCallsPerMonth: aiQuota,
      },
      overLimit,
    }
  })

  // 일별 추이 (managerId 지정 시)
  let daily: any[] = []
  if (managerId) {
    const logs = await prisma.usageLog.findMany({
      where: {
        userId: managerId,
        date: { gte: month.start, lt: month.end },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        aiCalls: true,
        collections: true,
        publishes: true,
        apiCalls: true,
      },
    })
    daily = logs.map((l: any) => ({
      date: l.date.toISOString().slice(0, 10),
      aiCalls: l.aiCalls,
      collections: l.collections,
      publishes: l.publishes,
      apiCalls: l.apiCalls,
    }))
  }

  return NextResponse.json({
    success: true,
    data: { month: month.label, managers: managersOut, daily },
  })
}
