/**
 * GET    /api/external-mall/connections/[id] — 연결 상세
 * PATCH  /api/external-mall/connections/[id] — 연결 수정 (이름/설정/활성화)
 * DELETE /api/external-mall/connections/[id] — 소프트 삭제
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

async function findOwn(id: number, userId: number) {
  return prisma.externalMallConnection.findFirst({
    where: { id, userId, deletedAt: null },
  })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ success: false, error: '잘못된 id' }, { status: 400 })

  const conn = await findOwn(id, me.userId)
  if (!conn) return NextResponse.json({ success: false, error: '없음' }, { status: 404 })

  // 토큰 마스킹
  const safe = {
    ...conn,
    apiKey: conn.apiKey ? '***' : null,
    apiSecret: conn.apiSecret ? '***' : null,
    accessToken: conn.accessToken ? '***' : null,
    refreshToken: conn.refreshToken ? '***' : null,
  }
  return NextResponse.json({ success: true, data: safe })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const id = Number(params.id)
  const exists = await findOwn(id, me.userId)
  if (!exists) return NextResponse.json({ success: false, error: '없음' }, { status: 404 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const updates: any = {}
  for (const k of [
    'name',
    'purpose',
    'mallId',
    'shopUrl',
    'apiBaseUrl',
    'apiKey',
    'apiSecret',
    'accessToken',
    'refreshToken',
    'sourcingConfig',
    'checkoutConfig',
    'isActive',
  ]) {
    if (body[k] !== undefined) updates[k] = body[k]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: '변경 항목 없음' }, { status: 400 })
  }

  await prisma.externalMallConnection.update({ where: { id }, data: updates })
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const id = Number(params.id)
  const exists = await findOwn(id, me.userId)
  if (!exists) return NextResponse.json({ success: false, error: '없음' }, { status: 404 })

  await prisma.externalMallConnection.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  })
  return NextResponse.json({ success: true })
}
