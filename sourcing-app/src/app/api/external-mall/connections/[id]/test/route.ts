/**
 * POST /api/external-mall/connections/[id]/test
 * 외부몰 연결 테스트 (커넥터.testConnection 호출)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { ConnectorFactory } from '@/modules/external-mall/external-mall.service'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const id = Number(params.id)
  const conn = await prisma.externalMallConnection.findFirst({
    where: { id, userId: me.userId, deletedAt: null },
  })
  if (!conn) return NextResponse.json({ success: false, error: '없음' }, { status: 404 })

  try {
    const connector = ConnectorFactory.create({
      platform: conn.platform,
      mallId: conn.mallId,
      apiBaseUrl: conn.apiBaseUrl,
      apiKey: conn.apiKey,
      apiSecret: conn.apiSecret,
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken,
      sourcingConfig: conn.sourcingConfig as any,
      checkoutConfig: conn.checkoutConfig as any,
    })
    const result = await connector.testConnection()

    await prisma.externalMallConnection.update({
      where: { id },
      data: {
        lastError: result.success ? null : result.message,
      },
    })

    return NextResponse.json({ success: result.success, message: result.message })
  } catch (err: any) {
    await prisma.externalMallConnection.update({
      where: { id },
      data: { lastError: err?.message || 'unknown' },
    }).catch(() => {})
    return NextResponse.json(
      { success: false, error: err?.message || '테스트 실패' },
      { status: 500 }
    )
  }
}
