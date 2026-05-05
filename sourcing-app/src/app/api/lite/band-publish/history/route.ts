/**
 * GET /api/lite/band-publish/history — 라이트 셀러 본인의 Band 발행 이력
 *
 * ChannelProduct 중 본인 RETAIL Band 채널 발행만 조회.
 * 자동 발행 cron 이 ChannelProduct 를 생성하므로 그게 곧 발행 이력.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 })

  const items = await prisma.channelProduct.findMany({
    where: {
      userId: me.userId,
      deletedAt: null,
      channel: { kind: 'RETAIL', platform: 'BAND' },
    },
    select: {
      id: true,
      productId: true,
      postKey: true,
      publishedAt: true,
      isActive: true,
      product: {
        select: {
          name: true,
          thumbnailUrl: true,
          price: true,
        },
      },
      channel: {
        select: { id: true, name: true, channelKey: true },
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 100,
  })

  // 자동 발행 로그도 같이 (요약)
  const recentLogs = await prisma.liteAutoPublishLog.findMany({
    where: { userId: me.userId },
    orderBy: { publishedAt: 'desc' },
    take: 10,
    select: {
      publishedAt: true,
      count: true,
      status: true,
      errorMessage: true,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      items: items.map((i) => ({
        id: i.id,
        product: i.product,
        postKey: i.postKey,
        publishedAt: i.publishedAt,
        isActive: i.isActive,
        bandUrl: i.postKey
          ? `https://band.us/band/${i.channel.channelKey}/post/${i.postKey}`
          : null,
        channelName: i.channel.name,
      })),
      recentLogs,
    },
  })
}
