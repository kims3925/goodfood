import { test, expect } from '@playwright/test'

test('Debug settings page issue', async ({ page }) => {
  console.log('🔧 설정 페이지 디버깅 시작...')
  
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
  
  // 다양한 설정 페이지 경로 테스트
  const pathsToTest = [
    '/dashboard/settings',
    '/dashboard/settings/band',
    '/settings',
    '/settings/band'
  ]
  
  for (const path of pathsToTest) {
    console.log(`📍 경로 테스트: ${path}`)
    
    const response = await page.goto(`http://localhost:3000${path}`)
    const status = response?.status()
    console.log(`   └─ 응답 코드: ${status}`)
    
    if (status === 200) {
      // 페이지 내용 확인
      await page.waitForTimeout(1000) // 컴파일 대기
      
      const title = await page.locator('h1').first().textContent()
      const hasSettingsCard = await page.locator('h2:has-text("밴드 API 설정")').isVisible()
      
      console.log(`   └─ 제목: ${title}`)
      console.log(`   └─ 설정 카드 표시: ${hasSettingsCard}`)
      
      if (hasSettingsCard) {
        console.log('✅ 정상적인 설정 페이지 발견!')
        
        // 스크린샷 저장
        await page.screenshot({ 
          path: `screenshots/png/settings-working-${path.replace(/[\/]/g, '_')}.png`,
          fullPage: true 
        })
      }
    } else {
      console.log(`   └─ 404 에러 - 페이지 없음`)
    }
  }
  
  // 현재 파일 구조 확인을 위한 브라우저 개발자 도구 정보
  await page.goto('http://localhost:3000/dashboard')
  console.log('📂 대시보드에서 네비게이션 확인...')
  
  // 사이드바에서 설정 링크 찾기
  const settingsLink = page.locator('a:has-text("설정"), a[href*="settings"]')
  const settingsLinkExists = await settingsLink.count()
  console.log(`⚙️ 설정 링크 개수: ${settingsLinkExists}`)
  
  if (settingsLinkExists > 0) {
    const href = await settingsLink.first().getAttribute('href')
    console.log(`   └─ 설정 링크 주소: ${href}`)
    
    // 설정 링크 클릭해보기
    await settingsLink.first().click()
    await page.waitForTimeout(2000)
    
    const finalUrl = page.url()
    const finalTitle = await page.locator('h1').first().textContent()
    
    console.log(`🎯 최종 도착 URL: ${finalUrl}`)
    console.log(`🏷️ 최종 페이지 제목: ${finalTitle}`)
    
    await page.screenshot({ 
      path: 'screenshots/png/settings-navigation-result.png',
      fullPage: true 
    })
  }
  
  console.log('✅ 디버깅 완료!')
})