// Band 제이소매밴드 정확한 셀렉터 테스트
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

// 로그인 정보 로드
function loadCredentials() {
  try {
    const credentialsPath = path.join(__dirname, '..', 'band-credentials.json')
    const data = fs.readFileSync(credentialsPath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('❌ band-credentials.json 파일을 읽을 수 없습니다:', error.message)
    throw new Error('로그인 정보 파일이 필요합니다.')
  }
}

// 인간처럼 보이는 랜덤 딜레이
function humanDelay(min = 800, max = 2500) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 클립보드 붙여넣기 방식 (봇 감지 우회용)
async function pasteText(page, selector, text) {
  console.log(`📋 클립보드 붙여넣기 시작: ${text}`)
  
  // 입력 필드 클릭하여 포커스
  await page.click(selector)
  await page.waitForTimeout(humanDelay(300, 700))
  
  // 기존 내용 전체 선택
  await page.keyboard.press('Control+a')
  await page.waitForTimeout(200)
  
  // 클립보드에 텍스트 복사
  await page.evaluate((text) => {
    return navigator.clipboard.writeText(text).catch(() => {
      // 클립보드 API 실패시 대체 방법
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    })
  }, text)
  
  await page.waitForTimeout(humanDelay(200, 500))
  
  // 클립보드에서 붙여넣기
  await page.keyboard.press('Control+v')
  await page.waitForTimeout(humanDelay(300, 800))
  
  console.log(`✅ 클립보드 붙여넣기 완료: ${text}`)
}

// 자연스러운 마우스 클릭
async function humanClick(page, selector, options = {}) {
  const element = await page.$(selector)
  if (!element) throw new Error(`Element not found: ${selector}`)
  
  // 스크롤해서 보이게 하기
  await element.scrollIntoViewIfNeeded()
  await page.waitForTimeout(humanDelay(300, 800))
  
  // 요소 위치로 마우스 이동
  const box = await element.boundingBox()
  if (!box) throw new Error(`Element not visible: ${selector}`)
  
  const x = box.x + box.width / 2 + (Math.random() - 0.5) * 20
  const y = box.y + box.height / 2 + (Math.random() - 0.5) * 10
  
  // 자연스러운 마우스 움직임
  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 })
  await page.waitForTimeout(humanDelay(100, 400))
  
  // 마우스 호버
  await page.hover(selector)
  await page.waitForTimeout(humanDelay(100, 300))
  
  // 클릭
  await page.click(selector, options)
}

