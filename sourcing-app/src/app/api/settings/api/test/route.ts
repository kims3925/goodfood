import { NextRequest, NextResponse } from 'next/server'

/**
 * Band API 에러 코드를 사용자 친화적 메시지로 변환
 */
function getBandErrorMessage(resultCode: number, httpStatus?: number): { message: string; solution: string } {
  const errorMap: Record<number, { message: string; solution: string }> = {
    // 파라미터 오류
    211: {
      message: '잘못된 파라미터입니다.',
      solution: '입력한 설정 값을 확인해주세요.',
    },
    212: {
      message: '필수 파라미터가 누락되었습니다.',
      solution: '필수 파라미터를 확인하고 추가해주세요.',
    },

    // 쿼터 및 제한
    1001: {
      message: 'Band API 쿼터가 초과되었습니다.',
      solution: '앱의 일일 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
    },
    1002: {
      message: '사용자별 API 쿼터가 초과되었습니다.',
      solution: '사용자의 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
    },
    1003: {
      message: 'API 쿨타임 제한입니다.',
      solution: '짧은 시간 안에 연속 호출이 불가능합니다. 잠시 후 다시 시도해주세요.',
    },

    // 권한 오류
    2142: {
      message: '밴드 리더만 사용할 수 있는 기능입니다.',
      solution: '밴드 리더 권한이 필요합니다.',
    },
    2300: {
      message: '서버 응답 오류가 발생했습니다.',
      solution: '정의되지 않은 오류입니다. 클라이언트 ID와 요청 정보를 첨부하여 고객센터에 문의해주세요.',
    },

    // 요청 오류
    3000: {
      message: '잘못된 요청입니다.',
      solution: '경로 및 파라미터를 확인한 후 다시 시도해주세요.',
    },
    3001: {
      message: '문자열 길이 제한을 초과했습니다.',
      solution: '내용을 줄인 후 다시 시도해주세요.',
    },
    3002: {
      message: '이미지 파일 크기가 너무 큽니다.',
      solution: '이미지 파일 크기를 줄인 후 다시 시도해주세요.',
    },
    3003: {
      message: '첨부 이미지 개수가 제한을 초과했습니다.',
      solution: '첨부 이미지 수를 줄인 후 다시 시도해주세요.',
    },

    // 인증/권한
    10401: {
      message: '인증 토큰이 없거나 만료되었습니다.',
      solution: 'Band Developers에서 새로운 Access Token을 발급받아 입력해주세요.',
    },
    10403: {
      message: '접근 권한이 없습니다.',
      solution: '해당 기능 사용 권한을 확인해주시고, 권한을 추가하려면 고객센터로 문의해주세요.',
    },

    // 파라미터 검증
    60000: {
      message: '잘못된 파라미터입니다.',
      solution: '필수 파라미터와 파라미터 타입을 확인한 후 다시 시도해주세요.',
    },

    // 사용자 관련
    60100: {
      message: '존재하지 않는 사용자입니다.',
      solution: '사용자 정보를 확인해주세요.',
    },
    60101: {
      message: '사용자의 친구가 아닙니다.',
      solution: '친구 관계를 확인해주세요.',
    },
    60102: {
      message: '밴드 멤버가 아닙니다.',
      solution: '밴드에 가입한 후 다시 시도해주세요.',
    },
    60103: {
      message: '연동되지 않은 사용자입니다.',
      solution: '사용자 연동을 확인해주세요.',
    },
    60104: {
      message: '이미 연동된 사용자입니다.',
      solution: '이미 연동되어 있습니다.',
    },
    60105: {
      message: '멤버가 있는 밴드는 리더가 탈퇴할 수 없습니다.',
      solution: '밴드 멤버를 모두 내보낸 후 탈퇴해주세요.',
    },
    60106: {
      message: '특정 멤버에게만 권한이 부여된 기능입니다.',
      solution: '권한을 확인해주세요.',
    },

    // 밴드 관련
    60200: {
      message: '존재하지 않거나 연동되지 않은 밴드입니다.',
      solution: '밴드가 존재하는지, 연동되었는지 확인해주세요.',
    },
    60201: {
      message: '이미 가입한 밴드입니다.',
      solution: '이미 가입되어 있습니다.',
    },
    60202: {
      message: '가입할 수 있는 최대 밴드 수를 초과했습니다.',
      solution: '밴드 수 제한에 도달했습니다.',
    },
    60203: {
      message: '앱과 연동되지 않은 밴드입니다.',
      solution: '밴드 연동을 확인해주세요.',
    },
    60204: {
      message: '접근이 차단된 밴드입니다.',
      solution: '밴드 접근 권한을 확인해주세요.',
    },

    // 메시지 관련
    60300: {
      message: '상대방이 메시지 수신을 거부했습니다.',
      solution: '메시지를 보낼 수 없습니다.',
    },
    60301: {
      message: '메시지 형식이 올바르지 않습니다.',
      solution: '메시지 형식을 확인해주세요.',
    },
    60302: {
      message: '메시지 서비스 오류가 발생했습니다.',
      solution: '잠시 후 다시 시도해주세요.',
    },

    // 포스트 관련
    60400: {
      message: '글쓰기 권한이 없습니다.',
      solution: '글쓰기 권한을 확인해주세요.',
    },
    60401: {
      message: '앱과 연동되지 않은 포스트입니다.',
      solution: '포스트 연동을 확인해주세요.',
    },
    60402: {
      message: '포스트를 수정할 수 없습니다.',
      solution: '이미지 또는 하위 포스트가 삭제되었을 수 있습니다.',
    },

    // 기타
    60700: {
      message: '유효하지 않은 초대장입니다.',
      solution: '초대장을 다시 확인해주세요.',
    },
    60800: {
      message: '유효하지 않은 형식의 이미지 URL입니다.',
      solution: '이미지 URL 형식을 확인해주세요.',
    },
    60801: {
      message: '존재하지 않는 앨범입니다.',
      solution: '앨범 ID를 확인해주세요.',
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
