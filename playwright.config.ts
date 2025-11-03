import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000, // 60초 타임아웃
  expect: {
    timeout: 10000, // assertion 타임아웃
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },
    video: 'retain-on-failure',
    // 네트워크 요청 대기 시간 설정
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // 스크린샷과 비디오 저장 경로 설정
  outputDir: 'screenshots/',

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // 한국어 설정
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
      },
    },
    // 현재 Chromium만 사용 (다른 브라우저는 설치되지 않음)
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2분 대기
  },
});