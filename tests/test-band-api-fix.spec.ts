import { test, expect } from '@playwright/test'

test('Test Band API after database reset', async ({ page }) => {
  console.log('🔧 데이터베이스 리셋 후 밴드 API 테스트...')
  
  // 로그인
  await page.goto('http://localhost:3000/login')
  await page.waitForLoadState('networkidle')
  
  const emailInput = page.locator('input[name="email"], input[type="email"]')
  const passwordInput = page.locator('input[name="password"], input[type="password"]')
  const submitButton = page.locator('button[type="submit"], button:has-text("로그인")')
  
  if (await emailInput.isVisible()) {
    await emailInput.fill('test@bandauto.com')
    await passwordInput.fill('test123!@#')
    await submitButton.click()
    await page.waitForURL('**/dashboard**')
    console.log('✅ 로그인 성공')
  }
  
  // 밴드 설정 페이지로 이동
  await page.goto('http://localhost:3000/dashboard/settings/band')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  
  console.log('🌐 밴드 설정 페이지 접근 성공')
  
  // 브라우저 콘솔 에러 모니터링
  const consoleLogs: string[] = []
  const networkErrors: string[] = []
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleLogs.push(msg.text())
      console.log('❌ Console Error:', msg.text())
    }
  })
  
  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.url()}`)
      console.log('❌ Network Error:', response.status(), response.url())
    }
  })
  
  // 테스트 데이터 입력
  const clientIdInput = page.locator('input[placeholder*="Client ID"]')
  const clientSecretInput = page.locator('input[type="password"][placeholder*="Client Secret"]')
  const accessTokenInput = page.locator('textarea[placeholder*="Access Token"]')
  
  await clientIdInput.fill('test-client-id-123')
  await clientSecretInput.fill('test-secret-456')
  await accessTokenInput.fill('test-access-token-789')
  
  console.log('📝 테스트 데이터 입력 완료')
  
  // 설정 저장 버튼 클릭
  const saveButton = page.locator('button:has-text("설정 저장")')
  await saveButton.click()
  
  console.log('💾 설정 저장 버튼 클릭')
  
  // 응답 대기 (최대 10초)
  await page.waitForTimeout(3000)
  
  // 결과 확인
  const successMessage = await page.locator('text=설정이 저장되었습니다').isVisible()
  console.log('✅ 성공 메시지 표시:', successMessage)
  
  // 페이지 새로고침 후 데이터 로드 확인
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  
  const loadedClientId = await clientIdInput.inputValue()
  const loadedClientSecret = await clientSecretInput.inputValue()
  const loadedAccessToken = await accessTokenInput.inputValue()
  
  console.log('🔄 새로고침 후 데이터 로드:')
  console.log('   Client ID:', loadedClientId ? '로드됨' : '비어있음')
  console.log('   Client Secret:', loadedClientSecret ? '로드됨' : '비어있음')
  console.log('   Access Token:', loadedAccessToken ? '로드됨' : '비어있음')
  
  // 에러 요약
  if (consoleLogs.length > 0) {
    console.log('\n❌ 콘솔 에러들:')
    consoleLogs.forEach(log => console.log('  ', log))
  }
  
  if (networkErrors.length > 0) {
    console.log('\n❌ 네트워크 에러들:')
    networkErrors.forEach(error => console.log('  ', error))
  }
  
  if (consoleLogs.length === 0 && networkErrors.length === 0) {
    console.log('✅ 에러 없음 - 정상 작동!')
  }
  
  // 최종 스크린샷
  await page.screenshot({ 
    path: 'screenshots/png/band-api-fixed.png',
    fullPage: true 
  })
  
  console.log('📸 최종 스크린샷 저장')
  console.log('✅ 밴드 API 수정 테스트 완료!')
})