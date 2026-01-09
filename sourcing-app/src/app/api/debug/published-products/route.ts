import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

// 임시 디버그용 - 인증 없이 접근 가능
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // ShopProduct 통계 (Soft Delete 제외)
    const shopProductTotal = await prisma.shopProduct.count({
      where: { deletedAt: null },
    })

    // ChannelProduct 통계 (Soft Delete 제외)
    const channelProductTotal = await prisma.channelProduct.count({
      where: { deletedAt: null },
    })

    // ShopProduct 샘플 데이터 조회 (최근 10개, Soft Delete 제외)
    const shopProductSamples = await prisma.shopProduct.findMany({
      where: { deletedAt: null },
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

    // ChannelProduct 샘플 데이터 조회 (최근 10개, Soft Delete 제외)
    const channelProductSamples = await prisma.channelProduct.findMany({
      where: { deletedAt: null },
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
