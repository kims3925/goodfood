/**
 * GET  /api/external-mall/connections — 본인 연결 목록
 * POST /api/external-mall/connections — 신규 연결 추가 (manual: API 키 직접 입력)
 *
 * Cafe24 OAuth 흐름은 별도 /oauth/cafe24/* 라우트에서 처리 (콜백에서 connection 자동 생성).
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const connections = await prisma.externalMallConnection.findMany({
    where: { userId: me.userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      platform: true,
      purpose: true,
      mallId: true,
      shopUrl: true,
      apiBaseUrl: true,
      isActive: true,
      lastSyncAt: true,
      lastError: true,
      tokenExpiresAt: true,
      createdAt: true,
      sourcingConfig: true,
      checkoutConfig: true,
      // accessToken/refreshToken 은 절대 노출 안 함
      _count: { select: { sourcedProducts: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: connections })
}

export async function POST(request: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 본문' }, { status: 400 })
  }

  const {
    name,
    platform,
    purpose,
    mallId,
    shopUrl,
    apiBaseUrl,
    apiKey,
    apiSecret,
    accessToken,
    refreshToken,
    sourcingConfig,
    checkoutConfig,
  } = body || {}

  if (!name || !platform || !purpose) {
    return NextResponse.json(
      { success: false, error: 'name/platform/purpose 필수' },
      { status: 400 }
    )
  }
  if (!['sourcing', 'checkout', 'both'].includes(purpose)) {
    return NextResponse.json({ success: false, error: '잘못된 purpose' }, { status: 400 })
  }

  const created = await prisma.externalMallConnection.create({
    data: {
      userId: me.userId,
      name,
      platform,
      purpose,
      mallId: mallId || null,
      shopUrl: shopUrl || null,
      apiBaseUrl: apiBaseUrl || null,
      apiKey: apiKey || null,
      apiSecret: apiSecret || null,
      accessToken: accessToken || null,
      refreshToken: refreshToken || null,
      sourcingConfig: sourcingConfig || undefined,
      checkoutConfig: checkoutConfig || undefined,
    },
    select: {
      id: true,
      name: true,
      platform: true,
      purpose: true,
      isActive: true,
    },
  })

  return NextResponse.json({ success: true, data: created }, { status: 201 })
}
