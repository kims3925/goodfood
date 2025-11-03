import { test, expect } from '@playwright/test';

const AWS_SERVER_URL = 'http://54.253.75.175:3000';

test.describe('Band 설정 API 인증 테스트', () => {
  test('로그인 후 Band 설정 API 테스트', async ({ page }) => {
    console.log('🔐 Band 설정 API 인증 테스트 시작...');

    // 1. 로그인
    await page.goto(`${AWS_SERVER_URL}/login`);
    await page.fill('input[type="email"]', 'test@bandauto.com');
    await page.fill('input[type="password"]', 'test123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    console.log('✅ 로그인 성공');

    // 2. 세션 상태 확인
    const sessionResponse = await page.request.get(`${AWS_SERVER_URL}/api/auth/session`);
    const sessionData = await sessionResponse.json();
    console.log('🔍 세션 데이터:', sessionData);

    // 3. Band 설정 API GET 테스트
    console.log('🧪 Band 설정 GET API 테스트...');
    const getBandSettingsResponse = await page.request.get(`${AWS_SERVER_URL}/api/settings/band`);
    console.log('📊 GET /api/settings/band 응답 상태:', getBandSettingsResponse.status());

    if (getBandSettingsResponse.status() === 200) {
      const bandSettings = await getBandSettingsResponse.json();
      console.log('✅ Band 설정 조회 성공:', bandSettings);
    } else {
      const errorData = await getBandSettingsResponse.text();
      console.log('❌ Band 설정 조회 실패:', errorData);
    }

    // 4. Band 설정 API POST 테스트 (설정 저장)
    console.log('🧪 Band 설정 POST API 테스트...');
    const postData = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      accessToken: 'test-access-token'
    };

    const postBandSettingsResponse = await page.request.post(`${AWS_SERVER_URL}/api/settings/band`, {
      data: postData
    });

    console.log('📊 POST /api/settings/band 응답 상태:', postBandSettingsResponse.status());

    if (postBandSettingsResponse.status() === 200) {
      const postResult = await postBandSettingsResponse.json();
      console.log('✅ Band 설정 저장 성공:', postResult);
    } else {
      const errorData = await postBandSettingsResponse.text();
      console.log('❌ Band 설정 저장 실패:', errorData);
    }

    // 5. 저장 후 다시 조회해서 확인
    console.log('🔍 저장 후 재조회 테스트...');
    const getAfterPostResponse = await page.request.get(`${AWS_SERVER_URL}/api/settings/band`);

    if (getAfterPostResponse.status() === 200) {
      const updatedSettings = await getAfterPostResponse.json();
      console.log('✅ 업데이트된 설정:', updatedSettings);

      // 저장한 값이 제대로 반영되었는지 확인
      expect(updatedSettings.settings.clientId).toBe('test-client-id');
      expect(updatedSettings.settings.clientSecret).toBe('test-client-secret');
      expect(updatedSettings.settings.accessToken).toBe('test-access-token');
    }

    console.log('🎉 Band 설정 API 테스트 완료!');
  });

  test('로그인 없이 Band 설정 API 접근 테스트', async ({ page }) => {
    console.log('🚫 비인증 상태에서 Band 설정 API 테스트...');

    // 세션 없이 직접 API 호출
    const response = await page.request.get(`${AWS_SERVER_URL}/api/settings/band`);

    console.log('📊 비인증 GET /api/settings/band 응답 상태:', response.status());
    expect(response.status()).toBe(401);

    const errorData = await response.json();
    console.log('✅ 예상된 401 오류:', errorData);
    expect(errorData.error).toContain('인증이 필요합니다');
  });
});