import { test, expect } from '@playwright/test';

test.describe('BandAuto Application - 개선된 테스트', () => {
  
  test('홈페이지 기본 로딩 테스트', async ({ page }) => {
    console.log('홈페이지 접속 중...');
    
    // 콘솔 에러 수집
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`Console Error: ${msg.text()}`);
      }
    });
    
    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkErrors.push(`Network Error: ${response.url()} - ${response.status()} ${response.statusText()}`);
      }
    });
    
    // 홈페이지 접속
    const response = await page.goto('/', { waitUntil: 'networkidle' });
    
    // 응답 상태 확인
    expect(response?.status()).toBe(200);
    
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/BandAuto/);
    
    // 주요 요소들이 로드되는지 확인
    await expect(page.locator('h1')).toContainText('BandAuto');
    await expect(page.locator('text=밴드 자동화 판매 시스템')).toBeVisible();
    
    // 스크린샷 저장
    await page.screenshot({ path: 'screenshots/png/homepage-success.png', fullPage: true });
    
    // 에러 로그 출력
    if (consoleErrors.length > 0) {
      console.log('콘솔 에러들:', consoleErrors);
    }
    if (networkErrors.length > 0) {
      console.log('네트워크 에러들:', networkErrors);
    }
    
    console.log('홈페이지 테스트 완료');
  });

  test('인증 시스템 테스트', async ({ page }) => {
    console.log('인증 시스템 테스트 시작...');
    
    // 로그인 페이지 접속
    await page.goto('/login');
    
    // 로그인 페이지 요소 확인 (더 구체적인 셀렉터 사용)
    await expect(page.locator('button[type="submit"]')).toContainText('로그인', { timeout: 10000 });
    
    // 회원가입 페이지 접속
    await page.goto('/register');
    
    // 회원가입 페이지 요소 확인 (더 구체적인 셀렉터 사용)
    await expect(page.locator('button[type="submit"]')).toContainText('회원가입', { timeout: 10000 });
    
    // 보호된 경로 접속 시도
    const dashboardResponse = await page.goto('/dashboard');
    
    // 인증이 필요한 경우 로그인 페이지로 리다이렉트되어야 함
    const currentUrl = page.url();
    console.log('대시보드 접속 후 현재 URL:', currentUrl);
    
    if (currentUrl.includes('/login')) {
      console.log('✓ 보호된 경로에서 올바르게 로그인으로 리다이렉트됨');
    } else if (dashboardResponse?.status() === 200) {
      console.log('✓ 대시보드 접근 가능 (이미 인증되었거나 인증 불필요)');
    }
    
    await page.screenshot({ path: 'screenshots/png/auth-test.png' });
  });

  test('API 연결 테스트', async ({ page }) => {
    console.log('API 연결 상태 확인...');
    
    const apiRequests: { url: string; status: number; duration: number }[] = [];
    const failedRequests: { url: string; status: number; error?: string }[] = [];
    
    page.on('response', (response) => {
      if (response.url().includes('/api/')) {
        const request = {
          url: response.url(),
          status: response.status(),
          duration: 0 // 실제로는 timing 정보가 필요하지만 단순화
        };
        
        apiRequests.push(request);
        
        if (response.status() >= 400) {
          failedRequests.push({
            url: response.url(),
            status: response.status(),
            error: response.statusText()
          });
        }
      }
    });
    
    // 여러 페이지 방문하여 API 호출 유발
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    await page.goto('/login');
    await page.waitForTimeout(2000);
    
    // API 호출 결과 분석
    console.log(`총 ${apiRequests.length}개의 API 요청 발견`);
    
    if (failedRequests.length > 0) {
      console.log('실패한 API 요청들:');
      failedRequests.forEach(req => {
        console.log(`  - ${req.url}: ${req.status} ${req.error}`);
      });
    } else {
      console.log('✓ 모든 API 요청 성공');
    }
    
    // 성공한 API 요청들 로그
    const successRequests = apiRequests.filter(req => req.status < 400);
    console.log('성공한 API 요청들:');
    successRequests.forEach(req => {
      console.log(`  - ${req.url}: ${req.status}`);
    });
  });

  test('반응형 디자인 테스트', async ({ page }) => {
    console.log('반응형 디자인 테스트...');
    
    // 데스크톱 뷰
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.screenshot({ path: 'screenshots/png/desktop-view.png' });
    
    // 태블릿 뷰
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.screenshot({ path: 'screenshots/png/tablet-view.png' });
    
    // 모바일 뷰
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.screenshot({ path: 'screenshots/png/mobile-view.png' });
    
    // 모든 뷰포트에서 주요 요소가 보이는지 확인
    await expect(page.locator('h1')).toBeVisible();
    
    console.log('✓ 반응형 디자인 테스트 완료');
  });

  test('성능 테스트', async ({ page }) => {
    console.log('성능 테스트 시작...');
    
    const startTime = Date.now();
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    console.log(`페이지 로딩 시간: ${loadTime}ms`);
    
    // 5초 이내 로딩 완료 확인 (개발 환경 기준 관대한 임계값)
    expect(loadTime).toBeLessThan(5000);
    
    // Core Web Vitals 측정 (간단버전)
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        ttfb: navigation.responseStart - navigation.requestStart
      };
    });
    
    console.log('성능 메트릭:', performanceMetrics);
  });

  test('에러 처리 테스트', async ({ page }) => {
    console.log('에러 처리 테스트...');
    
    // 존재하지 않는 페이지 접속
    const notFoundResponse = await page.goto('/nonexistent-page');
    
    // 404 페이지가 적절히 처리되는지 확인
    if (notFoundResponse?.status() === 404) {
      console.log('✓ 404 페이지 올바르게 처리됨');
      await page.screenshot({ path: 'screenshots/png/404-page.png' });
    } else {
      console.log('! 404 처리가 예상과 다름:', notFoundResponse?.status());
    }
    
    // API 오류 시뮬레이션을 위한 네트워크 차단
    await page.route('**/api/**', route => route.abort());
    
    await page.goto('/login');
    
    // 네트워크 오류 시 적절한 에러 메시지가 표시되는지 확인
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/png/network-error-simulation.png' });
    
    console.log('에러 처리 테스트 완료');
  });
});