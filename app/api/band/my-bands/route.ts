import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { accessToken, searchTerm } = await req.json()

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access token is required',
        },
        { status: 400 }
      )
    }

    // TODO: 실제 밴드 API 호출
    // 현재는 시뮬레이션 데이터 반환
    const mockBands = [
      {
        band_key: 'band_001',
        name: '테스트 소매밴드 1',
        description: '소매업자들을 위한 상품 공유 밴드',
        member_count: 1250,
        cover: 'https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Band1'
      },
      {
        band_key: 'band_002',
        name: '테스트 소매밴드 2',
        description: '신선한 식품을 소매가로 판매하는 밴드',
        member_count: 890,
        cover: 'https://via.placeholder.com/300x200/2196F3/FFFFFF?text=Band2'
      },
      {
        band_key: 'band_003',
        name: '테스트 소매밴드 3',
        description: '다양한 상품을 소매하는 밴드입니다',
        member_count: 2150,
        cover: 'https://via.placeholder.com/300x200/FF9800/FFFFFF?text=Band3'
      }
    ]

    // 검색어가 있으면 필터링
    const filteredBands = searchTerm
      ? mockBands.filter(band =>
          band.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          band.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : mockBands

    // 실제 밴드 API 호출 코드 (주석 처리)
    /*
    try {
      const response = await fetch('https://openapi.band.us/v2/bands', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch bands from Band API')
      }

      const data = await response.json()
      const bands = data.result_data?.bands || []

      // 검색어가 있으면 필터링
      const filteredBands = searchTerm
        ? bands.filter(band =>
            band.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            band.description.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : bands

      return NextResponse.json({
        success: true,
        bands: filteredBands
      })
    } catch (apiError) {
      console.error('Band API Error:', apiError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch bands from Band API'
        },
        { status: 500 }
      )
    }
    */

    return NextResponse.json({
      success: true,
      bands: filteredBands
    })

  } catch (error) {
    console.error('Failed to search my bands:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search bands',
      },
      { status: 500 }
    )
  }
}