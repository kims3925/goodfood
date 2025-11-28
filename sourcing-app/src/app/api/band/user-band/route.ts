import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// GET: 사용자의 Band 목록 조회 (Band API 연동)
export async function GET(request: NextRequest) {
  try {
    // 세션에서 userId 가져오기
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: '로그인이 필요합니다.',
        },
        { status: 401 }
      )
    }
    const userId = currentUser.userId

    // 1. 사용자의 Band API 설정 조회
    const apiConfig = await prisma.sourcingApiConfig.findFirst({
      where: {
        userId,
        platform: 'BAND',
        isActive: true,
      },
    })

    if (!apiConfig) {
      return NextResponse.json(
        {
          success: false,
          error: 'Band API 설정을 먼저 등록해주세요.',
        },
        { status: 404 }
      )
    }

    // 2. Band API 호출
    try {
      const response = await fetch('https://openapi.band.us/v2.1/bands', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiConfig.accessToken}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        return NextResponse.json(
          {
            success: false,
            error: `Band API 오류 (${response.status}): ${errorData.result_data?.message || '알 수 없는 오류'}`,
          },
          { status: response.status }
        )
      }

      const data = await response.json()

      if (data.result_code === 1 && data.result_data?.bands) {
        return NextResponse.json({
          success: true,
          data: data.result_data.bands.map((band: any) => ({
            band_key: band.band_key,
            name: band.name,
            description: band.description || '',
            cover: band.cover || '',
          })),
        })
      } else {
        return NextResponse.json(
          {
            success: false,
            error: data.result_data?.message || '밴드 목록을 가져올 수 없습니다.',
          },
          { status: 400 }
        )
      }
    } catch (error: any) {
      console.error('Band API 호출 실패:', error)
      return NextResponse.json(
        {
          success: false,
          error: `Band API 호출 실패: ${error.message}`,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('사용자 밴드 조회 실패:', error)
    return NextResponse.json(
      {
        success: false,
        error: '밴드 목록을 불러오는데 실패했습니다.',
      },
      { status: 500 }
    )
  }
}
