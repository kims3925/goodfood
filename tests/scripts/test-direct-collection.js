const { chromium } = require('playwright');

(async () => {
  console.log('🧪 직접 상품 수집 API 테스트...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 로그인
    console.log('🔐 로그인 중...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.fill('input[type="email"], input[name="email"]', 'test@bandauto.com');
    await page.fill('input[type="password"], input[name="password"]', 'test123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ 로그인 완료');

    // 도매 밴드 정보 조회
    console.log('🏪 도매 밴드 정보 조회...');
    const bandsResponse = await page.evaluate(async () => {
      const response = await fetch('/api/wholesale/bands');
      return await response.json();
    });
    
    console.log('📋 등록된 도매 밴드:', JSON.stringify(bandsResponse, null, 2));

    if (bandsResponse.success && bandsResponse.bands && bandsResponse.bands.length > 0) {
      const firstBand = bandsResponse.bands[0];
      console.log(`🎯 첫 번째 밴드로 수집 테스트: ${firstBand.name}`);

      // 상품 수집 API 직접 호출
      console.log('🚀 상품 수집 API 호출...');
      const collectResponse = await page.evaluate(async (bandId) => {
        console.log('API 호출 시작:', bandId);
        try {
          const response = await fetch('/api/wholesale/collect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bandId: bandId })
          });
          
          console.log('응답 상태:', response.status);
          const result = await response.json();
          console.log('응답 결과:', result);
          return { status: response.status, result };
        } catch (error) {
          console.error('API 호출 오류:', error);
          return { error: error.toString() };
        }
      }, firstBand.id);

      console.log('📈 수집 결과:', JSON.stringify(collectResponse, null, 2));

      if (collectResponse.result && collectResponse.result.success) {
        console.log(`✅ 성공! ${collectResponse.result.newPosts || 0}개 게시물 수집됨`);
        console.log(`📋 총 발견: ${collectResponse.result.totalFound || 0}개`);
        console.log(`🤖 AI 분석: ${collectResponse.result.aiAnalyzed || 0}개`);
        console.log(`💬 댓글 수집: ${collectResponse.result.commentsCollected || 0}개`);
      } else if (collectResponse.result) {
        console.log(`❌ 실패: ${collectResponse.result.error}`);
      } else {
        console.log(`❌ API 호출 실패:`, collectResponse.error);
      }

    } else {
      console.log('❌ 등록된 도매 밴드가 없습니다.');
      console.log('도매 밴드를 먼저 등록해주세요.');
    }

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  } finally {
    await page.waitForTimeout(3000); // 결과 확인을 위해 잠시 대기
    await browser.close();
  }
})();