import { test, expect } from '@playwright/test'

test('Verify Band integration and real data loading', async ({ page }) => {
  console.log('🎯 밴드 통합 및 실제 데이터 로딩 확인...')
  
  // 로그인
  await page.goto('http://localhost:3000/login')
  await page.fill('input[name="email"]', 'test@bandauto.com')
  await page.fill('input[name="password"]', 'test123!@#')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**')
  
  // wholesale 페이지로 이동
  await page.goto('http://localhost:3000/dashboard/wholesale')
  console.log('📍 도매 밴드 관리 페이지 접근')
  
  // 페이지 제목 확인
  const title = await page.locator('h1').first().textContent()
  console.log('📋 페이지 제목:', title)
  
  // 로딩 상태 확인 (잠시 기다림)
  console.log('⏳ 밴드 데이터 로딩 대기...')
  await page.waitForTimeout(3000)
  
  // 테이블 헤더 확인 (새로운 구조)
  const headers = await page.locator('thead th').allTextContents()
  console.log('📊 테이블 헤더:', headers)
  
  // 실제 데이터가 로드되었는지 확인
  const hasData = await page.locator('tbody tr').count() > 1 // 로딩 row 제외
  console.log('📈 데이터 로드 여부:', hasData)
  
  if (hasData) {
    // 나은 상품 공급방 데이터 확인
    const bandName = await page.locator('tbody tr:first-child td:nth-child(3)').textContent()
    const bandKey = await page.locator('tbody tr:first-child td:nth-child(4)').textContent()
    const memberCount = await page.locator('tbody tr:first-child td:nth-child(5)').textContent()
    
    console.log('🏷️  밴드명:', bandName?.trim())
    console.log('🔑 밴드키:', bandKey?.trim())
    console.log('👥 멤버수:', memberCount?.trim())
  } else {
    console.log('📭 데이터가 없거나 아직 로딩 중...')
  }
  
  // "새 밴드 등록" 버튼 확인
  const addButton = page.locator('button:has-text("새 밴드 등록")')
  const addButtonVisible = await addButton.isVisible()
  console.log('➕ 새 밴드 등록 버튼:', addButtonVisible)
  
  if (addButtonVisible) {
    // 모달 열기 테스트
    await addButton.click()
    console.log('🖱️  새 밴드 등록 버튼 클릭')
    
    // 모달이 열렸는지 확인
    const modal = page.locator('.fixed.inset-0')
    const modalVisible = await modal.isVisible()
    console.log('📝 등록 모달 표시:', modalVisible)
    
    if (modalVisible) {
      // 모달 내용 확인
      const modalTitle = await page.locator('h2').textContent()
      const bandKeyInput = page.locator('input[placeholder*="AAAMvZteE5OjyYnjS64rQuH3"]')
      const inputVisible = await bandKeyInput.isVisible()
      
      console.log('🏷️  모달 제목:', modalTitle)
      console.log('⌨️  밴드키 입력 필드:', inputVisible)
      
      // 모달 닫기
      await page.locator('button:has-text("취소")').click()
      console.log('❌ 모달 닫기')
    }
  }
  
  // 상품수집 버튼 확인 (있다면)
  const collectButton = page.locator('button:has-text("상품수집")')
  const collectButtonExists = await collectButton.count() > 0
  console.log('🛒 상품수집 버튼 존재:', collectButtonExists)
  
  if (collectButtonExists) {
    console.log('✅ 상품수집 기능 준비됨!')
  }
  
  // 최종 스크린샷
  await page.screenshot({ 
    path: 'screenshots/png/band-integration-final.png',
    fullPage: true 
  })
  console.log('📸 최종 스크린샷 저장됨')
})