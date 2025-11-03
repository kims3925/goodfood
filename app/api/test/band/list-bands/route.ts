import { NextRequest, NextResponse } from 'next/server'

/**
 * 접근 가능한 밴드 목록 조회 및 "나은 상품 공급방" 검색
 * GET /api/test/band/list-bands
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 접근 가능한 밴드 목록 조회 시작...')
    
    const accessToken = process.env.BAND_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'BAND_ACCESS_TOKEN이 설정되지 않았습니다.'
      }, { status: 500 })
    }

    console.log('🔑 토큰 미리보기:', accessToken.substring(0, 20) + '...')

    // 내가 속한 밴드 목록 조회
    const bandsResponse = await fetch('https://openapi.band.us/v2.1/bands', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'BandAuto/1.0.0'
      }
    })

    if (!bandsResponse.ok) {
      const errorText = await bandsResponse.text()
      console.error('❌ 밴드 목록 조회 실패:', bandsResponse.status, errorText)
      
      return NextResponse.json({
        success: false,
        error: `밴드 목록 조회 실패: HTTP ${bandsResponse.status}`,
        details: errorText
      }, { status: bandsResponse.status })
    }

    const bandsData = await bandsResponse.json()
    console.log('✅ 밴드 목록 조회 성공')

    if (!bandsData.result_data?.bands) {
      return NextResponse.json({
        success: true,
        message: '접근 가능한 밴드가 없습니다.',
        data: {
          totalBands: 0,
          bands: []
        }
      })
    }

    const bands = bandsData.result_data.bands
    console.log('📊 총 밴드 수:', bands.length)

    // "나은 상품 공급방" 관련 밴드 검색
    const searchKeywords = ['나은', '상품', '공급', '공급방', '도매', 'wholesale']
    const matchingBands = []
    const allBandsInfo = []

    for (const band of bands) {
      // 모든 밴드 정보 수집
      const bandInfo = {
        band_key: band.band_key,
        name: band.name,
        description: band.description || '',
        member_count: band.member_count || 0,
        cover_image: band.cover || null,
        is_public: band.is_public || false,
        created_at: band.created_at || null
      }
      
      allBandsInfo.push(bandInfo)

      // 키워드 매칭 검사
      const bandName = (band.name || '').toLowerCase()
      const bandDesc = (band.description || '').toLowerCase()
      
      const hasMatchingKeyword = searchKeywords.some(keyword => 
        bandName.includes(keyword) || bandDesc.includes(keyword)
      )

      if (hasMatchingKeyword) {
        matchingBands.push({
          ...bandInfo,
          matched_keywords: searchKeywords.filter(keyword => 
            bandName.includes(keyword) || bandDesc.includes(keyword)
          ),
          similarity_score: searchKeywords.filter(keyword => 
            bandName.includes(keyword) || bandDesc.includes(keyword)
          ).length
        })
      }

      console.log(`📝 밴드: ${band.name} (${band.band_key}) - 멤버: ${band.member_count}`)
    }

    // 유사도 기준으로 정렬
    matchingBands.sort((a, b) => b.similarity_score - a.similarity_score)

    console.log('🎯 매칭된 밴드 수:', matchingBands.length)

    // 기존에 사용하던 밴드 키 검증
    const oldBandKey = 'AAAMvZteE5OjyYnjS64rQuH3'
    const oldBandExists = allBandsInfo.find(band => band.band_key === oldBandKey)

    return NextResponse.json({
      success: true,
      message: `${bands.length}개의 밴드에 접근 가능, ${matchingBands.length}개의 후보 밴드 발견`,
      
      search_results: {
        total_bands: bands.length,
        matching_bands_count: matchingBands.length,
        search_keywords: searchKeywords,
        old_band_key_exists: !!oldBandExists,
        old_band_info: oldBandExists || null
      },
      
      matching_bands: matchingBands.slice(0, 10), // 상위 10개만
      
      all_bands: allBandsInfo.map(band => ({
        band_key: band.band_key,
        name: band.name,
        member_count: band.member_count,
        name_preview: band.name.length > 20 ? band.name.substring(0, 20) + '...' : band.name
      })),
      
      recommendations: matchingBands.length > 0 ? [
        `🎯 최고 후보: ${matchingBands[0].name} (${matchingBands[0].band_key})`,
        `👥 멤버 수: ${matchingBands[0].member_count}명`,
        `🔍 매칭 키워드: ${matchingBands[0].matched_keywords.join(', ')}`,
        '📝 이 밴드 키로 게시물 수집을 시도해보세요.'
      ] : [
        '⚠️ "나은 상품 공급방" 키워드와 매칭되는 밴드를 찾지 못했습니다.',
        '🔍 전체 밴드 목록에서 수동으로 확인이 필요합니다.',
        '💡 밴드 이름이 다르게 표기되어 있을 수 있습니다.'
      ],
      
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 밴드 목록 조회 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}