export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * Band API 에러 메시지 반환
 */
function getBandErrorMessage(code: number): { message: string; detail: string } | null {
  // 인증 관련
  if (code === 401 || code === -401) {
    return { message: 'Access Token이 만료되었거나 유효하지 않습니다.', detail: 'Band 개발자 콘솔에서 새 토큰을 발급받아주세요.' }
  }
  if (code === 101) {
    return { message: 'Access Token이 유효하지 않습니다.', detail: 'Band 개발자 콘솔에서 토큰을 확인해주세요.' }
  }
  if (code === 102) {
    return { message: 'Access Token이 만료되었습니다.', detail: 'Band 개발자 콘솔에서 새 토큰을 발급받아주세요.' }
  }

  // 쿼터 및 제한
  if (code === 429 || code === -429) {
    return { message: 'API 요청 한도를 초과했습니다.', detail: '잠시 후 다시 시도해주세요.' }
  }
  // 1001: 쿼터 초과 = 토큰은 유효함! (저장 허용)
  if (code === 1001) {
    return null // 성공으로 처리
  }
  if (code === 1002) {
    return { message: '사용자별 API 쿼터가 초과되었습니다.', detail: '잠시 후 다시 시도해주세요.' }
  }
  if (code === 1003) {
    return { message: 'API 쿨타임 제한입니다.', detail: '잠시 후 다시 시도해주세요.' }
  }

  // 권한 관련
  if (code === 201) {
    return { message: '밴드에 대한 접근 권한이 없습니다.', detail: '해당 밴드의 멤버인지 확인해주세요.' }
  }
  if (code === 202) {
    return { message: '앱 연결이 해제되었습니다.', detail: 'Band 앱에서 다시 연동해주세요.' }
  }

  // 파라미터/요청 오류
  if (code === 300) {
    return { message: '잘못된 요청입니다.', detail: 'Access Token 형식이 올바른지 확인해주세요.' }
  }
  if (code === 211 || code === 212) {
    return { message: '필수 파라미터가 누락되었습니다.', detail: 'API 설정을 다시 확인해주세요.' }
  }

  return null
}

/**
 * Band API 연결 테스트
 */
async function testBandConnection(settings: {
  clientId: string
  clientSecret: string
  accessToken: string
}): Promise<{ success: boolean; message: string; detail?: string }> {
  try {
    const { accessToken } = settings

    if (!accessToken) {
      return {
        success: false,
        message: 'Access Token이 필요합니다.',
        detail: 'Band 개발자 콘솔에서 Access Token을 발급받아주세요.',
      }
    }

    // Band API 프로필 조회로 연결 테스트
    const response = await fetch(
      `https://openapi.band.us/v2/profile?access_token=${accessToken}`,
      { method: 'GET' }
    )

    const data = await response.json()

    if (data.result_code === 1) {
      return {
        success: true,
        message: `Band API 연결 성공! (${data.result_data?.name || 'Unknown'})`,
      }
    }

    // 1001: 쿼터 초과 = 토큰은 유효함! (성공으로 처리)
    if (data.result_code === 1001) {
      return {
        success: true,
        message: 'Band API 연결 성공! (쿼터 초과 상태지만 토큰은 유효합니다)',
        detail: '일일 쿼터가 초과되었지만, 현재 프로젝트는 Playwright로 발행하므로 문제없습니다.',
      }
    }

    // 에러 코드별 메시지
    const errorInfo = getBandErrorMessage(data.result_code)
    if (errorInfo) {
      return { success: false, ...errorInfo, errorCode: data.result_code }
    }

    return {
      success: false,
      message: `Band API 오류: ${data.result_msg || data.message || '알 수 없는 오류'}`,
      detail: `에러 코드: ${data.result_code}`,
      errorCode: data.result_code,
    }
  } catch (error: any) {
    console.error('[Band API Test] 오류:', error)
    return {
      success: false,
      message: '연결 실패: 네트워크 오류',
      detail: error.message,
    }
  }
}

/**
 * AliExpress API 연결 테스트
 */
async function testAliExpressConnection(settings: {
  apiKey: string
  appSecret: string
  accessToken: string
  trackingId: string
}): Promise<{ success: boolean; message: string; detail?: string }> {
  try {
    const { apiKey, appSecret, accessToken } = settings

    if (!apiKey || !appSecret) {
      return {
        success: false,
        message: 'API Key와 App Secret이 필요합니다.',
        detail: 'AliExpress Open Platform에서 앱을 등록하고 키를 발급받아주세요.',
      }
    }

    if (accessToken) {
      return {
        success: true,
        message: 'AliExpress API 설정이 저장되었습니다.',
        detail: '실제 API 호출은 상품 검색 시 테스트됩니다.',
      }
    }

    return {
      success: true,
      message: 'AliExpress API 키가 설정되었습니다.',
      detail: 'Access Token 발급 후 전체 기능을 사용할 수 있습니다.',
    }
  } catch (error: any) {
    console.error('[AliExpress API Test] 오류:', error)
    return {
      success: false,
      message: '연결 실패',
      detail: error.message,
    }
  }
}

/**
 * POST /api/settings/api/test
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { provider, settings } = body

    console.log('[API 연결 테스트] 요청:', { provider })

    let testResult: { success: boolean; message: string; detail?: string }

    switch (provider) {
      case 'band':
        testResult = await testBandConnection(settings)
        break
      case 'aliexpress':
        testResult = await testAliExpressConnection(settings)
        break
      case 'taobao':
      case 'coupang':
      case 'mall1688':
        testResult = {
          success: false,
          message: `${provider} API는 아직 지원 준비 중입니다.`,
          detail: '추후 업데이트 예정입니다.',
        }
        break
      default:
        testResult = {
          success: false,
          message: '지원하지 않는 API 제공업체입니다.',
        }
    }

    return NextResponse.json(testResult)
  } catch (error: any) {
    console.error('[API 연결 테스트] 오류:', error)
    return NextResponse.json(
      { success: false, message: '연결 테스트 중 오류가 발생했습니다.', detail: error.message },
      { status: 500 }
    )
  }
}
