import { test, expect } from '@playwright/test';

const AWS_SERVER_URL = 'http://54.253.75.175:3000';

test.describe('AWS 배포 사이트 테스트', () => {
  test('AWS 서버 연결 및 메인 페이지 로딩 확인', async ({ page }) => {
    console.log('AWS 서버에 접속 시도:', AWS_SERVER_URL);

    try {
      // AWS 서버에 접속
      const response = await page.goto(AWS_SERVER_URL, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      console.log('HTTP 응답 상태:', response?.status());
      console.log('HTTP 응답 헤더:', await response?.allHeaders());

      // 페이지 제목 확인
      const title = await page.title();
      console.log('페이지 제목:', title);

      // 페이지 URL 확인
      const currentUrl = page.url();
      console.log('현재 URL:', currentUrl);

      // 페이지 내용 확인
      const bodyText = await page.textContent('body');
      console.log('페이지 내용 (처음 200자):', bodyText?.substring(0, 200));

      // 스크린샷 촬영
      await page.screenshot({
        path: 'screenshots/aws-deployment-test.png',
        fullPage: true
      });

      // 기본적인 검증
      expect(response?.status()).toBeLessThan(500); // 500 에러가 아닌지 확인
      expect(currentUrl).toContain('54.253.75.175:3000');

    } catch (error) {
      console.error('접속 오류:', error);

      // 오류 상황에서도 스크린샷 촬영
      await page.screenshot({
        path: 'screenshots/aws-deployment-error.png',
        fullPage: true
      });

      throw error;
    }
  });

  test('메인 페이지 기본 요소 확인', async ({ page }) => {
    await page.goto(AWS_SERVER_URL, { timeout: 30000 });

    // HTML 구조 확인
    const html = await page.content();
    console.log('HTML 길이:', html.length);

    // Next.js 관련 요소 확인
    const nextScript = await page.$$('script[src*="next"]');
    console.log('Next.js 스크립트 개수:', nextScript.length);

    // React 애플리케이션 root 요소 확인
    const rootElement = await page.$('#__next, #root, [data-reactroot]');
    if (rootElement) {
      console.log('React 루트 요소 발견');
    } else {
      console.log('React 루트 요소를 찾을 수 없음');
    }

    // 콘솔 로그 수집
    page.on('console', msg => {
      console.log('브라우저 콘솔:', msg.type(), msg.text());
    });

    // 네트워크 오류 확인
    page.on('requestfailed', request => {
      console.log('네트워크 요청 실패:', request.url(), request.failure());
    });
  });

  test('API 엔드포인트 테스트', async ({ page }) => {
    // API 상태 확인
    try {
      const apiResponse = await page.request.get(`${AWS_SERVER_URL}/api/health`);
      console.log('API Health Check 응답:', apiResponse.status());
    } catch (error) {
      console.log('Health Check API 없음 (정상)');
    }

    // 정적 파일 로딩 확인
    try {
      const faviconResponse = await page.request.get(`${AWS_SERVER_URL}/favicon.ico`);
      console.log('Favicon 응답:', faviconResponse.status());
    } catch (error) {
      console.log('Favicon 로딩 실패');
    }
  });
});