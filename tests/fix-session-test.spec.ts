import { test, expect } from '@playwright/test'

test('Fix session after database reset', async ({ page, context }) => {
  console.log('🔧 세션 초기화 및 새 로그인 테스트...')
  
  // 브라우저 컨텍스트 완전 초기화 (쿠키, 세션 삭제)
  await context.clearCookies()
  await context.clearPermissions()
  
  // 새로운 로그인 시도
  await page.goto('http://localhost:3000/login')
  await page.waitForLoadState('networkidle')
  
  console.log('🍪 브라우저 세션 완전 초기화 완료')
  
  const emailInput = page.locator('input[name="email"], input[type="email"]')
  const passwordInput = page.locator('input[name="password"], input[type="password"]')
  const submitButton = page.locator('button[type="submit"], button:has-text("로그인")')
  
  await emailInput.fill('test@bandauto.com')
  await passwordInput.fill('test123!@#')
  await submitButton.click()
  await page.waitForURL('**/dashboard**')
  console.log('✅ 새로운 세션으로 로그인 성공')
  
  // 밴드 설정 페이지로 이동
  await page.goto('http://localhost:3000/dashboard/settings/band')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  
  console.log('🌐 밴드 설정 페이지 접근')
  
  // 에러 모니터링
  const errors: string[] = []
  page.on('response', response => {
    if (response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`)
    }
  })
  
  // 테스트 데이터 입력
  const clientIdInput = page.locator('input[placeholder*="Client ID"]')
  const clientSecretInput = page.locator('input[type="password"][placeholder*="Client Secret"]')
  const accessTokenInput = page.locator('textarea[placeholder*="Access Token"]')
  
  await clientIdInput.fill('465902270')
  await clientSecretInput.fill('QRKQkRWPZDr3kpmZgljZByDoG08GHixN')
  await accessTokenInput.fill('ZQAAASZM--7lj48qBpZzaSfu1lXx4v889w6xoCDPjeBQAuifxkey-xqA2MiNZFhece2Vc1ZDRbb0EPJuKZMJI5RBTuXvrsGDQan1uB-T47IPZSKw')
  
  console.log('📝 실제 Band API 인증 정보 입력 완료')
  
  // 설정 저장
  const saveButton = page.locator('button:has-text("설정 저장")')
  await saveButton.click()
  
  console.log('💾 설정 저장 시도')
  
  // 응답 대기
  await page.waitForTimeout(3000)
  
  // 결과 확인
  if (errors.length === 0) {
    console.log('✅ 저장 성공 - 에러 없음!')
    
    // 알럿 확인 (성공 메시지)
    page.on('dialog', async dialog => {
      console.log('📢 알럿 메시지:', dialog.message())
      await dialog.accept()
    })
    
    // 페이지 새로고침하여 데이터 로드 확인
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    const loadedClientId = await clientIdInput.inputValue()
    const loadedClientSecret = await clientSecretInput.inputValue()
    const loadedAccessToken = await accessTokenInput.inputValue()
    
    console.log('🔄 새로고침 후 데이터 확인:')
    console.log('   Client ID:', loadedClientId === '465902270' ? '✅ 올바르게 저장됨' : '❌ 저장 실패')
    console.log('   Client Secret:', loadedClientSecret === 'QRKQkRWPZDr3kpmZgljZByDoG08GHixN' ? '✅ 올바르게 저장됨' : '❌ 저장 실패')
    console.log('   Access Token 길이:', loadedAccessToken.length, '자')
    
  } else {
    console.log('❌ 에러 발생:')
    errors.forEach(error => console.log('  ', error))
  }
  
  // 최종 스크린샷
  await page.screenshot({ 
    path: 'screenshots/png/session-fixed-test.png',
    fullPage: true 
  })
  
  console.log('📸 최종 스크린샷 저장')
  console.log('✅ 세션 수정 테스트 완료!')
})