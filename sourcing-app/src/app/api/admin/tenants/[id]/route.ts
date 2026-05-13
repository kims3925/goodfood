/**
 * GET   /api/admin/tenants/[id] — 매니저 상세
 * PATCH /api/admin/tenants/[id] — 활성/비활성 토글, 비밀번호 재설정 등
 *
 * 본 라우트는 운영 어드민(role=ADMIN) 전용. 매니저 본인 변경은 별도 경로.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', status: 401 as const }
  if (user.role !== 'ADMIN') return { error: '관리자 권한이 필요합니다.', status: 403 as const }
  return { user }
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const id = Number(ctx.params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  const manager = await prisma.user.findFirst({
    where: { id, role: 'MANAGER' },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      companyName: true,
      businessNumber: true,
      mode: true,
      role: true,
      createdAt: true,
      signupCompletedAt: true,
      deletedAt: true,
      _count: {
        select: {
          channels: true,
          shops: true,
          products: true,
          orders: true,
        },
      },
      subscription: {
        select: {
          status: true,
          periodStart: true,
          periodEnd: true,
          plan: { select: { slug: true, name: true, priceMonthly: true } },
        },
      },
    },
  })

  if (!manager) {
    return NextResponse.json({ success: false, error: '매니저를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: manager })
}

export async function PATCH(request: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const id = Number(ctx.params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const target = await prisma.user.findFirst({
    where: { id, role: 'MANAGER' },
    select: { id: true, deletedAt: true, email: true },
  })
  if (!target) {
    return NextResponse.json({ success: false, error: '매니저를 찾을 수 없습니다.' }, { status: 404 })
  }

  const data: any = {}

  // 활성/비활성 토글 (deletedAt 으로 표현 — soft delete 원칙)
  if (typeof body.isActive === 'boolean') {
    data.deletedAt = body.isActive ? null : new Date()
  }

  // 비밀번호 재설정 (어드민이 직접 입력 또는 임시 비밀번호 생성)
  let tempPassword: string | null = null
  if (body.resetPassword === true) {
    tempPassword =
      typeof body.newPassword === 'string' && body.newPassword.length >= 6
        ? String(body.newPassword)
        : Math.random().toString(36).slice(2, 10) + '!A1'
    data.password = await bcrypt.hash(tempPassword, 10)
  }

  if (typeof body.name === 'string') data.name = body.name
  if (typeof body.phone === 'string') data.phone = body.phone
  if (typeof body.companyName === 'string') data.companyName = body.companyName

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: '변경 내용이 없습니다.' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      companyName: true,
      deletedAt: true,
    },
  })

  return NextResponse.json({
    success: true,
    data: { ...updated, isActive: updated.deletedAt === null, tempPassword },
  })
}
