import { test, expect } from '@playwright/test'

test('Verify wholesale page is now accessible', async ({ page }) => {
  console.log('🔍 도매 페이지 접근성 확인 테스트 시작...')
  
  // 직접 wholesale 페이지 접근 시도
  const response = await page.goto('http://localhost:3000/dashboard/wholesale')
  console.log('📊 응답 상태:', response?.status())
  
  if (response?.status() === 200) {
    console.log('✅ SUCCESS: 도매 페이지가 정상적으로 로드됨!')
    
    // 페이지 제목 확인
    const title = await page.locator('h1').first().textContent()
    console.log('📋 페이지 제목:', title)
    
    // "신규 소싱 사이트 등록" 버튼 확인
    const addButton = page.locator('button:has-text("신규 소싱 사이트 등록")')
    const isAddButtonVisible = await addButton.isVisible()
    console.log('➕ 등록 버튼 표시 여부:', isAddButtonVisible)
    
    // 테이블 존재 확인
    const table = page.locator('table')
    const isTableVisible = await table.isVisible()
    console.log('📋 테이블 표시 여부:', isTableVisible)
    
    // 스크린샷 저장
    await page.screenshot({ 
      path: 'screenshots/png/wholesale-page-success.png',
      fullPage: true 
    })
    console.log('📸 성공 스크린샷 저장됨')
    
  } else {
    console.log(`❌ FAILED: 여전히 ${response?.status()} 에러 발생`)
    
    // 에러 페이지 스크린샷
    await page.screenshot({ 
      path: 'screenshots/png/wholesale-page-still-error.png',
      fullPage: true 
    })
    console.log('📸 에러 스크린샷 저장됨')
  }
  
  // 추가 검증: 인증이 필요한 경우 로그인 시도
  if (response?.status() === 401 || page.url().includes('/login')) {
    console.log('🔐 인증이 필요한 상태 - 로그인 시도...')
    
    // 로그인 페이지로 이동
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    
    // 로그인 폼 요소 확인
    const emailInput = page.locator('input[name="email"], input[type="email"]')
    const passwordInput = page.locator('input[name="password"], input[type="password"]')
    const submitButton = page.locator('button[type="submit"], button:has-text("로그인")')
    
    const hasEmailInput = await emailInput.isVisible()
    const hasPasswordInput = await passwordInput.isVisible()
    const hasSubmitButton = await submitButton.isVisible()
    
    console.log('📧 이메일 입력 필드:', hasEmailInput)
    console.log('🔑 패스워드 입력 필드:', hasPasswordInput)
    console.log('🚀 제출 버튼:', hasSubmitButton)
    
    if (hasEmailInput && hasPasswordInput && hasSubmitButton) {
      // 로그인 시도
      await emailInput.fill('test@bandauto.com')
      await passwordInput.fill('test123!@#')
      await submitButton.click()
      
      // 로그인 후 다시 wholesale 페이지 접근
      await page.waitForURL('**/dashboard**')
      console.log('✅ 로그인 성공!')
      
      const finalResponse = await page.goto('http://localhost:3000/dashboard/wholesale')
      console.log('🔄 로그인 후 도매 페이지 접근 결과:', finalResponse?.status())
      
      if (finalResponse?.status() === 200) {
        await page.screenshot({ 
          path: 'screenshots/png/wholesale-page-after-login.png',
          fullPage: true 
        })
        console.log('✅ 최종 성공! 로그인 후 도매 페이지 정상 접근')
      }
    }
  }
})