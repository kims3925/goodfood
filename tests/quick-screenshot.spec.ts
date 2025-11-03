import { test } from '@playwright/test'

test('Quick screenshot of wholesale page', async ({ page }) => {
  // 직접 wholesale 페이지 접근
  await page.goto('http://localhost:3000/dashboard/wholesale')
  
  // 3초 대기하여 로딩 완료
  await page.waitForTimeout(3000)
  
  // 스크린샷 저장
  await page.screenshot({ 
    path: 'screenshots/png/wholesale-quick-check.png',
    fullPage: true 
  })
  
  console.log('📸 스크린샷 저장 완료!')
})