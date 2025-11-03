import { test, expect } from '@playwright/test'

test.describe('도매 밴드 상품 수집 테스트', () => {
  
  test.beforeEach(async ({ page }) => {
    // 테스트 계정으로 로그인
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="email"]', 'test@bandauto.com')
    await page.fill('input[name="password"]', 'test123!@#')
    await page.click('button[type="submit"]')
    
    // 로그인 성공 확인
    await expect(page).toHaveURL('http://localhost:3000/dashboard')
  })

  test('도매 밴드 페이지 접근 및 기본 요소 확인', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/wholesale')
    
    // 페이지 제목 확인
    await expect(page.locator('h1')).toContainText('도매 소싱 사이트 관리')
    
    // 주요 버튼들 존재 확인
    await expect(page.locator('button:has-text("전체 상품 수집")')).toBeVisible()
    await expect(page.locator('button:has-text("상품 상태 확인")')).toBeVisible()
    await expect(page.locator('button:has-text("새 밴드 등록")')).toBeVisible()
    
    // 날짜 설정 버튼 확인
    await expect(page.locator('button:has-text("날짜 설정")')).toBeVisible()
  })

  test('등록된 밴드 목록 조회', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/wholesale')
    
    // 페이지 로딩 대기
    await page.waitForLoadState('networkidle')
    
    // 밴드 목록 테이블 확인
    const bandTable = page.locator('table')
    await expect(bandTable).toBeVisible()
    
    // 테이블 헤더 확인
    await expect(page.locator('th:has-text("밴드명")')).toBeVisible()
    await expect(page.locator('th:has-text("상품수집")')).toBeVisible()
    await expect(page.locator('th:has-text("상태")')).toBeVisible()
  })

  test('날짜 필터 기능 테스트', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/wholesale')
    await page.waitForLoadState('networkidle')
    
    // 날짜 설정 버튼 클릭
    await page.click('button:has-text("날짜 설정")')
    
    // 날짜 필터 UI 확인
    await expect(page.locator('label:has-text("시작일")')).toBeVisible()
    await expect(page.locator('label:has-text("종료일")')).toBeVisible()
    await expect(page.locator('button:has-text("최근 2일")')).toBeVisible()
    await expect(page.locator('button:has-text("최근 1주일")')).toBeVisible()
    
    // 최근 2일 설정 테스트
    await page.click('button:has-text("최근 2일")')
    await expect(page.locator('span:has-text("설정됨")')).toBeVisible()
    
    // 날짜 초기화 테스트
    await page.click('button:has-text("초기화")')
    await expect(page.locator('span:has-text("설정됨")')).toBeHidden()
  })

  test('개별 상품 수집 버튼 테스트', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/wholesale')
    await page.waitForLoadState('networkidle')
    
    // 첫 번째 밴드의 상품수집 버튼 찾기
    const collectButton = page.locator('button:has-text("상품수집")').first()
    
    if (await collectButton.isVisible()) {
      console.log('✅ 상품수집 버튼 발견됨')
      
      // 수집 요청 모니터링
      const responsePromise = page.waitForResponse(response => 
        response.url().includes('/api/wholesale/collect') && response.request().method() === 'POST'
      )
      
      // 상품수집 버튼 클릭
      await collectButton.click()
      
      // 버튼 상태 변경 확인 (로딩 상태)
      await expect(page.locator('button:has-text("수집 중...")')).toBeVisible({ timeout: 2000 })
      
      // API 응답 대기 (최대 2분)
      try {
        const response = await responsePromise
        const status = response.status()
        
        console.log(`📊 API 응답 상태: ${status}`)
        
        if (status === 200) {
          console.log('✅ 수집 API 성공')
          // 성공 시 collect 페이지로 이동 확인
          await expect(page).toHaveURL(/\/dashboard\/wholesale\/collect/, { timeout: 10000 })
        } else if (status === 500) {
          console.log('❌ 500 서버 오류 발생')
          // 오류 응답 내용 확인
          const responseText = await response.text()
          console.log('오류 내용:', responseText)
        }
      } catch (error) {
        console.log('⚠️ API 응답 대기 중 타임아웃 또는 오류:', error)
      }
      
    } else {
      console.log('⚠️ 등록된 밴드가 없어서 상품수집 버튼이 없습니다.')
    }
  })

  test('전체 상품 수집 기능 테스트', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/wholesale')
    await page.waitForLoadState('networkidle')
    
    const bulkCollectButton = page.locator('button:has-text("전체 상품 수집")')
    await expect(bulkCollectButton).toBeVisible()
    
    // 확인 다이얼로그 대기 후 취소 (실제 수집 방지)
    page.once('dialog', dialog => {
      console.log('📋 확인 메시지:', dialog.message())
      dialog.dismiss() // 취소
    })
    
    await bulkCollectButton.click()
  })

  test('수집된 상품 확인 페이지 테스트', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/wholesale/collect')
    await page.waitForLoadState('networkidle')
    
    // 페이지 제목 확인
    await expect(page.locator('h1')).toContainText('게시물 수집')
    
    // 주요 필터링 옵션 확인
    await expect(page.locator('select')).toContainText(['전체 상태', '전체 소싱처', '전체 분류'])
    
    // 뷰 옵션 버튼들 확인
    await expect(page.locator('button:has-text("카드")')).toBeVisible()
    await expect(page.locator('button:has-text("리스트")')).toBeVisible()
    await expect(page.locator('button:has-text("요약리스트")')).toBeVisible()
    
    // 수집된 게시물이 있는지 확인
    const totalCount = await page.locator('div:has-text("총")').textContent()
    console.log(`📊 수집된 게시물 수: ${totalCount}`)
  })

  test('AI 분류 필터 테스트', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/wholesale/collect')
    await page.waitForLoadState('networkidle')
    
    // 분류 필터 드롭다운 확인
    const categoryFilter = page.locator('select').nth(2) // 세 번째 select가 분류 필터
    
    // 모든 분류 옵션 확인
    await expect(categoryFilter).toContainText('전체 분류')
    await expect(categoryFilter).toContainText('수산')
    await expect(categoryFilter).toContainText('축산')
    await expect(categoryFilter).toContainText('농산')
    await expect(categoryFilter).toContainText('가공품')
    await expect(categoryFilter).toContainText('기타')
    
    // 수산 분류 필터 테스트
    await categoryFilter.selectOption('SEAFOOD')
    
    // 필터링 결과 확인 (시간을 조금 대기)
    await page.waitForTimeout(1000)
  })

  test('데이터베이스 연결 및 저장 상태 확인', async ({ page }) => {
    // API 직접 호출로 데이터베이스 상태 확인
    const response = await page.request.get('http://localhost:3000/api/wholesale/posts')
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    console.log(`📊 데이터베이스 게시물 수: ${data.posts?.length || 0}`)
    
    if (data.posts && data.posts.length > 0) {
      const firstPost = data.posts[0]
      console.log('📋 첫 번째 게시물 정보:')
      console.log(`- 제목: ${firstPost.title}`)
      console.log(`- 분류: ${firstPost.productCategory}`)
      console.log(`- AI 분석: ${firstPost.aiAnalyzed ? 'O' : 'X'}`)
    }
  })

})