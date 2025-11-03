const { test, expect } = require('@playwright/test');

test('Quick homepage loading test', async ({ page }) => {
  console.log('🚀 Quick homepage test starting...');
  
  // Set a shorter timeout for this test
  page.setDefaultTimeout(10000);
  
  try {
    // Navigate to homepage with a very short timeout
    console.log('📍 Navigating to homepage...');
    const response = await page.goto('http://localhost:3000', { 
      waitUntil: 'domcontentloaded',
      timeout: 8000 
    });
    
    console.log(`📊 Response status: ${response?.status()}`);
    
    if (response?.status() === 200) {
      console.log('✅ Homepage loaded successfully!');
      
      // Check if the page has basic content
      const title = await page.title();
      console.log(`📄 Page title: ${title}`);
      
      // Look for the BandAuto text
      const bandAutoText = await page.locator('text=BandAuto').first();
      if (await bandAutoText.isVisible({ timeout: 3000 })) {
        console.log('✅ BandAuto text found on page');
      } else {
        console.log('❌ BandAuto text not found');
      }
      
      // Take a screenshot for verification
      await page.screenshot({ 
        path: 'screenshots/quick-homepage-success.png',
        fullPage: true 
      });
      console.log('📸 Screenshot saved: screenshots/quick-homepage-success.png');
      
      expect(response?.status()).toBe(200);
    } else {
      throw new Error(`Unexpected status: ${response?.status()}`);
    }
    
  } catch (error) {
    console.log(`🚨 Homepage test failed: ${error.message}`);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'screenshots/quick-homepage-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved');
    
    throw error;
  }
});