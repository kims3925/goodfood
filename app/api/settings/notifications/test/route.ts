import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const {
      emailEnabled,
      emailAddress,
      kakaoEnabled,
      kakaoToken,
      smsEnabled,
      phoneNumber,
      orderNotifications,
      errorNotifications,
      completionNotifications
    } = await request.json()

    const testResults: string[] = []
    let hasError = false

    // 이메일 알림 테스트
    if (emailEnabled) {
      if (!emailAddress) {
        testResults.push('❌ 이메일: 주소가 입력되지 않았습니다.')
        hasError = true
      } else if (!emailAddress.includes('@')) {
        testResults.push('❌ 이메일: 올바르지 않은 이메일 형식입니다.')
        hasError = true
      } else {
        testResults.push('✅ 이메일: 설정 완료')
        // 실제로는 여기서 테스트 이메일을 발송할 수 있습니다.
      }
    }

    // 카카오톡 알림 테스트
    if (kakaoEnabled) {
      if (!kakaoToken) {
        testResults.push('❌ 카카오톡: API 토큰이 입력되지 않았습니다.')
        hasError = true
      } else if (kakaoToken.length < 20) {
        testResults.push('❌ 카카오톡: API 토큰이 너무 짧습니다.')
        hasError = true
      } else {
        testResults.push('✅ 카카오톡: 설정 완료 (실제 연결 테스트는 개발 중)')
        // 실제로는 여기서 카카오톡 API 연결을 테스트할 수 있습니다.
      }
    }

    // SMS 알림 테스트
    if (smsEnabled) {
      if (!phoneNumber) {
        testResults.push('❌ SMS: 휴대폰 번호가 입력되지 않았습니다.')
        hasError = true
      } else if (!phoneNumber.match(/^010-\d{4}-\d{4}$/)) {
        testResults.push('❌ SMS: 올바르지 않은 휴대폰 번호 형식입니다. (010-XXXX-XXXX)')
        hasError = true
      } else {
        testResults.push('✅ SMS: 설정 완료 (실제 연결 테스트는 개발 중)')
        // 실제로는 여기서 SMS API 연결을 테스트할 수 있습니다.
      }
    }

    // 알림 유형 확인
    const enabledNotifications = []
    if (orderNotifications) enabledNotifications.push('주문')
    if (errorNotifications) enabledNotifications.push('에러')
    if (completionNotifications) enabledNotifications.push('작업완료')

    if (enabledNotifications.length === 0) {
      testResults.push('⚠️ 알림 유형: 선택된 알림이 없습니다.')
    } else {
      testResults.push(`✅ 알림 유형: ${enabledNotifications.join(', ')} 알림이 활성화됩니다.`)
    }

    // 활성화된 알림 방식 확인
    const enabledMethods = []
    if (emailEnabled) enabledMethods.push('이메일')
    if (kakaoEnabled) enabledMethods.push('카카오톡')
    if (smsEnabled) enabledMethods.push('SMS')

    if (enabledMethods.length === 0) {
      testResults.push('❌ 알림 방식: 활성화된 알림 방식이 없습니다.')
      hasError = true
    } else {
      testResults.push(`📱 활성화된 알림 방식: ${enabledMethods.join(', ')}`)
    }

    return NextResponse.json({
      success: !hasError,
      message: testResults.join('\n')
    })

  } catch (error) {
    console.error('알림 테스트 실패:', error)
    return NextResponse.json({
      success: false,
      message: '알림 테스트 중 오류가 발생했습니다.'
    })
  }
}