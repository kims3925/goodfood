import { NextRequest, NextResponse } from 'next/server'

/**
 * Band API 에러 코드를 사용자 친화적 메시지로 변환
 */
function getBandErrorMessage(resultCode: number, httpStatus?: number): { message: string; solution: string } {
  const errorMap: Record<number, { message: string; solution: string }> = {
    // Band API 에러 코드
    1001: {
      message: 'Access Token이 만료되었습니다.',
      solution: 'Band Developers에서 새로운 Access Token을 발급받아 입력해주세요.',
    },
    1002: {
      message: 'Access Token이 유효하지 않습니다.',
      solution: 'Access Token을 다시 확인해주세요. 토큰 앞뒤 공백이나 줄바꿈이 없는지 확인하세요.',
    },
    1003: {
      message: 'API 권한이 부족합니다.',
      solution: 'Band Developers에서 앱의 권한 설정을 확인해주세요.',
    },
    1004: {
      message: '요청 파라미터가 올바르지 않습니다.',
      solution: '설정 값을 다시 확인해주세요.',
    },
    1005: {
      message: '해당 밴드를 찾을 수 없습니다.',
      solution: '밴드가 존재하는지, 접근 권한이 있는지 확인해주세요.',
    },
    1006: {
      message: '해당 게시물을 찾을 수 없습니다.',
      solution: '게시물이 삭제되었거나 접근 권한이 없을 수 있습니다.',
    },
    1007: {
      message: 'API 호출 횟수 제한을 초과했습니다.',
      solution: '잠시 후 다시 시도해주세요. (일일 호출 한도: 10,000회)',
    },
    // HTTP 상태 코드 기반 에러
    401: {
      message: '인증에 실패했습니다.',
      solution: 'Access Token이 올바른지 확인하고, 만료되었다면 새로 발급받아주세요.',
    },
    403: {
      message: '접근이 거부되었습니다.',
      solution: 'Band API 앱의 권한 설정을 확인해주세요.',
    },
    429: {
      message: '요청이 너무 많습니다.',
      solution: '잠시 후 다시 시도해주세요.',
    },
    500: {
      message: 'Band 서버에 일시적인 오류가 발생했습니다.',
      solution: '잠시 후 다시 시도해주세요. 문제가 지속되면 Band 개발자 포럼을 확인해주세요.',
    },
    502: {
      message: 'Band 서버에 연결할 수 없습니다.',
      solution: '네트워크 상태를 확인하고 잠시 후 다시 시도해주세요.',
    },
    503: {
      message: 'Band 서비스가 일시적으로 이용 불가능합니다.',
      solution: '잠시 후 다시 시도해주세요.',
    },
  }

  // Band API 에러 코드 확인
  if (errorMap[resultCode]) {
    return errorMap[resultCode]
  }

  // HTTP 상태 코드 확인
  if (httpStatus && errorMap[httpStatus]) {
    return errorMap[httpStatus]
  }

  // 기본 에러
  return {
    message: `알 수 없는 오류가 발생했습니다. (코드: ${resultCode || httpStatus || 'unknown'})`,
    solution: 'Band Developers 포럼에서 해당 에러 코드를 확인해주세요.',
  }
}

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
          solution: 'Band Developers에서 OAuth 인증 후 Access Token을 발급받아 입력해주세요.',
        })
      }

      // 토큰 형식 기본 검증
      const trimmedToken = settings.accessToken.trim()
      if (trimmedToken.length < 20) {
        return NextResponse.json({
          success: false,
          message: 'Access Token 형식이 올바르지 않습니다.',
          solution: 'Access Token을 다시 확인해주세요. 전체 토큰이 복사되었는지 확인하세요.',
        })
      }

      // Band API 호출 테스트
      try {
        console.log('[Band API Test] 연결 테스트 시작')

        const response = await fetch('https://openapi.band.us/v2.1/bands', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${trimmedToken}`,
          },
        })

        console.log('[Band API Test] 응답 상태:', response.status)

        // HTTP 상태 코드 검증
        if (!response.ok) {
          let resultCode = response.status
          try {
            const errorData = await response.json()
            console.error('[Band API Test] 오류 응답:', errorData)
            resultCode = errorData.result_code || response.status
          } catch {
            // JSON 파싱 실패 시 HTTP 상태 코드 사용
          }

          const errorInfo = getBandErrorMessage(resultCode, response.status)
          return NextResponse.json({
            success: false,
            message: errorInfo.message,
            solution: errorInfo.solution,
            errorCode: resultCode,
          })
        }

        // 응답 본문 파싱
        const data = await response.json()
        console.log('[Band API Test] 응답 데이터:', JSON.stringify(data, null, 2))

        // Band API 응답 구조 검증
        // result_code: 1 = 성공, 그 외 = 실패
        if (!data.result_code || data.result_code !== 1) {
          console.error('[Band API Test] 실패 result_code:', data.result_code)
          const errorInfo = getBandErrorMessage(data.result_code)
          return NextResponse.json({
            success: false,
            message: errorInfo.message,
            solution: errorInfo.solution,
            errorCode: data.result_code,
          })
        }

        // bands 배열 존재 검증
        if (!data.result_data || !Array.isArray(data.result_data.bands)) {
          console.error('[Band API Test] 잘못된 응답 구조:', data)
          return NextResponse.json({
            success: false,
            message: 'Band API 응답 형식이 올바르지 않습니다.',
            solution: '잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의하세요.',
          })
        }

        const bandCount = data.result_data.bands.length
        const bandNames = data.result_data.bands.slice(0, 3).map((b: { name: string }) => b.name).join(', ')
        console.log('[Band API Test] 연결 성공, 밴드 수:', bandCount)

        return NextResponse.json({
          success: true,
          message: `연결 성공! 밴드 ${bandCount}개를 확인했습니다.`,
          detail: bandCount > 0 ? `예: ${bandNames}${bandCount > 3 ? ' 외' : ''}` : undefined,
        })
      } catch (error: any) {
        console.error('[Band API Test] 예외 발생:', error)

        // 네트워크 오류 구분
        if (error.cause?.code === 'ENOTFOUND' || error.cause?.code === 'ECONNREFUSED') {
          return NextResponse.json({
            success: false,
            message: 'Band API 서버에 연결할 수 없습니다.',
            solution: '인터넷 연결 상태를 확인해주세요.',
          })
        }

        if (error.name === 'AbortError' || error.cause?.code === 'ETIMEDOUT') {
          return NextResponse.json({
            success: false,
            message: '연결 시간이 초과되었습니다.',
            solution: '네트워크 상태를 확인하고 다시 시도해주세요.',
          })
        }

        return NextResponse.json({
          success: false,
          message: '연결 중 오류가 발생했습니다.',
          solution: error.message || '잠시 후 다시 시도해주세요.',
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
