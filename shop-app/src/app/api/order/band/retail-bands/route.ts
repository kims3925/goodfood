import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'

/**
 * GET /api/order/band/retail-bands
 * 소매밴드 목록 조회 (활성화된 밴드만)
 */
export async function GET() {
  try {
    const retailBands = await prisma.retailBand.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        bandKey: true,
        coverUrl: true,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: retailBands,
    })
  } catch (error) {
    console.error('[Band Order] 소매밴드 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '소매밴드 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
