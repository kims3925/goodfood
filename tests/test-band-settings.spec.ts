import { test, expect } from '@playwright/test'

test('Test Band settings page at /dashboard/settings/band', async ({ page }) => {
  console.log('🔧 밴드 설정 페이지 테스트 시작...')
  
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
  await page.waitForTimeout(2000) // 컴파일 대기
  
  console.log(`🌐 현재 URL: ${page.url()}`)
  
  // 페이지 상태 확인
  const response = await page.request.get('http://localhost:3000/dashboard/settings/band')
  console.log(`📡 응답 상태: ${response.status()}`)
  
  // 페이지 요소들 확인
  const pageTitle = await page.locator('h1:has-text("밴드 API 설정")').isVisible()
  const bandSettingsCard = await page.locator('h2:has-text("밴드 API 설정")').isVisible()
  console.log('📋 페이지 제목 표시:', pageTitle)
  console.log('🔑 밴드 API 설정 카드:', bandSettingsCard)
  
  // 입력 필드들 확인
  const clientIdInput = await page.locator('input[placeholder*="Client ID"]').isVisible()
  const clientSecretInput = await page.locator('input[type="password"][placeholder*="Client Secret"]').isVisible()
  const accessTokenInput = await page.locator('textarea[placeholder*="Access Token"]').isVisible()
  
  console.log('🆔 클라이언트 ID 필드:', clientIdInput)
  console.log('🔒 클라이언트 시크릿 필드:', clientSecretInput)
  console.log('🎫 액세스 토큰 필드:', accessTokenInput)
  
  // 새로 추가된 API 발급 버튼 확인
  const apiButton = page.locator('a:has-text("밴드 API 발급받으러 가기")')
  const apiButtonVisible = await apiButton.isVisible()
  console.log('🌟 밴드 API 발급받기 버튼:', apiButtonVisible)
  
  if (apiButtonVisible) {
    // 버튼의 스타일 확인 (초록색인지)
    const buttonClass = await apiButton.getAttribute('class')
    const isGreenButton = buttonClass?.includes('bg-green-500')
    console.log('🟢 초록색 스타일 적용:', isGreenButton)
    
    // 버튼의 링크 확인
    const buttonHref = await apiButton.getAttribute('href')
    const isCorrectLink = buttonHref === 'https://developers.band.us'
    console.log('🔗 올바른 링크 설정:', isCorrectLink, `(${buttonHref})`)
    
    // target="_blank" 확인
    const buttonTarget = await apiButton.getAttribute('target')
    const opensNewTab = buttonTarget === '_blank'
    console.log('🆕 새 탭에서 열기:', opensNewTab)
  }
  
  // 액션 버튼들 확인
  const testButton = await page.locator('button:has-text("연결 테스트")').isVisible()
  const saveButton = await page.locator('button:has-text("설정 저장")').isVisible()
  
  console.log('🧪 연결 테스트 버튼:', testButton)
  console.log('💾 설정 저장 버튼:', saveButton)
  
  // 오류가 있는지 브라우저 콘솔 확인
  const consoleLogs: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleLogs.push(`Console Error: ${msg.text()}`)
    }
  })
  
  // 최종 스크린샷
  await page.screenshot({ 
    path: 'screenshots/png/band-settings-test.png',
    fullPage: true 
  })
  console.log('📸 최종 스크린샷 저장')
  
  // 콘솔 에러 출력
  if (consoleLogs.length > 0) {
    console.log('❌ 콘솔 에러들:')
    consoleLogs.forEach(log => console.log('  ', log))
  } else {
    console.log('✅ 콘솔 에러 없음')
  }
  
  console.log('✅ 밴드 설정 페이지 테스트 완료!')
})