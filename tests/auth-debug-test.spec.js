const { test, expect } = require('@playwright/test');

test('Debug NextAuth 401 error', async ({ page, context }) => {
  console.log('🔍 Starting authentication debugging...');
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('🚨 Console Error:', msg.text());
    }
  });
  
  // Monitor network requests
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`🔴 HTTP ${response.status()}: ${response.url()}`);
    }
  });
  
  // Navigate to login page
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  
  console.log('📍 Current URL:', page.url());
  
  // Fill credentials
  await page.fill('input#email', 'test@bandauto.com');
  await page.fill('input#password', 'test123!@#');
  
  console.log('✏️ Credentials filled');
  
  // Submit form and capture network activity
  const responsePromise = page.waitForResponse(response => 
    response.url().includes('/api/auth/callback/credentials')
  );
  
  await page.click('button[type="submit"]');
  
  try {
    const response = await responsePromise;
    console.log('📡 Callback Response Status:', response.status());
    console.log('📡 Callback Response URL:', response.url());
    
    if (response.status() !== 200) {
      const responseText = await response.text();
      console.log('📄 Response Body:', responseText);
    }
  } catch (error) {
    console.log('❌ Failed to capture callback response:', error.message);
  }
  
  // Wait and check final state
  await page.waitForTimeout(5000);
  
  const finalUrl = page.url();
  console.log('🏁 Final URL:', finalUrl);
  
  // Take final screenshot
  await page.screenshot({ path: 'auth-debug-final.png' });
  
  if (finalUrl.includes('/dashboard')) {
    console.log('✅ Successfully redirected to dashboard');
  } else if (finalUrl.includes('/login')) {
    console.log('❌ Still on login page - authentication failed');
    
    // Check for error messages
    const errorElement = page.locator('.bg-red-50, .text-red-800, [data-testid="error"]');
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      console.log('🚨 Error Message:', errorText);
    }
  }
});

test('Test credentials directly with API', async ({ request }) => {
  console.log('🧪 Testing credentials API directly...');
  
  // Get CSRF token first
  const csrfResponse = await request.get('http://localhost:3000/api/auth/csrf');
  const csrfData = await csrfResponse.json();
  const csrfToken = csrfData.csrfToken;
  
  console.log('🔑 CSRF Token:', csrfToken);
  
  // Test signin API
  const signinResponse = await request.post('http://localhost:3000/api/auth/callback/credentials', {
    data: {
      email: 'test@bandauto.com',
      password: 'test123!@#',
      csrfToken: csrfToken,
      callbackUrl: 'http://localhost:3000/dashboard',
      json: 'true'
    }
  });
  
  console.log('📡 SignIn API Status:', signinResponse.status());
  console.log('📡 SignIn API Response:', await signinResponse.text());
});