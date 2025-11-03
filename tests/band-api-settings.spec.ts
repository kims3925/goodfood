import { test, expect } from '@playwright/test'

test.describe('Band API Settings', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 페이지로 직접 이동
    await page.goto('http://localhost:3000/login')
    
    // 로그인 폼 입력
    await page.fill('input[name="email"]', 'test@bandauto.com')
    await page.fill('input[name="password"]', 'test123!@#')
    
    // 로그인 버튼 클릭
    await page.click('button[type="submit"]')
    
    // 대시보드로 리다이렉트 대기
    await page.waitForURL('**/dashboard**', { timeout: 10000 })
  })

  test('Should successfully save Band API settings', async ({ page }) => {
    // 설정 페이지로 이동
    await page.goto('http://localhost:3000/dashboard/settings/band')
    
    // 페이지 로딩 완료 대기
    await page.waitForLoadState('networkidle')
    
    // Band API 설정 입력
    const clientId = '465902270'
    const clientSecret = 'QRKQkRWPZDr3kpmZgljZByDoG08GHixN'
    const accessToken = 'ZQAAASZM--7lj48qBpZzaSfu1lXx4v889w6xoCDPjeBQAuifxkey-xqA2MiNZFhece2Vc1ZDRbb0EPJuKZMJI5RBTuXvrsGDQan1uB-T47IPZSKw'
    
    // 입력 필드 찾기 및 입력
    await page.fill('input[name="clientId"]', clientId)
    await page.fill('input[name="clientSecret"]', clientSecret)  
    await page.fill('input[name="accessToken"]', accessToken)
    
    // API 요청 감시
    const responsePromise = page.waitForResponse('**/api/settings/band')
    
    // 저장 버튼 클릭
    await page.click('button[type="submit"]')
    
    // 응답 확인
    const response = await responsePromise
    console.log('API Response Status:', response.status())
    
    if (response.status() !== 200) {
      const responseText = await response.text()
      console.log('API Response Body:', responseText)
    }
    
    // 성공 메시지 확인
    await expect(page.locator('text=설정이 저장되었습니다')).toBeVisible({ timeout: 10000 })
    
    // 페이지 새로고침해서 설정 저장 확인
    await page.reload()
    await expect(page.locator('input[name="clientId"]')).toHaveValue(clientId)
  })

  test('Should handle API errors gracefully', async ({ page }) => {
    // 설정 페이지로 이동
    await page.goto('http://localhost:3000/dashboard/settings/band')
    
    // 잘못된 데이터로 테스트
    await page.fill('input[name="clientId"]', '')
    await page.fill('input[name="clientSecret"]', '')
    await page.fill('input[name="accessToken"]', '')
    
    // 저장 버튼 클릭
    await page.click('button[type="submit"]')
    
    // 에러 상황에서도 크래시하지 않는지 확인
    await page.waitForTimeout(2000)
    
    // 페이지가 여전히 접근 가능한지 확인
    await expect(page.locator('h1')).toBeVisible()
  })

  test('Should display current Band API settings on page load', async ({ page }) => {
    // 설정 페이지로 이동
    await page.goto('http://localhost:3000/dashboard/settings/band')
    
    // GET API 요청 감시
    const getResponsePromise = page.waitForResponse('**/api/settings/band')
    
    // 페이지 로딩 완료 대기
    await page.waitForLoadState('networkidle')
    
    // GET 응답 확인
    const getResponse = await getResponsePromise
    console.log('GET API Response Status:', getResponse.status())
    
    if (getResponse.status() !== 200) {
      const responseText = await getResponse.text()
      console.log('GET API Response Body:', responseText)
    }
    
    // 폼이 정상적으로 로드되었는지 확인
    await expect(page.locator('input[name="clientId"]')).toBeVisible()
    await expect(page.locator('input[name="clientSecret"]')).toBeVisible()
    await expect(page.locator('input[name="accessToken"]')).toBeVisible()
  })
})