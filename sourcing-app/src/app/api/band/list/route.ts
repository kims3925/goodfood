export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { NaverBandClient } from '@/modules/sourcing/domain/src/channel/services/band-client.service'
import { settingsService } from '@/modules/config/domain/src/settings'

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

    // 유효 토큰 해석 — 일괄설정(useGlobalToken) 모드면 어드민 공용 토큰 사용
    const { accessToken } = await settingsService.getEffectiveBandToken(currentUser.userId)

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Band API 설정을 먼저 등록해주세요.' },
        { status: 404 }
      )
    }

    // Band API로 밴드 목록 조회
    const bandClient = new NaverBandClient(accessToken)
    const bands = await bandClient.getBands()

    return NextResponse.json({
      success: true,
      data: bands.map((band) => ({
        bandKey: band.band_key,
        name: band.name,
        coverUrl: band.cover,
        memberCount: band.member_count,
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
