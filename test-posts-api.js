const { chromium } = require('playwright');

(async () => {
  console.log('🧪 게시물 조회 API 테스트...');
  
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

    // 게시물 조회 API 직접 호출
    console.log('🚀 게시물 조회 API 호출...');
    const postsResponse = await page.evaluate(async () => {
      console.log('API 호출 시작');
      try {
        const response = await fetch('/api/wholesale/posts');
        console.log('응답 상태:', response.status);
        const result = await response.json();
        console.log('응답 결과:', result);
        return { status: response.status, result };
      } catch (error) {
        console.error('API 호출 오류:', error);
        return { error: error.toString() };
      }
    });

    console.log('📈 조회 결과:', JSON.stringify(postsResponse, null, 2));

    if (postsResponse.result && postsResponse.result.success) {
      const posts = postsResponse.result.posts || [];
      console.log(`✅ 성공! ${posts.length}개의 게시물이 조회됨`);
      
      if (posts.length > 0) {
        console.log('📋 첫 번째 게시물 정보:');
        console.log('- ID:', posts[0].id);
        console.log('- 제목:', (posts[0].title || '').substring(0, 50) + '...');
        console.log('- 밴드:', posts[0].wholesaleBand?.name);
        console.log('- 생성일:', posts[0].bandCreatedAt);
        console.log('- AI 분석:', posts[0].aiAnalyzed ? '완료' : '미완료');
      }
      
      // 페이지도 테스트해보기
      console.log('\n🌐 수집 페이지로 이동...');
      await page.goto('http://localhost:3000/dashboard/wholesale/collect');
      await page.waitForLoadState('networkidle');
      
      // 페이지가 로드되길 잠시 대기
      await page.waitForTimeout(2000);
      
      // 페이지에서 게시물 개수 확인
      const pageContent = await page.textContent('body');
      const totalMatch = pageContent.match(/총 (\d+)개 게시물 수집됨/);
      if (totalMatch) {
        console.log(`📊 페이지에서 표시된 게시물 수: ${totalMatch[1]}개`);
      } else {
        console.log('❓ 페이지에서 게시물 개수를 찾을 수 없음');
      }
      
      // "수집된 게시물이 없습니다" 메시지 확인
      const hasEmptyMessage = pageContent.includes('수집된 게시물이 없습니다');
      if (hasEmptyMessage) {
        console.log('❌ 페이지에 "수집된 게시물이 없습니다" 메시지가 표시됨');
      } else {
        console.log('✅ 페이지에 게시물이 표시되는 것 같음');
      }

    } else if (postsResponse.result) {
      console.log(`❌ 실패: ${postsResponse.result.error}`);
    } else {
      console.log(`❌ API 호출 실패:`, postsResponse.error);
    }

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  } finally {
    await page.waitForTimeout(3000); // 결과 확인을 위해 잠시 대기
    await browser.close();
  }
})();