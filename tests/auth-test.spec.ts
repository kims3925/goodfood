import { test, expect } from '@playwright/test';

const AWS_SERVER_URL = 'http://54.253.75.175:3000';

test.describe('AWS 인증 테스트', () => {
  test('로그인 및 대시보드 접속 테스트', async ({ page }) => {
    console.log('🔐 로그인 테스트 시작...');

    // 1. 로그인 페이지로 이동
    await page.goto(`${AWS_SERVER_URL}/login`);

    // 로그인 폼 요소 확인
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // 2. 테스트 계정으로 로그인
    await page.fill('input[type="email"]', 'test@bandauto.com');
    await page.fill('input[type="password"]', 'test123!@#');

    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');

    // 3. 로그인 성공 후 리다이렉트 확인
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    console.log('✅ 로그인 성공, 대시보드로 리다이렉트됨');

    // 4. 세션 상태 확인
    const sessionResponse = await page.request.get(`${AWS_SERVER_URL}/api/auth/session`);
    const sessionData = await sessionResponse.json();

    console.log('🔍 세션 데이터:', sessionData);
    expect(sessionData.user).toBeDefined();
    expect(sessionData.user.email).toBe('test@bandauto.com');

    // 5. API 인증 확인 - 이전에 401이었던 엔드포인트들 테스트
    const protectedEndpoints = [
      '/api/wholesale/bands',
      '/api/products',
      '/api/settings/band'
    ];

    for (const endpoint of protectedEndpoints) {
      console.log(`🧪 테스트 중: ${endpoint}`);
      const response = await page.request.get(`${AWS_SERVER_URL}${endpoint}`);
      console.log(`📊 ${endpoint} 응답 상태:`, response.status());

      // 401이 아닌 응답이면 성공 (200, 404, 500 등은 모두 인증 통과)
      expect(response.status()).not.toBe(401);
    }

    console.log('🎉 모든 인증 테스트 통과!');
  });

  test('로그아웃 테스트', async ({ page }) => {
    console.log('🚪 로그아웃 테스트 시작...');

    // 1. 먼저 로그인
    await page.goto(`${AWS_SERVER_URL}/login`);
    await page.fill('input[type="email"]', 'test@bandauto.com');
    await page.fill('input[type="password"]', 'test123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // 2. 로그아웃 버튼 찾아서 클릭
    const logoutButton = page.locator('text=로그아웃').or(page.locator('text=Logout')).or(page.locator('[data-testid="logout"]'));

    if (await logoutButton.count() > 0) {
      await logoutButton.first().click();
      console.log('✅ 로그아웃 버튼 클릭됨');

      // 로그인 페이지로 리다이렉트되는지 확인
      await page.waitForURL('**/login', { timeout: 5000 });
      console.log('✅ 로그인 페이지로 리다이렉트됨');
    } else {
      console.log('ℹ️ 로그아웃 버튼을 찾을 수 없음 (UI에 따라 다를 수 있음)');
    }

    // 3. 세션이 정리되었는지 확인
    const sessionResponse = await page.request.get(`${AWS_SERVER_URL}/api/auth/session`);
    const sessionData = await sessionResponse.json();

    console.log('🔍 로그아웃 후 세션 데이터:', sessionData);
    expect(sessionData).toEqual({});
  });
});