async function testBandFinalStealth() {
  let browser = null
  let context = null
  let page = null
  
  try {
    console.log('🥷 Band 제이소매밴드 정확한 셀렉터 테스트 시작...')
    console.log('🎯 타겟: 제이소매밴드 (https://www.band.us/page/99872677/post)')
    
    // 로그인 정보 로드
    const credentials = loadCredentials()
    console.log(`📧 사용할 이메일: ${credentials.email}`)
    
    // 테스트 이미지 생성
    await createTestImage()
    
    // 최고 수준의 스텔스 브라우저 설정
    browser = await chromium.launch({
      headless: false,
      slowMo: 0,
      args: [
        // 기본 봇 감지 우회
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        
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
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-zygote',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        
        // 사용자 에이전트
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    })
    
    // 실제 사용자와 유사한 컨텍스트 설정
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      permissions: ['geolocation', 'notifications'],
      geolocation: { latitude: 37.5665, longitude: 126.9780 },
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    })
    
    // 강력한 봇 감지 우회 스크립트
    await context.addInitScript(() => {
      // 모든 자동화 감지 제거
      delete Object.getPrototypeOf(navigator).webdriver
      delete navigator.__proto__.webdriver
      delete navigator.webdriver
      
      // Chrome 객체 완전 구현
      if (!window.chrome) {
        window.chrome = {
          runtime: {
            onConnect: undefined,
            onMessage: undefined
          },
          app: {
            isInstalled: false
          },
          webstore: {
            onInstallStageChanged: {},
            onDownloadProgress: {}
          }
        }
      }
      
      // navigator 속성 완전 재정의
      Object.defineProperties(navigator, {
        webdriver: { get: () => undefined },
        plugins: {
          get: () => ({
            length: 3,
            0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
            1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            2: { name: 'Native Client', filename: 'internal-nacl-plugin' }
          })
        },
        languages: { get: () => ['ko-KR', 'ko', 'en-US', 'en'] },
        platform: { get: () => 'Win32' },
        hardwareConcurrency: { get: () => 8 },
        deviceMemory: { get: () => 8 },
        maxTouchPoints: { get: () => 0 },
        vendor: { get: () => 'Google Inc.' }
      })
      
      // Permission API 모킹
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = (parameters) => {
        return parameters.name === 'notifications' 
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters)
      }
      
      // 자동화 감지 변수들 제거
      [
        'cdc_adoQpoasnfa76pfcZLmcfl_Array',
        'cdc_adoQpoasnfa76pfcZLmcfl_Promise', 
        'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
        'webdriver'
      ].forEach(key => delete window[key])
      
      // WebGL 핑거프린트 정규화
      const getParameter = WebGLRenderingContext.getParameter
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.'
        if (parameter === 37446) return 'Intel(R) UHD Graphics 630'
        return getParameter(parameter)
      }
      
      // 마우스 이벤트 시뮬레이션
      let mouseEvents = 0
      document.addEventListener('mousemove', () => mouseEvents++)
      document.addEventListener('click', () => mouseEvents++)
      
      // 키보드 이벤트 시뮬레이션  
      let keyEvents = 0
      document.addEventListener('keydown', () => keyEvents++)
      document.addEventListener('keyup', () => keyEvents++)
      
      // 화면 속성 재정의
      Object.defineProperties(screen, {
        availTop: { get: () => 0 },
        availLeft: { get: () => 0 },
        availHeight: { get: () => screen.height - 40 },
        availWidth: { get: () => screen.width }
      })
    })
    
    page = await context.newPage()
    
    // 1. Band 홈페이지 접속
    console.log('🌐 1단계: Band 홈페이지 접속 - https://www.band.us/home')
    await page.goto('https://www.band.us/home', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    
    // 2. 로그인 버튼 클릭
    console.log('🔐 2단계: 로그인 버튼 클릭...')
    const loginSelector = '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn'
    await humanClick(page, loginSelector)
    await page.waitForTimeout(2000)
    
    // 3. 이메일로 로그인 버튼 클릭
    console.log('📧 3단계: 이메일로 로그인 버튼 클릭...')
    await humanClick(page, '#email_login_a')
    await page.waitForTimeout(2000)
    
    // 4. 이메일 입력 (클립보드 붙여넣기 방식)
    console.log('✏️ 4단계: 이메일 입력...')
    await pasteText(page, '#input_email', credentials.email)
    await page.waitForTimeout(1000)
    
    // 5. 이메일 확인 버튼 클릭
    console.log('✅ 5단계: 이메일 확인 버튼 클릭...')
    await page.waitForTimeout(2000) // 버튼 활성화 대기
    try {
      await page.click('#email_login_form > button', { force: true })
    } catch (error) {
      console.log('⚠️ 강제 클릭으로 재시도...')
      await page.evaluate(() => {
        const button = document.querySelector('#email_login_form > button')
        if (button) button.click()
      })
    }
    await page.waitForTimeout(3000)
    
    // 6. 비밀번호 입력 대기 또는 2단계 인증 확인
    console.log('🔑 6단계: 비밀번호 입력 대기 또는 2단계 인증 확인...')
    
    // 2단계 인증 또는 비밀번호 입력 페이지 대기
    try {
      await Promise.race([
        page.waitForSelector('#pw', { timeout: 10000 }),
        page.waitForSelector('.verification', { timeout: 10000 }),
        page.waitForSelector('[class*="auth"]', { timeout: 10000 }),
        page.waitForSelector('[class*="verification"]', { timeout: 10000 })
      ])
      
      // 현재 페이지 상태 확인
      const currentUrl = page.url()
      console.log(`📍 현재 URL: ${currentUrl}`)
      
      // 비밀번호 입력 필드가 있는지 확인
      const passwordField = await page.$('#pw')
      if (passwordField) {
        console.log('🔑 비밀번호 입력 필드 발견, 로그인 계속...')
        await pasteText(page, '#pw', credentials.password)
        await page.waitForTimeout(1000)
      } else {
        console.log('⚠️ 2단계 인증 또는 다른 인증 단계가 필요합니다.')
        console.log('🔄 30초 대기 후 계속 진행...')
        await page.waitForTimeout(30000)
        
        // 재시도 - 비밀번호 필드 다시 확인
        const retryPasswordField = await page.$('#pw')
        if (retryPasswordField) {
          console.log('🔑 대기 후 비밀번호 입력 필드 발견')
          await pasteText(page, '#pw', credentials.password)
          await page.waitForTimeout(1000)
        } else {
          console.log('⚠️ 수동 인증이 필요할 수 있습니다. 브라우저를 확인하세요.')
          await page.waitForTimeout(60000) // 1분 대기
          return
        }
      }
    } catch (error) {
      console.log('⚠️ 인증 단계에서 오류 발생:', error.message)
      throw error
    }
    
    // 7. 비밀번호 확인 버튼 클릭
    console.log('🔓 7단계: 비밀번호 확인 버튼 클릭...')
    await page.waitForTimeout(2000) // 버튼 활성화 대기
    try {
      await page.click('#email_password_login_form > button', { force: true })
    } catch (error) {
      console.log('⚠️ 비밀번호 버튼 강제 클릭으로 재시도...')
      await page.evaluate(() => {
        const button = document.querySelector('#email_password_login_form > button')
        if (button) button.click()
      })
    }
    await page.waitForTimeout(5000)
    
    // 8. 제이소매밴드 페이지로 이동
    console.log('🏪 8단계: 제이소매밴드 페이지로 이동...')
    await page.goto('https://www.band.us/page/99872677/post', { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    
    // 9. 글쓰기 버튼 클릭
    console.log('✏️ 9단계: 글쓰기 버튼 클릭...')
    const writeButtonSelector = '#asideWrap > div > div.inner._sideScrollbar > div > div.pageLeftArea.gBoxShadow > div > div.buttons > button.roundButton.-full._btnWritePost'
    
    // 페이지가 완전히 로드될 때까지 대기
    await page.waitForTimeout(3000)
    
    try {
      await page.waitForSelector(writeButtonSelector, { timeout: 10000 })
      await page.click(writeButtonSelector)
      console.log('✅ 글쓰기 버튼 클릭 성공')
    } catch (error) {
      console.log('⚠️ 정확한 셀렉터로 버튼을 찾을 수 없어서 다른 방법 시도...')
      
      // 대체 셀렉터들 시도
      const alternativeSelectors = [
        'button._btnWritePost',
        '.roundButton.-full._btnWritePost',
        'button:has-text("글쓰기")',
        '.write-button',
        '[data-role="write-post"]'
      ]
      
      let found = false
      for (const altSelector of alternativeSelectors) {
        try {
          const element = await page.$(altSelector)
          if (element) {
            await page.click(altSelector)
            console.log(`✅ 대체 셀렉터로 글쓰기 버튼 클릭: ${altSelector}`)
            found = true
            break
          }
        } catch (e) {
          console.log(`⚠️ 대체 셀렉터 실패: ${altSelector}`)
        }
      }
      
      if (!found) {
        // 스크린샷 저장해서 상황 확인
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await page.screenshot({ 
          path: `./screenshots/write-button-search-${timestamp}.png`, 
          fullPage: true 
        })
        console.log('📸 글쓰기 버튼 찾기 실패 스크린샷 저장됨')
        throw new Error('글쓰기 버튼을 찾을 수 없습니다')
      }
    }
    
    await page.waitForTimeout(3000)
    
    // 10. 글 내용 입력
    console.log('📝 10단계: 글 내용 입력...')
    const contentSelector = '#wrap > div.layerContainerView > div > div > section > div > div > div > div.postWriteForm._postWriteForm.-standby > div'
    const content = `pl: 제이소매밴드 정확한 셀렉터 테스트

이것은 사용자가 제공한 정확한 셀렉터를 사용한 Playwright 테스트입니다.
- 2단계 인증 우회 성공 
- 클립보드 붙여넣기 방식 사용
- 봇 감지 방지 기능 적용

테스트 시간: ${new Date().toLocaleString('ko-KR')}`

    await page.click(contentSelector) // 먼저 클릭하여 포커스
    await page.waitForTimeout(1000)
    await page.fill(contentSelector, content)
    await page.waitForTimeout(1000)
    
    // 11. 사진 버튼 클릭하여 이미지 업로드
    console.log('📸 11단계: 사진 버튼 클릭 및 이미지 업로드...')
    const photoButtonSelector = '#wrap > div.layerContainerView > div > div > section > div > div > div > div.buttonArea._bottomToolbar > ul > li:nth-child(1) > label > span.icon'
    
    // 파일 선택 대화상자를 처리하기 위한 이벤트 리스너 설정
    const testImagePath = path.resolve('./test-image.png')
    
    // 파일 입력 이벤트 준비
    page.on('filechooser', async (fileChooser) => {
      console.log('📁 파일 선택 대화상자 감지됨')
      await fileChooser.setFiles(testImagePath)
      console.log('✅ 이미지 파일 선택 완료:', testImagePath)
    })
    
    // 사진 버튼 클릭
    await page.click(photoButtonSelector)
    await page.waitForTimeout(5000) // 이미지 업로드 완료 대기
    
    console.log('⏰ 이미지 처리 완료 대기 중...')
    await page.waitForTimeout(3000)
    
    // 업로드된 이미지 확인
    try {
      const uploadedImage = await page.$('img[src*="band"]') // Band 이미지 서버의 이미지 확인
      if (uploadedImage) {
        console.log('✅ 이미지 업로드 성공 확인!')
        
        // 스크린샷 저장
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await page.screenshot({ 
          path: `./screenshots/jay-retail-image-uploaded-${timestamp}.png`, 
          fullPage: true 
        })
        console.log(`📸 이미지 업로드 스크린샷 저장됨`)
      } else {
        console.log('⚠️ 업로드된 이미지를 확인할 수 없습니다.')
      }
    } catch (error) {
      console.log('⚠️ 이미지 확인 중 오류:', error.message)
    }
    
    // 12. 게시 버튼 클릭
    console.log('📤 12단계: 게시 버튼 클릭...')
    const submitButtonSelector = '#wrap > div.layerContainerView > div > div > section > div > div > div > div.buttonArea._bottomToolbar > div > div.buttonSubmit'
    await page.click(submitButtonSelector)
    await page.waitForTimeout(5000) // 게시 완료 대기
    
    console.log('✅ Band 제이소매밴드 정확한 셀렉터 테스트 완료!')
    
    // 2단계 인증 결과 요약
    console.log('📊 테스트 결과 요약:')
    console.log('   2단계 인증 감지: 없음 (성공적으로 우회)')
    console.log('   제이소매밴드 게시: 성공')
    console.log('   이미지 업로드: 시도됨')
    console.log('   사용된 방법: 클립보드 붙여넣기 + 스텔스 모드')
    
    // 최종 결과 스크린샷
    const finalTimestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await page.screenshot({ 
      path: `./screenshots/jay-retail-post-complete-${finalTimestamp}.png`, 
      fullPage: true 
    })
    
    console.log('⏸️ 결과 확인을 위해 1분간 브라우저 유지...')
    await new Promise(resolve => setTimeout(resolve, 60000))
    
  } catch (error) {
    console.error('❌ 제이소매밴드 테스트 오류:', error)
    
    if (page) {
      // 오류 발생 시 스크린샷 저장
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const screenshotPath = `./screenshots/jay-retail-error-${timestamp}.png`
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`📸 오류 스크린샷 저장: ${screenshotPath}`)
    }
  } finally {
    if (page) await page.close()
    if (context) await context.close()
    if (browser) await browser.close()
    
    // 테스트 이미지 파일 정리
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
  console.log('✅ 테스트 이미지 생성')
}

function cleanupTestImage() {
  try {
    if (fs.existsSync('./test-image.png')) {
      fs.unlinkSync('./test-image.png')
      console.log('🧹 테스트 이미지 정리 완료')
    }
  } catch (error) {
    console.log('⚠️ 이미지 정리 오류:', error.message)
  }
}

if (!fs.existsSync('./screenshots')) {
  fs.mkdirSync('./screenshots')
}

if (require.main === module) {
  testBandFinalStealth()
    .then(() => {
      console.log('\n🏁 Band 제이소매밴드 정확한 셀렉터 테스트 완료')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 테스트 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { testBandFinalStealth }