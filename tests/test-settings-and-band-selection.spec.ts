import { test, expect } from '@playwright/test'

test('Test Band API settings and band selection modal', async ({ page }) => {
  console.log('🔧 밴드 API 설정 및 밴드 선택 모달 테스트...')
  
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
  
  // 1. 설정 페이지 테스트
  console.log('⚙️ 설정 페이지 접근...')
  await page.goto('http://localhost:3000/dashboard/settings')
  await page.waitForLoadState('networkidle')
  
  // 설정 페이지 요소 확인
  const settingsTitle = await page.locator('h1:has-text("시스템 설정")').isVisible()
  const bandSettingsCard = await page.locator('h2:has-text("밴드 API 설정")').isVisible()
  console.log('📋 설정 페이지 로드:', settingsTitle)
  console.log('🔑 밴드 API 설정 카드:', bandSettingsCard)
  
  if (bandSettingsCard) {
    // 입력 필드들 확인
    const clientIdInput = page.locator('input[placeholder*="Client ID"]')
    const clientSecretInput = page.locator('input[placeholder*="Client Secret"]')
    const accessTokenInput = page.locator('textarea[placeholder*="Access Token"]')
    
    const hasClientIdField = await clientIdInput.isVisible()
    const hasClientSecretField = await clientSecretInput.isVisible()
    const hasAccessTokenField = await accessTokenInput.isVisible()
    
    console.log('🆔 클라이언트 ID 필드:', hasClientIdField)
    console.log('🔒 클라이언트 시크릿 필드:', hasClientSecretField)
    console.log('🎫 액세스 토큰 필드:', hasAccessTokenField)
  }
  
  // 설정 페이지 스크린샷
  await page.screenshot({ 
    path: 'screenshots/png/settings-page.png',
    fullPage: true 
  })
  
  // 2. wholesale 페이지로 이동하여 새 밴드 등록 모달 테스트
  console.log('🏪 wholesale 페이지로 이동...')
  await page.goto('http://localhost:3000/dashboard/wholesale')
  await page.waitForLoadState('networkidle')
  
  // "새 밴드 등록" 버튼 클릭
  const addBandButton = page.locator('button:has-text("새 밴드 등록")')
  const addButtonVisible = await addBandButton.isVisible()
  console.log('➕ 새 밴드 등록 버튼:', addButtonVisible)
  
  if (addButtonVisible) {
    await addBandButton.click()
    console.log('🖱️  새 밴드 등록 버튼 클릭')
    
    // 모달이 열렸는지 확인
    await page.waitForTimeout(1000) // 모달 로딩 대기
    
    const modal = page.locator('.fixed.inset-0')
    const modalVisible = await modal.isVisible()
    console.log('📱 밴드 선택 모달 표시:', modalVisible)
    
    if (modalVisible) {
      // 모달 제목 확인
      const modalTitle = await page.locator('h2:has-text("내 밴드에서 선택")').isVisible()
      console.log('🏷️  모달 제목 표시:', modalTitle)
      
      // API 설정 필요 메시지 또는 밴드 목록 확인
      const needsSetupMessage = await page.locator('text=API 설정 필요').isVisible()
      const bandsLoading = await page.locator('text=밴드 목록을 불러오는 중').isVisible()
      const noBandsMessage = await page.locator('text=접근 가능한 밴드가 없습니다').isVisible()
      
      console.log('⚙️  API 설정 필요 메시지:', needsSetupMessage)
      console.log('⏳ 밴드 로딩 중:', bandsLoading)
      console.log('📭 밴드 없음 메시지:', noBandsMessage)
      
      // 모달 스크린샷
      await page.screenshot({ 
        path: 'screenshots/png/band-selection-modal.png',
        fullPage: true 
      })
      
      // 모달 닫기
      await page.locator('button:has-text("취소")').click()
      console.log('❌ 모달 닫기')
    }
  }
  
  console.log('✅ 테스트 완료!')
})