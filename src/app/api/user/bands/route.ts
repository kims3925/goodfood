import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import prisma from '@/lib/database/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    // 데이터베이스에서 사용자의 Band API 설정 조회
    const userId = parseInt(session.user.id, 10)
    const bandSettings = await prisma.bandApiSettings.findUnique({
      where: { userId },
      select: {
        accessToken: true,
        clientId: true,
        clientSecret: true
      }
    })

    const bandAccessToken = bandSettings?.accessToken

    if (!bandAccessToken) {
      // Band API 설정이 필요함을 명확히 알림
      return NextResponse.json({
        success: false,
        error: 'Band API 설정이 필요합니다.',
        needsSetup: true,
        bands: [],
        total_count: 0
      }, { status: 400 })
    }

    try {
      // 사용자의 밴드 목록 조회
      const response = await fetch('https://openapi.band.us/v2.1/bands', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bandAccessToken}`,
          'User-Agent': 'BandAuto/1.0.0'
        }
      })

      if (!response.ok) {
        console.error(`밴드 API 호출 실패 (HTTP ${response.status})`)
        return NextResponse.json({
          success: false,
          error: `Band API 호출 실패 (HTTP ${response.status})`,
          bands: [],
          total_count: 0
        }, { status: response.status })
      }

      const data = await response.json()

      if (data.result_code === 1 && data.result_data?.bands) {
        const bands = data.result_data.bands.map((band: any) => ({
          band_key: band.band_key,
          name: band.name,
          description: band.description || '',
          member_count: band.member_count || 0,
          cover: band.cover || null,
          is_public: band.is_public || false
        }))

        return NextResponse.json({
          success: true,
          bands,
          total_count: bands.length
        })
      } else {
        console.error('밴드 API 응답 오류:', data)
        return NextResponse.json({
          success: false,
          error: `Band API 응답 오류: ${data.result_message || '알 수 없는 오류'}`,
          bands: [],
          total_count: 0
        }, { status: 500 })
      }
    } catch (apiError) {
      console.error('밴드 API 예외 발생:', apiError)
      return NextResponse.json({
        success: false,
        error: 'Band API 호출 중 오류가 발생했습니다.',
        bands: [],
        total_count: 0
      }, { status: 500 })
    }

  } catch (error) {
    console.error('사용자 밴드 목록 조회 실패:', error)
    return NextResponse.json({
      success: false,
      error: '밴드 목록 조회 중 오류가 발생했습니다.',
      bands: [],
      total_count: 0
    }, { status: 500 })
  }
}