import { test, expect } from '@playwright/test';

test.describe('BandAuto Homepage', () => {
  test('should load homepage successfully', async ({ page }) => {
    console.log('Navigating to homepage...');
    
    // Navigate to the homepage
    const response = await page.goto('/');
    
    // Check if the response is successful
    expect(response?.status()).toBe(200);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'homepage-loaded.png', fullPage: true });
    
    // Check for any console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Check if page title exists
    const title = await page.title();
    console.log('Page title:', title);
    
    // Look for any error messages or failed loads
    const errorElements = page.locator('[data-testid="error"], .error, .error-message');
    const errorCount = await errorElements.count();
    
    if (errorCount > 0) {
      console.log(`Found ${errorCount} error elements on the page`);
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`Error ${i + 1}:`, errorText);
      }
    }
    
    // Check for 404 or error pages
    const notFoundText = await page.textContent('body');
    if (notFoundText?.includes('404') || notFoundText?.includes('Not Found')) {
      throw new Error('Page shows 404 or Not Found error');
    }
    
    // Log console errors if any
    if (errors.length > 0) {
      console.log('Console errors found:', errors);
    }
    
    // Basic assertions
    expect(page.url()).toContain('localhost:3001');
    
    // Check if essential elements are present
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    console.log('Homepage test completed successfully');
  });

  test('should check navigation and routing', async ({ page }) => {
    await page.goto('/');
    
    // Look for navigation elements
    const navLinks = page.locator('nav a, .nav a, [role="navigation"] a');
    const linkCount = await navLinks.count();
    
    console.log(`Found ${linkCount} navigation links`);
    
    // Test main routes that should be accessible
    const routesToTest = ['/login', '/register'];
    
    for (const route of routesToTest) {
      console.log(`Testing route: ${route}`);
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      
      // Check if page loads without errors
      await page.waitForLoadState('networkidle');
      
      // Take screenshot for each route
      await page.screenshot({ path: `route-${route.replace('/', '')}.png` });
    }
  });

  test('should check for database and API connectivity', async ({ page }) => {
    // Set up network monitoring
    const apiRequests: any[] = [];
    const failedRequests: any[] = [];
    
    page.on('response', (response) => {
      if (response.url().includes('/api/')) {
        if (response.status() >= 400) {
          failedRequests.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText()
          });
        }
        apiRequests.push({
          url: response.url(),
          status: response.status()
        });
      }
    });
    
    await page.goto('/');
    
    // Wait a bit for any initial API calls
    await page.waitForTimeout(3000);
    
    console.log(`Found ${apiRequests.length} API requests`);
    if (failedRequests.length > 0) {
      console.log('Failed API requests:');
      failedRequests.forEach(req => {
        console.log(`  ${req.url}: ${req.status} ${req.statusText}`);
      });
    }
    
    // Try to access protected routes to test auth
    const loginResponse = await page.goto('/login');
    expect(loginResponse?.status()).toBe(200);
    
    // Try accessing dashboard (should redirect to login if not authenticated)
    const dashboardResponse = await page.goto('/dashboard');
    
    // Should either be 200 (if somehow authenticated) or redirect to login
    if (dashboardResponse?.status() === 200) {
      console.log('Dashboard accessible (user might be authenticated)');
    } else {
      console.log('Dashboard redirected (authentication required)');
    }
  });
});