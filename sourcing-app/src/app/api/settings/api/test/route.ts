import { NextRequest, NextResponse } from 'next/server'

// POST: API 연결 테스트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, settings } = body

    // Band API 연결 테스트
    if (provider === 'band') {
      // 필수 필드 검증 - Access Token만 필요
      if (!settings.accessToken || settings.accessToken.trim() === '') {
        return NextResponse.json({
          success: false,
          message: 'Access Token이 필요합니다.',
        })
      }

      // Band API 호출 테스트
      try {
        console.log('[Band API Test] 연결 테스트 시작')

        const response = await fetch('https://openapi.band.us/v2.1/bands', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${settings.accessToken}`,
          },
        })

        console.log('[Band API Test] 응답 상태:', response.status)

        // HTTP 상태 코드 검증
        if (!response.ok) {
          let errorMessage = '알 수 없는 오류'
          try {
            const errorData = await response.json()
            console.error('[Band API Test] 오류 응답:', errorData)
            errorMessage = errorData.result_data?.message || errorData.message || `HTTP ${response.status}`
          } catch {
            errorMessage = await response.text() || `HTTP ${response.status}`
          }

          if (response.status === 401 || response.status === 403) {
            return NextResponse.json({
              success: false,
              message: `인증 실패: Access Token이 유효하지 않거나 만료되었습니다. (${response.status})`,
            })
          }

          return NextResponse.json({
            success: false,
            message: `Band API 오류 (${response.status}): ${errorMessage}`,
          })
        }

        // 응답 본문 파싱
        const data = await response.json()
        console.log('[Band API Test] 응답 데이터:', JSON.stringify(data, null, 2))

        // Band API 응답 구조 검증
        // result_code: 1 = 성공, 그 외 = 실패
        if (!data.result_code || data.result_code !== 1) {
          console.error('[Band API Test] 실패 result_code:', data.result_code)
          return NextResponse.json({
            success: false,
            message: `Band API 인증 실패: ${data.result_data?.message || 'Access Token이 유효하지 않습니다'} (code: ${data.result_code})`,
          })
        }

        // bands 배열 존재 검증
        if (!data.result_data || !Array.isArray(data.result_data.bands)) {
          console.error('[Band API Test] 잘못된 응답 구조:', data)
          return NextResponse.json({
            success: false,
            message: 'Band API 응답 형식이 올바르지 않습니다.',
          })
        }

        const bandCount = data.result_data.bands.length
        console.log('[Band API Test] 연결 성공, 밴드 수:', bandCount)

        return NextResponse.json({
          success: true,
          message: `연결 성공! 사용자의 밴드 ${bandCount}개를 확인했습니다.`,
        })
      } catch (error: any) {
        console.error('[Band API Test] 예외 발생:', error)
        return NextResponse.json({
          success: false,
          message: `연결 실패: ${error.message || '네트워크 오류가 발생했습니다'}`,
        })
      }
    }

    // AliExpress API 연결 테스트
    else if (provider === 'aliexpress') {
      // 필수 필드 검증
      if (!settings.apiKey || !settings.appSecret) {
        return NextResponse.json({
          success: false,
          message: 'API Key와 App Secret이 필요합니다.',
        })
      }

      console.log('[AliExpress API Test] 연결 테스트 시작')

      // 기본 형식 검증
      if (settings.apiKey.length < 10 || settings.appSecret.length < 10) {
        return NextResponse.json({
          success: false,
          message: 'API Key 또는 App Secret 형식이 올바르지 않습니다. (최소 10자 이상)',
        })
      }

      // AliExpress API는 복잡한 서명 방식을 사용하므로 실제 연결 테스트는 생략
      // 실제 검증은 상품 조회 시 수행됨
      console.log('[AliExpress API Test] 기본 검증 완료')

      return NextResponse.json({
        success: true,
        message: 'API Key와 App Secret 형식이 확인되었습니다. 실제 연결은 상품 조회 시 검증됩니다.',
      })
    }

    // 지원하지 않는 플랫폼
    else {
      return NextResponse.json({
        success: false,
        message: '지원하지 않는 플랫폼입니다.',
      })
    }
  } catch (error) {
    console.error('연결 테스트 실패:', error)
    return NextResponse.json(
      {
        success: false,
        message: '연결 테스트 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
