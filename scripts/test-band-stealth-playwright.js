// Band Playwright 스텔스 모드 - 봇 감지 우회
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

// 인간처럼 보이는 랜덤 딜레이 함수
function humanDelay(min = 500, max = 2000) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 자연스러운 타이핑 함수
async function humanType(page, selector, text, delay = 100) {
  await page.click(selector)
  await page.waitForTimeout(humanDelay(200, 500))
  
  for (const char of text) {
    await page.keyboard.type(char)
    await page.waitForTimeout(delay + Math.random() * 50)
  }
}

// 자연스러운 마우스 움직임
async function humanClick(page, selector) {
  const element = await page.$(selector)
  if (!element) throw new Error(`Element not found: ${selector}`)
  
  // 요소 위치로 마우스 이동
  const box = await element.boundingBox()
  const x = box.x + box.width / 2 + (Math.random() - 0.5) * 10
  const y = box.y + box.height / 2 + (Math.random() - 0.5) * 10
  
  await page.mouse.move(x, y, { steps: 10 })
  await page.waitForTimeout(humanDelay(100, 300))
  await page.mouse.click(x, y)
}

async function testBandStealthPlaywright() {
  let browser = null
  let context = null
  let page = null

  try {
    console.log('🥷 Band Stealth Playwright 테스트 시작...')
    
    // 테스트용 이미지 파일 생성
    await createTestImage()
    
    // 고급 스텔스 설정으로 브라우저 실행
    browser = await chromium.launch({
      headless: false,
      slowMo: 0, // slowMo 제거 (수동으로 딜레이 관리)
      args: [
        // 봇 감지 우회를 위한 고급 설정
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor,ImplSidePaintingV2',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--no-first-run',
        '--enable-automation',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-service-autorun',
        '--no-default-browser-check',
        '--no-pings',
        '--mute-audio',
        '--disable-default-apps',
        '--disable-extensions-except',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-mode',
        '--disable-plugins-discovery',
        '--disable-preconnect',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    })
    
    // 고급 컨텍스트 설정
    context = await browser.newContext({
      // 실제 사용자처럼 보이는 설정
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { 
        width: 1366 + Math.floor(Math.random() * 200), 
        height: 768 + Math.floor(Math.random() * 200) 
      },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      permissions: ['geolocation', 'microphone', 'camera', 'midi', 'notifications'],
      geolocation: { 
        latitude: 37.5665 + (Math.random() - 0.5) * 0.01, 
        longitude: 126.9780 + (Math.random() - 0.5) * 0.01 
      },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      javaScriptEnabled: true,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1'
      }
    })
    
    // 고급 봇 감지 우회 스크립트 주입
    await context.addInitScript(() => {
      // Navigator properties 완전 덮어쓰기
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      })
      
      // Chrome detection
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            name: 'Chrome PDF Plugin',
            filename: 'internal-pdf-viewer',
            description: 'Portable Document Format',
            length: 1
          },
          {
            name: 'Chrome PDF Viewer',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            description: '',
            length: 1
          },
          {
            name: 'Native Client',
            filename: 'internal-nacl-plugin',
            description: '',
            length: 2
          }
        ]
      })
      
      // Languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en']
      })
      
      // Platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32'
      })
      
      // Hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8
      })
      
      // Device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8
      })
      
      // Connection
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          type: 'wifi'
        })
      })
      
      // Permissions
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      )
      
      // Remove automation indicators
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol
      
      // Override chrome runtime
      if (!window.chrome) {
        window.chrome = {}
      }
      
      window.chrome.runtime = {
        onConnect: undefined,
        onMessage: undefined
      }
      
      // Mouse and keyboard events
      let mouseX = 0, mouseY = 0
      document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX
        mouseY = e.clientY
      })
      
      // Add some realistic screen properties
      Object.defineProperty(screen, 'availTop', { get: () => 0 })
      Object.defineProperty(screen, 'availLeft', { get: () => 0 })
      Object.defineProperty(screen, 'availHeight', { get: () => screen.height - 40 })
      Object.defineProperty(screen, 'availWidth', { get: () => screen.width })
      
      // WebGL fingerprint obfuscation
      const getParameter = WebGLRenderingContext.getParameter
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {  // UNMASKED_VENDOR_WEBGL
          return 'Intel Inc.'
        }
        if (parameter === 37446) {  // UNMASKED_RENDERER_WEBGL
          return 'Intel(R) HD Graphics'
        }
        return getParameter(parameter)
      }
    })
    
    page = await context.newPage()
    
    // CDP를 사용해 추가 설정
    const client = await page.context().newCDPSession(page)
    
    // Runtime을 통한 추가 스크립트 실행
    await client.send('Runtime.addBinding', { name: 'preventAutomationDetection' })
    await client.send('Runtime.enable')
    
    // 1. Band 홈페이지 접속 (인간처럼)
    console.log('🌐 1단계: Band 홈페이지 접속...')
    await page.goto('https://www.band.us/home', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })
    
    // 페이지 로딩 후 자연스러운 행동
    await page.waitForTimeout(humanDelay(2000, 4000))
    await page.mouse.move(Math.random() * 200, Math.random() * 200)
    await page.waitForTimeout(humanDelay(500, 1500))
    
    // 2. 로그인 버튼 찾기 및 클릭 (여러 시도)
    console.log('🔐 2단계: 로그인 버튼 찾기 및 클릭...')
    const loginSelectors = [
      '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn',
      'button._loginBtn',
      '.button._loginBtn',
      'button:has-text("로그인")',
      '[data-track="login"]'
    ]
    
    let loginClicked = false
    for (const selector of loginSelectors) {
      try {
        const element = await page.$(selector)
        if (element && await element.isVisible()) {
          await humanClick(page, selector)
          loginClicked = true
          console.log(`✅ 로그인 버튼 클릭 성공: ${selector}`)
          break
        }
      } catch (e) {
        console.log(`⚠️ 선택자 ${selector} 시도 실패`)
      }
    }
    
    if (!loginClicked) {
      // 스크린샷으로 현재 상태 확인
      await page.screenshot({ path: './screenshots/login-button-not-found.png', fullPage: true })
      throw new Error('로그인 버튼을 찾을 수 없습니다.')
    }
    
    await page.waitForTimeout(humanDelay(1500, 3000))
    
    // 3. 이메일로 로그인 버튼 클릭
    console.log('📧 3단계: 이메일로 로그인 버튼 클릭...')
    await page.waitForSelector('#email_login_a', { timeout: 10000 })
    await humanClick(page, '#email_login_a')
    await page.waitForTimeout(humanDelay(1000, 2000))
    
    // 4. 이메일 입력 (자연스럽게)
    console.log('✏️ 4단계: 이메일 입력...')
    await page.waitForSelector('#input_email', { timeout: 10000 })
    await humanType(page, '#input_email', 'joshep3399@gmail.com')
    await page.waitForTimeout(humanDelay(500, 1500))
    
    // 5. 이메일 확인 버튼 클릭
    console.log('✅ 5단계: 이메일 확인 버튼 클릭...')
    await humanClick(page, '#email_login_form > button')
    
    // 6. 비밀번호 입력 대기 및 입력
    console.log('🔑 6단계: 비밀번호 입력 대기...')
    await page.waitForSelector('#pw', { timeout: 15000 })
    await page.waitForTimeout(humanDelay(1000, 2000))
    
    await humanType(page, '#pw', 'kimjin0506')
    await page.waitForTimeout(humanDelay(500, 1500))
    
    // 7. 비밀번호 확인 버튼 클릭
    console.log('🔓 7단계: 비밀번호 확인 버튼 클릭...')
    await humanClick(page, '#email_password_login_form > button')
    
    // 8. 로그인 완료 대기 (2단계 인증이 나타날 수 있음)
    console.log('⏰ 8단계: 로그인 처리 대기...')
    await page.waitForTimeout(5000)
    
    // 2단계 인증 확인
    const twoFactorSelectors = [
      '[data-testid="two-factor"]',
      '.two-factor',
      '#sms_code',
      '[name="verification_code"]',
      'input[type="text"][placeholder*="인증"]'
    ]
    
    let twoFactorDetected = false
    for (const selector of twoFactorSelectors) {
      const element = await page.$(selector)
      if (element && await element.isVisible()) {
        twoFactorDetected = true
        console.log('🔔 2단계 인증이 감지되었습니다!')
        console.log('📱 휴대폰으로 받은 인증 코드를 수동으로 입력해주세요.')
        console.log('⏰ 60초 대기 중...')
        await page.waitForTimeout(60000) // 1분 대기
        break
      }
    }
    
    // 로그인 성공 확인
    try {
      await page.waitForURL('**/home**', { timeout: 10000 })
      console.log('✅ 로그인 성공!')
    } catch (e) {
      console.log('⚠️ 로그인 상태 확인 중...')
      await page.screenshot({ path: './screenshots/login-status-check.png', fullPage: true })
    }
    
    // 9. 제이소매밴드 페이지로 이동
    console.log('🏪 9단계: 제이소매밴드 페이지로 이동...')
    await page.goto('https://www.band.us/page/99872677/post', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })
    await page.waitForTimeout(humanDelay(2000, 4000))
    
    // 나머지 단계들도 같은 방식으로 처리...
    console.log('✅ 스텔스 모드 테스트 1단계 완료!')
    console.log('💡 수동으로 나머지 단계를 진행하거나 스크립트를 계속 개발해주세요.')
    
    // 최종 스크린샷
    await page.screenshot({ 
      path: `./screenshots/stealth-test-result-${new Date().toISOString().replace(/[:.]/g, '-')}.png`, 
      fullPage: true 
    })
    
  } catch (error) {
    console.error('❌ 스텔스 테스트 오류:', error)
    
    if (page) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      await page.screenshot({ 
        path: `./screenshots/stealth-error-${timestamp}.png`, 
        fullPage: true 
      })
    }
  } finally {
    console.log('⏸️ 브라우저를 5분간 열어둡니다. 수동으로 확인해주세요.')
    await new Promise(resolve => setTimeout(resolve, 300000)) // 5분 대기
    
    // 정리
    if (page) await page.close()
    if (context) await context.close()
    if (browser) await browser.close()
    
    cleanupTestImage()
  }
}

