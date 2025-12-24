export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { NaverBandClient } from '@/modules/sourcing/domain/src/channel/services/band-client.service'

// GET: 사용자의 밴드 목록 조회
export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 사용자의 BAND API 설정 조회
    const apiConfig = await prisma.sourcingApiConfig.findFirst({
      where: {
        userId: currentUser.userId,
        platform: 'BAND',
        isActive: true,
      },
    })

    if (!apiConfig || !apiConfig.accessToken) {
      return NextResponse.json(
        { success: false, error: 'Band API 설정을 먼저 등록해주세요.' },
        { status: 404 }
      )
    }

    // Band API로 밴드 목록 조회
    const bandClient = new NaverBandClient(apiConfig.accessToken)
    const bands = await bandClient.getBands()

    return NextResponse.json({
      success: true,
      data: bands.map((band) => ({
        bandKey: band.band_key,
        name: band.name,
        coverUrl: band.cover,
      })),
    })
  } catch (error: any) {
    console.error('밴드 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message || '밴드 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
