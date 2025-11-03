import { test, expect } from '@playwright/test'

test.describe('무한 루프 401 오류 수정 테스트', () => {
  test('비인증 상태에서 Band 설정 페이지 접근 테스트', async ({ page }) => {
    console.log('🚫 비인증 상태에서 Band 설정 페이지 접근 테스트...')

    // 네트워크 요청 모니터링 시작
    const apiRequests: any[] = []

    page.on('request', request => {
      if (request.url().includes('/api/settings/band')) {
        apiRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        })
        console.log(`📡 API 요청: ${request.method()} ${request.url()}`)
      }
    })

    page.on('response', response => {
      if (response.url().includes('/api/settings/band')) {
        console.log(`📊 API 응답: ${response.status()} ${response.url()}`)
      }
    })

    // Band 설정 페이지로 직접 이동 (로그인하지 않은 상태)
    await page.goto('http://54.253.75.175:3000/admin/settings/band')

    // 5초 대기하여 무한 루프가 발생하는지 확인
    await page.waitForTimeout(5000)

    console.log(`🔍 총 API 요청 수: ${apiRequests.length}`)

    // 무한 루프가 발생하지 않았는지 확인 (최대 2-3회 요청만 허용)
    expect(apiRequests.length).toBeLessThanOrEqual(3)

    // 로그인 페이지로 리다이렉트되었는지 확인
    await page.waitForTimeout(2000)
    const currentUrl = page.url()
    console.log(`🔍 현재 URL: ${currentUrl}`)

    // 로그인 페이지 또는 적절한 인증 실패 처리가 되었는지 확인
    const isRedirectedToLogin = currentUrl.includes('/login') ||
                               currentUrl.includes('/auth') ||
                               await page.locator('text=로그인').isVisible()

    if (isRedirectedToLogin) {
      console.log('✅ 적절히 로그인 페이지로 리다이렉트됨')
    } else {
      console.log('ℹ️ 로그인 페이지 리다이렉트 확인 불가, API 요청 수로 판단')
    }

    console.log('🎉 무한 루프 방지 테스트 완료!')
  })

  test('인증 후 Band 설정 페이지 정상 작동 테스트', async ({ page }) => {
    console.log('🔐 인증 후 Band 설정 페이지 정상 작동 테스트...')

    // 1. 로그인 수행
    await page.goto('http://54.253.75.175:3000/login')
    await page.waitForLoadState('networkidle')

    await page.fill('input[name="email"]', 'test@bandauto.com')
    await page.fill('input[name="password"]', 'test123!@#')
    await page.click('button[type="submit"]')

    // 대시보드로 리다이렉트 대기
    await page.waitForURL('**/dashboard')
    console.log('✅ 로그인 성공')

    // 2. Band 설정 페이지로 이동
    await page.goto('http://54.253.75.175:3000/admin/settings/band')
    await page.waitForLoadState('networkidle')

    // 3. API 요청 모니터링
    const apiRequests: any[] = []
    page.on('request', request => {
      if (request.url().includes('/api/settings/band')) {
        apiRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        })
      }
    })

    // 4. 페이지 로드 대기
    await page.waitForTimeout(3000)

    // 5. 폼이 정상적으로 로드되었는지 확인
    const clientIdInput = page.locator('input[placeholder*="Client ID"]')
    await expect(clientIdInput).toBeVisible()

    console.log(`🔍 인증된 상태에서 API 요청 수: ${apiRequests.length}`)
    console.log('✅ Band 설정 페이지가 정상적으로 로드됨')

    console.log('🎉 인증 상태 테스트 완료!')
  })
})