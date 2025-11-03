// Band 개선된 스텔스 모드 - 버튼 활성화 대기 및 2단계 인증 확인
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

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

function humanDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function pasteText(page, selector, text) {
  await page.click(selector)
  await page.waitForTimeout(humanDelay(300, 800))
  
  // 기존 텍스트 클리어
  await page.keyboard.press('Control+a')
  await page.waitForTimeout(100)
  
  // 클립보드 방식으로 붙여넣기
  await page.evaluate((text) => {
    navigator.clipboard.writeText(text)
  }, text)
  
  await page.waitForTimeout(200)
  await page.keyboard.press('Control+v')
  await page.waitForTimeout(humanDelay(500, 1000))
}

async function smartClick(page, selector, options = {}) {
  console.log(`🖱️ 클릭 시도: ${selector}`)
  
  // 요소 대기 및 확인
  await page.waitForSelector(selector, { timeout: 15000 })
  const element = await page.$(selector)
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`)
  }
  
  // 요소가 보이고 활성화될 때까지 대기
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel)
      return el && el.offsetParent !== null && !el.disabled
    },
    selector,
    { timeout: 30000 }
  )
  
  // 스크롤하여 보이게 하기
  await element.scrollIntoViewIfNeeded()
  await page.waitForTimeout(humanDelay(500, 1000))
  
  // 자연스러운 마우스 움직임
  const box = await element.boundingBox()
  if (box) {
    const x = box.x + box.width / 2 + (Math.random() - 0.5) * 10
    const y = box.y + box.height / 2 + (Math.random() - 0.5) * 5
    
    await page.mouse.move(x, y, { steps: 8 })
    await page.waitForTimeout(humanDelay(200, 500))
    await page.mouse.click(x, y)
  } else {
    await page.click(selector, options)
  }
  
  await page.waitForTimeout(humanDelay(800, 1500))
  console.log(`✅ 클릭 완료: ${selector}`)
}

async function testBandImprovedStealth() {
  let browser = null
  let context = null
  let page = null
  
  try {
    console.log('🥷 Band 개선된 스텔스 모드 시작...')
    console.log('🔍 2단계 인증 발생 여부를 확인합니다.')
    
    const credentials = loadCredentials()
    console.log(`📧 사용할 이메일: ${credentials.email}`)
    
    await createTestImage()
    
    // 스텔스 브라우저 실행
    browser = await chromium.launch({
      headless: false,
      slowMo: 0,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--password-store=basic',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    })
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      permissions: ['geolocation', 'notifications', 'clipboard-read', 'clipboard-write'],
      geolocation: { latitude: 37.5665, longitude: 126.9780 },
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    })
    
    // 봇 감지 우회 스크립트
    await context.addInitScript(() => {
      delete Object.getPrototypeOf(navigator).webdriver
      delete navigator.webdriver
      
      Object.defineProperties(navigator, {
        webdriver: { get: () => undefined },
        plugins: { get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ]},
        languages: { get: () => ['ko-KR', 'ko', 'en-US'] },
        platform: { get: () => 'Win32' },
        hardwareConcurrency: { get: () => 8 }
      })
      
      if (!window.chrome) {
        window.chrome = { runtime: {} }
      }
      
      // 자동화 감지 변수 제거
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol
    })
    
    page = await context.newPage()
    
    console.log('🌐 1단계: Band 홈페이지 접속...')
    await page.goto('https://www.band.us/home', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    })
    
    await page.waitForTimeout(humanDelay(2000, 4000))
    
    console.log('🔐 2단계: 로그인 버튼 클릭...')
    const loginSelectors = [
      'button._loginBtn',
      '.button._loginBtn', 
      '#container button._loginBtn',
      'button:has-text("로그인")'
    ]
    
    let loginSuccess = false
    for (const selector of loginSelectors) {
      try {
        await smartClick(page, selector)
        loginSuccess = true
        break
      } catch (e) {
        console.log(`⚠️ ${selector} 시도 실패: ${e.message}`)
      }
    }
    
    if (!loginSuccess) {
      throw new Error('로그인 버튼을 찾을 수 없습니다.')
    }
    
    console.log('📧 3단계: 이메일 로그인 선택...')
    await smartClick(page, '#email_login_a')
    
    console.log('✏️ 4단계: 이메일 입력...')
    await pasteText(page, '#input_email', credentials.email)
    
    console.log('✅ 5단계: 이메일 확인 버튼 클릭 (활성화 대기)...')
    // 버튼이 활성화될 때까지 최대 30초 대기
    await page.waitForFunction(
      () => {
        const button = document.querySelector('#email_login_form > button')
        return button && !button.disabled
      },
      { timeout: 30000 }
    )
    
    await smartClick(page, '#email_login_form > button')
    
    console.log('🔑 6단계: 비밀번호 입력 대기...')
    await page.waitForSelector('#pw', { timeout: 20000 })
    await page.waitForTimeout(humanDelay(1000, 2000))
    
    await pasteText(page, '#pw', credentials.password)
    
    console.log('🔓 7단계: 비밀번호 확인 버튼 클릭...')
    await smartClick(page, '#email_password_login_form > button')
    
    console.log('⏰ 8단계: 로그인 처리 대기 (2단계 인증 확인)...')
    await page.waitForTimeout(5000)
    
    // 2단계 인증 감지
    const twoFactorSelectors = [
      'input[name="verification_code"]',
      '#sms_code',
      '#verification_code', 
      '[placeholder*="인증"]',
      '[placeholder*="코드"]',
      '.verification-code',
      '.two-factor'
    ]
    
    let twoFactorDetected = false
    let detectedSelector = ''
    
    for (const selector of twoFactorSelectors) {
      try {
        const element = await page.$(selector)
        if (element && await element.isVisible()) {
          twoFactorDetected = true
          detectedSelector = selector
          break
        }
      } catch (e) {
        // 계속 진행
      }
    }
    
    if (twoFactorDetected) {
      console.log('🔔 2단계 인증이 감지되었습니다!')
      console.log(`📱 감지된 선택자: ${detectedSelector}`)
      console.log('📞 휴대폰으로 받은 인증 코드를 입력해주세요.')
      console.log('⏰ 60초간 수동 입력을 기다립니다...')
      
      await page.screenshot({ 
        path: `./screenshots/two-factor-detected-${new Date().toISOString().replace(/[:.]/g, '-')}.png`, 
        fullPage: true 
      })
      
      // 60초 대기
      await page.waitForTimeout(60000)
      
      console.log('✅ 2단계 인증 처리 완료로 가정합니다.')
    } else {
      console.log('✅ 2단계 인증이 감지되지 않았습니다.')
    }
    
    // 로그인 성공 확인
    await page.waitForTimeout(3000)
    const currentUrl = page.url()
    console.log(`📍 현재 URL: ${currentUrl}`)
    
    if (currentUrl.includes('band.us') && !currentUrl.includes('login')) {
      console.log('✅ 로그인 성공으로 판단됩니다!')
      
      // 제이소매밴드로 이동
      console.log('🏪 9단계: 제이소매밴드로 이동...')
      await page.goto('https://www.band.us/page/99872677/post', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      })
      
      await page.waitForTimeout(humanDelay(3000, 5000))
      
      console.log('✏️ 10단계: 글쓰기 버튼 클릭...')
      const writeSelectors = [
        '#asideWrap button._btnWritePost',
        'button._btnWritePost',
        '.roundButton.-full._btnWritePost',
        'button:has-text("글쓰기")',
        '.write-post-btn'
      ]
      
      let writeSuccess = false
      for (const selector of writeSelectors) {
        try {
          await smartClick(page, selector)
          writeSuccess = true
          console.log(`✅ 글쓰기 버튼 클릭 성공: ${selector}`)
          break
        } catch (e) {
          console.log(`⚠️ 글쓰기 버튼 시도 실패: ${selector}`)
        }
      }
      
      if (writeSuccess) {
        console.log('📝 11단계: 글 내용 작성...')
        const content = `pl: 2차 스텔스 모드 테스트

개선된 Playwright 봇 감지 우회 시스템입니다.

개선사항:
• 버튼 활성화 상태 대기
• 2단계 인증 자동 감지
• 향상된 클릭 안정성
• 클립보드 방식 텍스트 입력

${twoFactorDetected ? '🔔 2단계 인증 감지됨' : '✅ 2단계 인증 미감지'}

테스트 시간: ${new Date().toLocaleString('ko-KR')}`

        const contentSelectors = [
          '#wrap div.postWriteForm._postWriteForm div[contenteditable="true"]',
          '.postWriteForm textarea',
          '[contenteditable="true"]',
          '.write-content'
        ]
        
        let contentSuccess = false
        for (const selector of contentSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 10000 })
            await pasteText(page, selector, content)
            contentSuccess = true
            console.log(`✅ 글 내용 입력 성공: ${selector}`)
            break
          } catch (e) {
            console.log(`⚠️ 글 내용 입력 시도 실패: ${selector}`)
          }
        }
        
        if (contentSuccess) {
          await page.waitForTimeout(humanDelay(2000, 3000))
          
          console.log('📸 12단계: 이미지 업로드 시도...')
          const photoSelectors = [
            '#wrap div.buttonArea ul li:nth-child(1) label span.icon',
            '.photo-upload-btn',
            '[data-type="photo"]',
            'input[type="file"]'
          ]
          
          const testImagePath = path.resolve('./test-image.png')
          
          // 파일 선택 이벤트 처리
          page.on('filechooser', async (fileChooser) => {
            await fileChooser.setFiles(testImagePath)
            console.log('✅ 이미지 파일 선택 완료')
          })
          
          let photoSuccess = false
          for (const selector of photoSelectors) {
            try {
              await smartClick(page, selector)
              photoSuccess = true
              console.log(`✅ 사진 버튼 클릭 성공: ${selector}`)
              break
            } catch (e) {
              console.log(`⚠️ 사진 버튼 시도 실패: ${selector}`)
            }
          }
          
          if (photoSuccess) {
            await page.waitForTimeout(humanDelay(5000, 8000))
            
            console.log('📤 13단계: 게시물 발행...')
            const submitSelectors = [
              '#wrap div.buttonArea div.buttonSubmit',
              '.submit-btn',
              'button:has-text("등록")',
              '.post-submit'
            ]
            
            for (const selector of submitSelectors) {
              try {
                await smartClick(page, selector)
                console.log(`✅ 게시 버튼 클릭 성공: ${selector}`)
                break
              } catch (e) {
                console.log(`⚠️ 게시 버튼 시도 실패: ${selector}`)
              }
            }
            
            await page.waitForTimeout(5000)
            console.log('🎉 게시물 업로드 완료!')
          }
        }
      }
    } else {
      console.log('⚠️ 로그인 상태가 불확실합니다.')
    }
    
    // 최종 스크린샷
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await page.screenshot({ 
      path: `./screenshots/improved-stealth-final-${timestamp}.png`, 
      fullPage: true 
    })
    
    console.log('📊 테스트 결과 요약:')
    console.log(`   2단계 인증 감지: ${twoFactorDetected ? '예' : '아니오'}`)
    if (twoFactorDetected) {
      console.log(`   감지된 선택자: ${detectedSelector}`)
    }
    
    // 결과 확인을 위해 3분간 브라우저 유지
    console.log('⏸️ 결과 확인을 위해 3분간 브라우저를 열어둡니다...')
    await page.waitForTimeout(180000)
    
  } catch (error) {
    console.error('❌ 개선된 스텔스 테스트 오류:', error)
    
    if (page) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      await page.screenshot({ 
        path: `./screenshots/improved-stealth-error-${timestamp}.png`, 
        fullPage: true 
      })
    }
  } finally {
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
    console.log('⚠️ 이미지 정리 오류:', error.message)
  }
}

if (!fs.existsSync('./screenshots')) {
  fs.mkdirSync('./screenshots')
}

if (require.main === module) {
  testBandImprovedStealth()
    .then(() => {
      console.log('\n🏁 개선된 스텔스 테스트 완료')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 테스트 오류:', error)
      process.exit(1)
    })
}

module.exports = { testBandImprovedStealth }