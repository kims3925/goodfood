import { test, expect } from '@playwright/test'

test('Test complete settings flow', async ({ page }) => {
  console.log('🔧 완전한 설정 플로우 테스트 시작...')
  
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
  
  // 1. 메인 설정 페이지 테스트 (/dashboard/settings)
  console.log('\n1️⃣ 메인 설정 페이지 테스트...')
  await page.goto('http://localhost:3000/dashboard/settings')
  await page.waitForLoadState('networkidle')
  
  const mainPageTitle = await page.locator('h1:has-text("시스템 설정")').isVisible()
  const bandApiCard = await page.locator('h3:has-text("밴드 API 설정")').isVisible()
  
  console.log('📋 메인 설정 페이지 제목:', mainPageTitle)
  console.log('🔑 밴드 API 설정 카드:', bandApiCard)
  
  // 2. 밴드 API 설정으로 이동 (/dashboard/settings/band)
  console.log('\n2️⃣ 밴드 API 설정 페이지로 이동...')
  await page.click('a[href="/dashboard/settings/band"]')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  
  const currentUrl = page.url()
  console.log('🌐 현재 URL:', currentUrl)
  
  // 밴드 설정 페이지 확인
  const bandPageTitle = await page.locator('h1:has-text("밴드 API 설정")').isVisible()
  const clientIdInput = await page.locator('input[placeholder*="Client ID"]').isVisible()
  const clientSecretInput = await page.locator('input[type="password"][placeholder*="Client Secret"]').isVisible()
  const accessTokenInput = await page.locator('textarea[placeholder*="Access Token"]').isVisible()
  const apiButton = await page.locator('a:has-text("밴드 API 발급받으러 가기")').isVisible()
  
  console.log('📋 밴드 API 페이지 제목:', bandPageTitle)
  console.log('🆔 클라이언트 ID 필드:', clientIdInput)
  console.log('🔒 클라이언트 시크릿 필드:', clientSecretInput)
  console.log('🎫 액세스 토큰 필드:', accessTokenInput)
  console.log('🌟 밴드 API 발급받기 버튼:', apiButton)
  
  // 3. 사이드바에서 직접 접근 테스트
  console.log('\n3️⃣ 사이드바 네비게이션 테스트...')
  const settingsNavItem = page.locator('button:has-text("설정")')
  await settingsNavItem.click()
  await page.waitForTimeout(500)
  
  const bandAccountLink = page.locator('a[href="/dashboard/settings/band"]')
  await bandAccountLink.click()
  await page.waitForLoadState('networkidle')
  
  const finalUrl = page.url()
  console.log('🎯 사이드바 통한 최종 URL:', finalUrl)
  
  // 4. API 버튼 기능 테스트
  if (apiButton) {
    const buttonHref = await page.locator('a:has-text("밴드 API 발급받으러 가기")').getAttribute('href')
    const buttonTarget = await page.locator('a:has-text("밴드 API 발급받으러 가기")').getAttribute('target')
    const buttonClass = await page.locator('a:has-text("밴드 API 발급받으러 가기")').getAttribute('class')
    
    console.log('🔗 API 버튼 링크:', buttonHref)
    console.log('🆕 새 탭 열기:', buttonTarget === '_blank')
    console.log('🟢 초록색 스타일:', buttonClass?.includes('bg-green-500'))
  }
  
  // 최종 스크린샷
  await page.screenshot({ 
    path: 'screenshots/png/final-settings-test.png',
    fullPage: true 
  })
  console.log('📸 최종 스크린샷 저장')
  
  console.log('\n✅ 완전한 설정 플로우 테스트 완료!')
  
  // 결과 검증
  expect(currentUrl).toContain('/dashboard/settings/band')
  expect(bandPageTitle).toBe(true)
  expect(apiButton).toBe(true)
})