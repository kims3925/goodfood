import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

// 임시 디버그용 - 인증 없이 접근 가능
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 전체 레코드 수
    const total = await prisma.publishedProduct.count()

    // channelId가 null인 레코드 수
    const nullChannelCount = await prisma.publishedProduct.count({
      where: { channelId: null }
    })

    // shopId가 null인 레코드 수
    const nullShopCount = await prisma.publishedProduct.count({
      where: { shopId: null }
    })

    // channelId와 shopId 모두 null인 레코드 수
    const bothNull = await prisma.publishedProduct.count({
      where: {
        channelId: null,
        shopId: null
      }
    })

    // 샘플 데이터 조회 (최근 20개)
    const samples = await prisma.publishedProduct.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        productId: true,
        channelId: true,
        shopId: true,
        productName: true,
        publishedAt: true,
        createdAt: true,
      }
    })

    // channelId가 null인 샘플
    const nullChannelSamples = await prisma.publishedProduct.findMany({
      where: { channelId: null },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        productId: true,
        channelId: true,
        shopId: true,
        productName: true,
        publishedAt: true,
        createdAt: true,
      }
    })

    return NextResponse.json({
      success: true,
      stats: {
        total,
        nullChannelCount,
        nullShopCount,
        bothNull,
      },
      samples,
      nullChannelSamples,
    })
  } catch (error: any) {
    console.error('Error checking published products:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
