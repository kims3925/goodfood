/**
 * B2B 회원 승인 큐 API (B2B 공급몰 전환 STEP 3-1)
 *
 * GET   /api/admin/users/b2b?status=PENDING — 신청 목록 (기본 PENDING, all 가능)
 * PATCH /api/admin/users/b2b — { userId, action: 'approve' | 'reject', rejectReason? }
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

async function requireAdmin() {
  const me = await getCurrentUser()
  if (!me) {
    return { error: NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 }) }
  }
  if (me.role !== 'ADMIN') {
    return { error: NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 }) }
  }
  return { me }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status') || 'PENDING'
  const validStatuses = ['NONE', 'PENDING', 'APPROVED', 'REJECTED']

  try {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(statusParam === 'all'
          ? { b2bStatus: { not: 'NONE' } }
          : validStatuses.includes(statusParam)
            ? { b2bStatus: statusParam as any }
            : { b2bStatus: 'PENDING' }),
      } as any,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        companyName: true,
        businessNumber: true,
        b2bStatus: true,
        b2bAppliedAt: true,
        b2bApprovedAt: true,
        b2bRejectReason: true,
        createdAt: true,
      } as any,
      orderBy: { b2bAppliedAt: 'desc' } as any,
      take: 200,
    })

    return NextResponse.json({ success: true, data: users })
  } catch (error: any) {
    console.error('[Admin B2B GET]', error)
    return NextResponse.json({ success: false, error: 'B2B 신청 목록 조회 실패' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const userId = Number(body?.userId)
  const action = body?.action
  if (!Number.isFinite(userId) || !['approve', 'reject'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'userId 와 action(approve|reject)이 필요합니다.' },
      { status: 400 }
    )
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, b2bStatus: true } as any,
    })
    if (!user) {
      return NextResponse.json({ success: false, error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }
    if ((user as any).b2bStatus !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `승인 대기 상태가 아닙니다 (현재: ${(user as any).b2bStatus})` },
        { status: 409 }
      )
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data:
        action === 'approve'
          ? ({ b2bStatus: 'APPROVED', b2bApprovedAt: new Date(), b2bRejectReason: null } as any)
          : ({
              b2bStatus: 'REJECTED',
              b2bRejectReason: String(body?.rejectReason || '').slice(0, 500) || null,
            } as any),
      select: { id: true, b2bStatus: true } as any,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('[Admin B2B PATCH]', error)
    return NextResponse.json({ success: false, error: '처리 실패' }, { status: 500 })
  }
}
