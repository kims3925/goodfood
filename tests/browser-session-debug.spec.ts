import { test, expect } from '@playwright/test'

test.describe('브라우저 세션 디버깅', () => {
  test('브라우저 세션 상태 확인', async ({ page }) => {
    console.log('🔍 브라우저 세션 상태 디버깅...')

    // 1. 서버 연결 확인
    await page.goto('http://54.253.75.175:3000')
    console.log('✅ 서버 연결 확인')

    // 2. 세션 API 직접 호출
    const sessionResponse = await page.request.get('http://54.253.75.175:3000/api/auth/session')
    console.log(`🔍 세션 API 응답 상태: ${sessionResponse.status()}`)

    if (sessionResponse.ok()) {
      const sessionData = await sessionResponse.json()
      console.log('🔍 세션 데이터:', JSON.stringify(sessionData, null, 2))
    } else {
      console.log('❌ 세션 API 실패')
    }

    // 3. 쿠키 확인
    const cookies = await page.context().cookies()
    console.log('🍪 현재 쿠키 개수:', cookies.length)

    const authCookies = cookies.filter(cookie =>
      cookie.name.includes('next-auth') ||
      cookie.name.includes('session') ||
      cookie.name.includes('auth')
    )
    console.log('🔐 인증 관련 쿠키:', authCookies.map(c => c.name))

    // 4. 로그인 페이지 확인
    await page.goto('http://54.253.75.175:3000/login')
    await page.waitForLoadState('networkidle')

    const hasLoginForm = await page.locator('input[name="email"]').isVisible()
    console.log(`🔍 로그인 폼 존재: ${hasLoginForm}`)

    if (hasLoginForm) {
      console.log('📝 로그인 시도...')

      await page.fill('input[name="email"]', 'test@bandauto.com')
      await page.fill('input[name="password"]', 'test123!@#')
      await page.click('button[type="submit"]')

      // 로그인 후 리다이렉트 대기
      await page.waitForTimeout(3000)

      console.log(`🔍 로그인 후 URL: ${page.url()}`)

      // 로그인 후 쿠키 다시 확인
      const newCookies = await page.context().cookies()
      const newAuthCookies = newCookies.filter(cookie =>
        cookie.name.includes('next-auth') ||
        cookie.name.includes('session') ||
        cookie.name.includes('auth')
      )
      console.log('🔐 로그인 후 인증 쿠키:', newAuthCookies.map(c => c.name))

      // 로그인 후 세션 API 재확인
      const newSessionResponse = await page.request.get('http://54.253.75.175:3000/api/auth/session')
      console.log(`🔍 로그인 후 세션 API 상태: ${newSessionResponse.status()}`)

      if (newSessionResponse.ok()) {
        const newSessionData = await newSessionResponse.json()
        console.log('🔍 로그인 후 세션 데이터:', JSON.stringify(newSessionData, null, 2))
      }
    }

    // 5. Band 설정 API 직접 테스트
    console.log('🧪 Band 설정 API 테스트...')
    const bandResponse = await page.request.get('http://54.253.75.175:3000/api/settings/band')
    console.log(`📊 Band API 응답 상태: ${bandResponse.status()}`)

    if (bandResponse.ok()) {
      const bandData = await bandResponse.json()
      console.log('✅ Band API 성공:', JSON.stringify(bandData, null, 2))
    } else {
      const errorText = await bandResponse.text()
      console.log('❌ Band API 실패:', errorText)
    }

    console.log('🎉 브라우저 세션 디버깅 완료!')
  })
})