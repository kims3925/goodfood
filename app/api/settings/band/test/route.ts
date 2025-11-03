import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json()

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        message: 'Access Token이 필요합니다.'
      })
    }

    // 밴드 API 연결 테스트 - 밴드 목록 조회
    const response = await fetch('https://openapi.band.us/v2.1/bands', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'BandAuto/1.0.0'
      }
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        message: `API 연결 실패: HTTP ${response.status}. 토큰을 확인해주세요.`
      })
    }

    const data = await response.json()

    if (data.result_code === 1 && data.result_data?.bands) {
      const bandsCount = data.result_data.bands.length
      
      return NextResponse.json({
        success: true,
        message: `연결 성공! ${bandsCount}개의 밴드에 접근 가능합니다.`
      })
    } else {
      return NextResponse.json({
        success: false,
        message: '밴드 목록을 가져올 수 없습니다. 토큰 권한을 확인해주세요.'
      })
    }

  } catch (error) {
    console.error('밴드 연결 테스트 실패:', error)
    return NextResponse.json({
      success: false,
      message: '연결 테스트 중 오류가 발생했습니다.'
    })
  }
}