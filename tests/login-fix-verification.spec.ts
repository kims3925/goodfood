import { test, expect } from '@playwright/test'

test.describe('로그인 수정 검증', () => {
  test('수정된 로그인 폼으로 실제 로그인 테스트', async ({ page }) => {
    console.log('🔑 수정된 로그인 폼 테스트 시작...')

    // 1. 로그인 페이지로 이동
    await page.goto('http://54.253.75.175:3000/login')
    await page.waitForLoadState('networkidle')

    console.log(`🔍 현재 URL: ${page.url()}`)

    // 2. name 속성으로 입력 필드 찾기
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.locator('button[type="submit"]')

    // 3. 요소 존재 여부 확인
    const emailExists = await emailInput.count() > 0
    const passwordExists = await passwordInput.count() > 0
    const submitExists = await submitButton.count() > 0

    console.log(`📝 이메일 입력 (name): ${emailExists ? '✅' : '❌'}`)
    console.log(`📝 비밀번호 입력 (name): ${passwordExists ? '✅' : '❌'}`)
    console.log(`📝 제출 버튼: ${submitExists ? '✅' : '❌'}`)

    if (!emailExists || !passwordExists || !submitExists) {
      console.log('❌ 필요한 폼 요소를 찾을 수 없음')
      return
    }

    // 4. 로그인 시도
    console.log('🔐 로그인 시도...')

    await emailInput.fill('test@bandauto.com')
    await passwordInput.fill('test123!@#')

    // 로그인 요청 모니터링
    const loginRequests: any[] = []
    page.on('request', request => {
      if (request.url().includes('/api/auth')) {
        loginRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        })
        console.log(`📡 Auth API 요청: ${request.method()} ${request.url()}`)
      }
    })

    page.on('response', response => {
      if (response.url().includes('/api/auth')) {
        console.log(`📊 Auth API 응답: ${response.status()} ${response.url()}`)
      }
    })

    // 제출 버튼 클릭
    await submitButton.click()

    // 리다이렉트 대기
    await page.waitForTimeout(5000)

    console.log(`🔍 로그인 후 URL: ${page.url()}`)

    // 5. 세션 확인
    const sessionResponse = await page.request.get('http://54.253.75.175:3000/api/auth/session')
    console.log(`🔍 세션 API 응답: ${sessionResponse.status()}`)

    if (sessionResponse.ok()) {
      const sessionData = await sessionResponse.json()
      console.log('🔍 세션 데이터:', JSON.stringify(sessionData, null, 2))

      if (sessionData.user) {
        console.log('✅ 로그인 성공!')

        // 6. API 테스트
        console.log('🧪 인증된 상태에서 API 테스트...')

        const apiTests = [
          { url: '/api/settings/band', name: 'Band 설정' },
          { url: '/api/wholesale/bands', name: '도매 밴드' },
          { url: '/api/products', name: '상품' }
        ]

        for (const apiTest of apiTests) {
          const apiResponse = await page.request.get(`http://54.253.75.175:3000${apiTest.url}`)
          console.log(`📊 ${apiTest.name} API: ${apiResponse.status()}`)

          if (apiResponse.status() === 401) {
            console.log(`❌ ${apiTest.name} API 여전히 401 오류`)
          } else if (apiResponse.ok()) {
            console.log(`✅ ${apiTest.name} API 정상 작동`)
          }
        }
      } else {
        console.log('❌ 로그인 실패 - 세션에 사용자 정보 없음')
      }
    } else {
      console.log('❌ 세션 API 호출 실패')
    }

    console.log(`🔍 총 Auth API 요청 수: ${loginRequests.length}`)
    console.log('🎉 로그인 테스트 완료!')
  })
})