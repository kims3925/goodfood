import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

// 임시 디버그용 - 인증 없이 접근 가능
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // ShopProduct 통계
    const shopProductTotal = await prisma.shopProduct.count()

    // ChannelProduct 통계
    const channelProductTotal = await prisma.channelProduct.count()

    // ShopProduct 샘플 데이터 조회 (최근 10개)
    const shopProductSamples = await prisma.shopProduct.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        productId: true,
        shopId: true,
        publishedAt: true,
        createdAt: true,
      }
    })

    // ChannelProduct 샘플 데이터 조회 (최근 10개)
    const channelProductSamples = await prisma.channelProduct.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        productId: true,
        channelId: true,
        publishedAt: true,
        createdAt: true,
      }
    })

    return NextResponse.json({
      success: true,
      stats: {
        shopProductTotal,
        channelProductTotal,
        total: shopProductTotal + channelProductTotal,
      },
      shopProductSamples,
      channelProductSamples,
    })
  } catch (error: any) {
    console.error('Error checking published products:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
