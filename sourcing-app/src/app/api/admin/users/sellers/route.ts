/**
 * GET /api/admin/users/sellers — 통합 셀러 목록 (Pro + Lite + Lite Band)
 *
 * Query:
 * - mode (옵션): all|pro|lite|lite_band
 * - search (옵션): email/name/shop name 부분일치
 * - includeInactive (옵션): true 면 deletedAt 포함
 *
 * 반환: 사용자별 mode/shop/channel/config 요약. 어드민이 한 화면에서 모든 셀러 파악.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { isValidUserMode } from '@/lib/lite-modes'

export async function GET(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })
  if (me.role !== 'ADMIN')
    return NextResponse.json({ success: false, error: '관리자 권한 필요' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const modeParam = searchParams.get('mode') || 'all'
  const search = (searchParams.get('search') || '').trim()
  const includeInactive = searchParams.get('includeInactive') === '1'

  // 셀러 한정: 쇼핑몰 회원 (User.shopId != null) 은 제외
  // - shopId IS NULL: 직접 가입 또는 어드민 발급 (= 셀러 후보)
  // - shopId NOT NULL: 특정 쇼핑몰의 고객으로 가입 (= 쇼핑몰 회원, 셀러 X)
  const where: any = {
    role: { not: 'ADMIN' },
    shopId: null,
    ...(includeInactive ? {} : { deletedAt: null }),
  }

  if (modeParam !== 'all' && isValidUserMode(modeParam)) {
    where.mode = modeParam
  }

  if (search) {
    where.OR = [
      { email: { contains: search } },
      { name: { contains: search } },
      { shops: { some: { name: { contains: search } } } },
      { shops: { some: { subdomain: { contains: search } } } },
    ]
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      mode: true,
      maxShops: true,
      role: true,
      liteStartAt: true,
      proStartAt: true,
      createdAt: true,
      deletedAt: true,
      shops: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          subdomain: true,
          managerName: true,
          adminLoginId: true,
          isActive: true,
        },
      },
      channels: {
        where: { kind: 'RETAIL', deletedAt: null, isActive: true },
        select: { id: true, name: true, channelKey: true, sessionExpiresAt: true },
      },
      liteAutoPublishConfig: {
        select: {
          publishHour: true,
          publishMinute: true,
          dailyCount: true,
          isActive: true,
          lastRunAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  // 모드별 카운트 — shopId NULL (셀러) 만 집계, 쇼핑몰 고객 제외
  const counts = await prisma.user.groupBy({
    by: ['mode'],
    where: { role: { not: 'ADMIN' }, shopId: null, deletedAt: null },
    _count: { _all: true },
  })

  const countMap: Record<string, number> = {}
  for (const c of counts) {
    countMap[c.mode] = c._count._all
  }

  return NextResponse.json({
    success: true,
    data: {
      users,
      counts: {
        all: users.length,
        pro: countMap['pro'] || 0,
        lite: countMap['lite'] || 0,
        lite_band: countMap['lite_band'] || 0,
      },
    },
  })
}
