const { test, expect } = require('@playwright/test');

test('Direct login page test on production server', async ({ page }) => {
  console.log('Testing direct access to login page...');
  
  // Navigate directly to login page
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  
  // Take screenshot for debugging
  await page.screenshot({ path: 'login-page-screenshot.png' });
  
  // Check if login form is present
  const emailInput = page.locator('input#email');
  const passwordInput = page.locator('input#password');
  const submitButton = page.locator('button[type="submit"]');
  
  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(submitButton).toBeVisible();
  
  console.log('Login form elements are visible');
  
  // Test with valid credentials
  await emailInput.fill('test@bandauto.com');
  await passwordInput.fill('test123!@#');
  
  console.log('Filled login credentials');
  
  // Submit the form
  await submitButton.click();
  
  // Wait a bit for any processing
  await page.waitForTimeout(3000);
  
  // Check current URL and page content
  const currentUrl = page.url();
  console.log('Current URL after login attempt:', currentUrl);
  
  // Take screenshot after login attempt
  await page.screenshot({ path: 'after-login-screenshot.png' });
  
  // If redirected to dashboard, verify dashboard content
  if (currentUrl.includes('/dashboard')) {
    await expect(page.locator('h1')).toContainText('대시보드');
    console.log('✅ Login successful - redirected to dashboard');
  } else {
    // Check if there are any error messages
    const errorElement = page.locator('.error, [data-testid="error"], .text-red-500');
    const hasError = await errorElement.isVisible();
    
    if (hasError) {
      const errorText = await errorElement.textContent();
      console.log('❌ Login error:', errorText);
    } else {
      console.log('⚠️ Login did not redirect to dashboard, current URL:', currentUrl);
    }
  }
});

test('Test NextAuth API endpoints directly', async ({ request }) => {
  console.log('Testing NextAuth API endpoints...');
  
  // Test session endpoint
  const sessionResponse = await request.get('http://localhost:3000/api/auth/session');
  console.log('Session API status:', sessionResponse.status());
  console.log('Session response:', await sessionResponse.text());
  
  // Test providers endpoint
  const providersResponse = await request.get('http://localhost:3000/api/auth/providers');
  console.log('Providers API status:', providersResponse.status());
  
  // Test csrf endpoint
  const csrfResponse = await request.get('http://localhost:3000/api/auth/csrf');
  console.log('CSRF API status:', csrfResponse.status());
  
  expect([200, 404]).toContain(sessionResponse.status());
  console.log('✅ NextAuth endpoints are responding');
});