const { test, expect } = require('@playwright/test');

test('Production server login functionality test', async ({ page }) => {
  // Navigate to the production server
  await page.goto('http://localhost:3000');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Check if homepage loads correctly
  await expect(page).toHaveTitle(/BandAuto/);
  
  // Navigate to login page
  await page.click('a[href="/login"]');
  await page.waitForURL('**/login');
  
  // Test login form is present
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  
  // Test with valid test credentials
  await page.fill('input[name="email"]', 'test@bandauto.com');
  await page.fill('input[name="password"]', 'test123!@#');
  
  // Submit login form
  await page.click('button[type="submit"]');
  
  // Wait for redirect after successful login
  await page.waitForURL('**/dashboard');
  
  // Verify successful login by checking dashboard elements
  await expect(page.locator('h1')).toContainText('대시보드');
  
  console.log('✅ Production server login test completed successfully');
});

test('API endpoints functionality test', async ({ request }) => {
  // Test NextAuth API endpoints are working
  const authResponse = await request.get('http://localhost:3000/api/auth/session');
  expect(authResponse.status()).toBe(200);
  
  // Test other API endpoints
  const userBandsResponse = await request.get('http://localhost:3000/api/user/bands');
  expect([200, 401]).toContain(userBandsResponse.status()); // 401 is ok for unauthenticated
  
  console.log('✅ API endpoints are responding correctly');
});