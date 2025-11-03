// 가설 3: 완전한 핑거프린팅 우회로 2단계 인증 우회
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

async function testHypothesis3FingerprintBypass() {
  let browser = null
  let context = null
  let page = null
  
  try {
    console.log('🕵️ 가설 3: 완전한 핑거프린팅 우회 테스트 시작...')
    console.log('🎭 모든 자동화 감지 포인트를 완벽하게 우회')
    
    // 인증 정보 로드
    const credentials = JSON.parse(fs.readFileSync('./band-credentials.json', 'utf8'))
    console.log(`📧 테스트 이메일: ${credentials.email}`)
    
    // 브라우저 실행 (최대 스텔스 모드)
    browser = await chromium.launch({
      headless: false,
      slowMo: 500,
      args: [
        // 기본 자동화 감지 우회
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        
        // 고급 감지 우회
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
        '--password-store=basic',
        '--use-mock-keychain',
        
        // 추가 우회 설정
        '--disable-features=TranslateUI,VizDisplayCompositor',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-zygote',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-plugins',
        
        // 실제 사용자 에이전트
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    })
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      geolocation: { latitude: 37.5665, longitude: 126.9780 },
      permissions: ['geolocation', 'notifications', 'camera', 'microphone'],
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      }
    })
    
    // 최고 수준의 핑거프린팅 우회 스크립트
    await context.addInitScript(() => {
      console.log('🔧 완전한 핑거프린팅 우회 스크립트 실행 중...')
      
      // 1. 모든 자동화 감지 변수 제거
      const automationProps = [
        'webdriver', 'callPhantom', '_phantom', 'phantom',
        'Buffer', 'emit', 'spawn', 'fmget_targets',
        'webdriver-evaluate', '__nightmare', '_Selenium_IDE_Recorder',
        '__selenium_unwrapped', '__webdriver_script_fn',
        'cdc_adoQpoasnfa76pfcZLmcfl_Array',
        'cdc_adoQpoasnfa76pfcZLmcfl_Promise', 
        'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
        'cdc_adoQpoasnfa76pfcZLmcfl_Object'
      ]
      
      automationProps.forEach(prop => {
        if (window[prop]) delete window[prop]
        if (document[prop]) delete document[prop]
        if (navigator[prop]) delete navigator[prop]
      })
      
      // 2. Navigator 속성 완전 정규화
      delete Object.getPrototypeOf(navigator).webdriver
      delete navigator.__proto__.webdriver
      delete navigator.webdriver
      
      // 3. Chrome 환경 완벽 시뮬레이션
      if (!window.chrome || !window.chrome.runtime) {
        window.chrome = {
          runtime: {
            onConnect: undefined,
            onMessage: undefined,
            connect: function() { return { onDisconnect: { addListener: function() {} } } },
            sendMessage: function() {},
            onInstalled: { addListener: function() {} }
          },
          app: { 
            isInstalled: false,
            getDetails: function() { return null }
          },
          webstore: {
            onInstallStageChanged: {},
            onDownloadProgress: {},
            install: function() {}
          },
          storage: {
            sync: {
              get: function() {},
              set: function() {},
              remove: function() {}
            },
            local: {
              get: function() {},
              set: function() {},
              remove: function() {}
            }
          }
        }
      }
      
      // 4. Navigator 속성 완벽 재정의
      const navigatorProps = {
        webdriver: { get: () => undefined, configurable: true },
        plugins: {
          get: () => ({
            length: 5,
            0: { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            2: { name: 'Chromium PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            3: { name: 'Microsoft Edge PDF Viewer', filename: 'pdf', description: '' },
            4: { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: '' }
          }),
          configurable: true
        },
        languages: { 
          get: () => ['ko-KR', 'ko', 'en-US', 'en'], 
          configurable: true 
        },
        platform: { get: () => 'Win32', configurable: true },
        hardwareConcurrency: { get: () => 8, configurable: true },
        deviceMemory: { get: () => 8, configurable: true },
        maxTouchPoints: { get: () => 0, configurable: true },
        vendor: { get: () => 'Google Inc.', configurable: true },
        vendorSub: { get: () => '', configurable: true },
        productSub: { get: () => '20030107', configurable: true },
        cookieEnabled: { get: () => true, configurable: true },
        onLine: { get: () => true, configurable: true },
        doNotTrack: { get: () => '1', configurable: true }
      }
      
      Object.defineProperties(navigator, navigatorProps)
      
      // 5. WebGL 핑거프린팅 우회
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        const fakeValues = {
          37445: 'Intel Inc.', // UNMASKED_VENDOR_WEBGL
          37446: 'Intel(R) UHD Graphics 630', // UNMASKED_RENDERER_WEBGL
          7936: 'WebKit WebGL', // VERSION
          7937: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)', // SHADING_LANGUAGE_VERSION
          7938: 'WebKit' // VENDOR
        }
        return fakeValues[parameter] || originalGetParameter.call(this, parameter)
      }
      
      if (WebGL2RenderingContext) {
        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {
          const fakeValues = {
            37445: 'Intel Inc.',
            37446: 'Intel(R) UHD Graphics 630',
            7936: 'WebGL 2.0 (OpenGL ES 3.0 Chromium)',
            7937: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)',
            7938: 'WebKit'
          }
          return fakeValues[parameter] || originalGetParameter2.call(this, parameter)
        }
      }
      
      // 6. Canvas 핑거프린팅 우회
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL
      HTMLCanvasElement.prototype.toDataURL = function() {
        const context = this.getContext('2d')
        if (context) {
          const imageData = context.getImageData(0, 0, this.width, this.height)
          // 약간의 노이즈 추가로 매번 다른 결과 생성
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] += Math.floor(Math.random() * 3) - 1
            imageData.data[i + 1] += Math.floor(Math.random() * 3) - 1
            imageData.data[i + 2] += Math.floor(Math.random() * 3) - 1
          }
          context.putImageData(imageData, 0, 0)
        }
        return originalToDataURL.apply(this, arguments)
      }
      
      // 7. Audio 핑거프린팅 우회
      if (window.AudioContext || window.webkitAudioContext) {
        const OriginalAudioContext = window.AudioContext || window.webkitAudioContext
        const audioContext = new OriginalAudioContext()
        const originalCreateAnalyser = audioContext.createAnalyser
        
        audioContext.createAnalyser = function() {
          const analyser = originalCreateAnalyser.call(this)
          const originalGetFloatFrequencyData = analyser.getFloatFrequencyData
          
          analyser.getFloatFrequencyData = function(array) {
            originalGetFloatFrequencyData.call(this, array)
            // 약간의 노이즈 추가
            for (let i = 0; i < array.length; i++) {
              array[i] += (Math.random() - 0.5) * 0.0001
            }
          }
          
          return analyser
        }
      }
      
      // 8. 스크린 속성 정규화
      Object.defineProperties(screen, {
        availTop: { get: () => 0, configurable: true },
        availLeft: { get: () => 0, configurable: true },
        availHeight: { get: () => screen.height - 40, configurable: true },
        availWidth: { get: () => screen.width, configurable: true },
        colorDepth: { get: () => 24, configurable: true },
        pixelDepth: { get: () => 24, configurable: true }
      })
      
      // 9. 퍼포먼스 API 정규화
      if (window.performance && window.performance.memory) {
        Object.defineProperty(window.performance, 'memory', {
          get: () => ({
            usedJSHeapSize: 16777216 + Math.floor(Math.random() * 16777216),
            totalJSHeapSize: 33554432 + Math.floor(Math.random() * 16777216),
            jsHeapSizeLimit: 4294967296
          }),
          configurable: true
        })
      }
      
      // 10. 마우스/키보드 이벤트 카운터
      let mouseEventCount = 0
      let keyboardEventCount = 0
      
      document.addEventListener('mousemove', () => mouseEventCount++)
      document.addEventListener('click', () => mouseEventCount++)
      document.addEventListener('keydown', () => keyboardEventCount++)
      document.addEventListener('keyup', () => keyboardEventCount++)
      
      // 이벤트 카운터 노출
      window.getMouseEventCount = () => mouseEventCount
      window.getKeyboardEventCount = () => keyboardEventCount
      
      // 11. Date/Time 정규화
      const originalDate = Date
      Date = function(...args) {
        if (args.length === 0) {
          return new originalDate(originalDate.now() + Math.floor(Math.random() * 1000))
        }
        return new originalDate(...args)
      }
      Date.now = () => originalDate.now() + Math.floor(Math.random() * 1000)
      Date.prototype = originalDate.prototype
      
      console.log('✅ 완전한 핑거프린팅 우회 스크립트 적용 완료')
    })
    
    page = await context.newPage()
    
    // 추가 페이지 레벨 스크립트
    await page.addInitScript(() => {
      // 페이지별 추가 설정
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true })
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true })
    })
    
    console.log('🌐 1단계: Band 홈페이지 접속...')
    await page.goto('https://www.band.us/home', { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    
    console.log('🔐 2단계: 로그인 버튼 클릭...')
    const loginSelector = '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn'
    await page.click(loginSelector)
    await page.waitForTimeout(2000)
    
    console.log('📧 3단계: 이메일로 로그인 선택...')
    await page.click('#email_login_a')
    await page.waitForTimeout(2000)
    
    console.log('✏️ 4단계: 이메일 입력...')
    await page.click('#input_email')
    
    // 클립보드 방식
    await page.evaluate((email) => {
      navigator.clipboard.writeText(email).catch(() => {
        const textArea = document.createElement('textarea')
        textArea.value = email
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      })
    }, credentials.email)
    
    await page.waitForTimeout(1000)
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(1000)
    
    console.log('✅ 5단계: 이메일 확인 버튼 클릭...')
    await page.click('#email_login_form > button')
    await page.waitForTimeout(3000)
    
    console.log('🔑 6단계: 비밀번호 입력 대기...')
    
    try {
      await page.waitForSelector('#pw', { timeout: 15000 })
      console.log('🔑 비밀번호 입력 필드 발견!')
      
      await page.click('#pw')
      
      await page.evaluate((password) => {
        navigator.clipboard.writeText(password).catch(() => {
          const textArea = document.createElement('textarea')
          textArea.value = password
          textArea.style.position = 'fixed'
          textArea.style.left = '-9999px'
          document.body.appendChild(textArea)
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
        })
      }, credentials.password)
      
      await page.waitForTimeout(1000)
      await page.keyboard.press('Control+v')
      await page.waitForTimeout(1000)
      
      console.log('🔓 7단계: 로그인 실행...')
      await page.click('#email_password_login_form > button')
      await page.waitForTimeout(5000)
      
      // 결과 확인
      const currentUrl = page.url()
      console.log(`📍 현재 URL: ${currentUrl}`)
      
      if (currentUrl.includes('band.us') && !currentUrl.includes('login')) {
        console.log('✅ 가설 3 성공: 완전한 핑거프린팅 우회로 2단계 인증 우회!')
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await page.screenshot({ 
          path: `./screenshots/hypothesis-3-success-${timestamp}.png`, 
          fullPage: true 
        })
        
        return { success: true, method: '완전한 핑거프린팅 우회' }
      } else {
        console.log('❌ 가설 3 실패')
        return { success: false, method: '완전한 핑거프린팅 우회' }
      }
      
    } catch (error) {
      console.log('❌ 가설 3 실패: 비밀번호 단계 도달 실패 (2단계 인증 추정)')
      return { success: false, method: '완전한 핑거프린팅 우회', error: '2단계 인증 추정' }
    }
    
  } catch (error) {
    console.error('❌ 가설 3 테스트 오류:', error.message)
    return { success: false, method: '완전한 핑거프린팅 우회', error: error.message }
  } finally {
    console.log('⏸️ 결과 확인을 위해 1분간 대기...')
    await new Promise(resolve => setTimeout(resolve, 60000))
    
    if (page) await page.close()
    if (context) await context.close()
    if (browser) await browser.close()
  }
}

// 스크린샷 디렉토리 생성
if (!fs.existsSync('./screenshots')) {
  fs.mkdirSync('./screenshots')
}

// 스크립트 실행
if (require.main === module) {
  testHypothesis3FingerprintBypass()
    .then((result) => {
      console.log('\n📊 가설 3 테스트 결과:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 가설 3 테스트 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { testHypothesis3FingerprintBypass }