async function createTestImage() {
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64,
    0x08, 0x02, 0x00, 0x00, 0x00, 0xFF, 0x80, 0x02, 0x03, 0x00, 0x00, 0x00,
    0x15, 0x49, 0x44, 0x41, 0x54, 0x68, 0x81, 0xED, 0xC1, 0x01, 0x01, 0x00,
    0x00, 0x00, 0x80, 0x90, 0xFE, 0xAF, 0x6E, 0x48, 0x40, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ])
  
  fs.writeFileSync('./test-image.png', pngData)
  console.log('✅ 테스트 이미지 생성 완료')
}

function cleanupTestImage() {
  try {
    if (fs.existsSync('./test-image.png')) {
      fs.unlinkSync('./test-image.png')
      console.log('🧹 테스트 이미지 정리 완료')
    }
  } catch (error) {
    console.error('⚠️ 이미지 정리 오류:', error)
  }
}

// 스크린샷 디렉토리 생성
if (!fs.existsSync('./screenshots')) {
  fs.mkdirSync('./screenshots')
}

if (require.main === module) {
  testBandStealthPlaywright()
    .then(() => {
      console.log('\n🏁 스텔스 모드 테스트 완료')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 테스트 오류:', error)
      process.exit(1)
    })
}

module.exports = { testBandStealthPlaywright }