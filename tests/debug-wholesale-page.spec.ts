import { test, expect } from '@playwright/test'

test('Debug wholesale page 404 error', async ({ page }) => {
  // 먼저 홈페이지에 접속해서 기본 상태 확인
  await page.goto('http://localhost:3000')
  console.log('🏠 홈페이지 접속 성공')
  
  // 로그인 시도
  await page.goto('http://localhost:3000/login')
  await page.fill('input[name="email"]', 'test@bandauto.com')
  await page.fill('input[name="password"]', 'test123!@#')
  await page.click('button[type="submit"]')
  
  // 로그인 후 대시보드로 리다이렉트되는지 확인
  await page.waitForURL('**/dashboard**')
  console.log('✅ 로그인 성공, 대시보드로 이동됨')
  
  // 현재 URL 확인
  const currentURL = page.url()
  console.log('📍 현재 URL:', currentURL)
  
  // wholesale 페이지 접근 시도
  console.log('🔍 /dashboard/wholesale 페이지 접근 시도...')
  
  const response = await page.goto('http://localhost:3000/dashboard/wholesale')
  console.log('📊 응답 상태:', response?.status())
  
  if (response?.status() === 404) {
    console.log('❌  404 에러 발생!')
    
    // 페이지 소스 확인
    const content = await page.content()
    console.log('📄 페이지 내용 일부:', content.substring(0, 500))
    
    // 실제 존재하는 경로 확인을 위해 다른 대시보드 경로들 시도
    const pathsToTest = [
      '/dashboard',
      '/dashboard/products',
      '/dashboard/orders',
      '/dashboard/settings'
    ]
    
    for (const path of pathsToTest) {
      const testResponse = await page.goto(`http://localhost:3000${path}`)
      console.log(`📂 ${path}: ${testResponse?.status()}`)
    }
  }
  
  // 스크린샷 저장
  await page.screenshot({ 
    path: 'screenshots/png/wholesale-404-debug.png',
    fullPage: true 
  })
  console.log('📸 디버그 스크린샷 저장됨')
})