// 가설 2: 자연스러운 마우스 패턴 + 페이지 탐색으로 2단계 인증 우회
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

async function testHypothesis2NaturalBehavior() {
  let browser = null
  let context = null
  let page = null
  
  try {
    console.log('🎭 가설 2: 자연스러운 마우스 패턴 + 페이지 탐색 테스트 시작...')
    console.log('🎯 실제 사용자의 브라우징 패턴을 완벽하게 시뮬레이션')
    
    // 인증 정보 로드
    const credentials = JSON.parse(fs.readFileSync('./band-credentials.json', 'utf8'))
    console.log(`📧 테스트 이메일: ${credentials.email}`)
    
    // 자연스러운 마우스 움직임 함수
    async function naturalMouseMove(page, x, y) {
      const currentMouse = await page.evaluate(() => ({ x: window.mouseX || 0, y: window.mouseY || 0 }))
      const steps = Math.floor(Math.random() * 20) + 10
      
      // 곡선 경로로 마우스 이동
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps
        const currentX = currentMouse.x + (x - currentMouse.x) * progress + Math.sin(progress * Math.PI) * (Math.random() - 0.5) * 20
        const currentY = currentMouse.y + (y - currentMouse.y) * progress + Math.cos(progress * Math.PI) * (Math.random() - 0.5) * 20
        
        await page.mouse.move(currentX, currentY)
        await page.waitForTimeout(Math.random() * 50 + 10)
      }
      
      // 마우스 위치 저장
      await page.evaluate((x, y) => {
        window.mouseX = x
        window.mouseY = y
      }, x, y)
    }
    
    // 페이지 탐색 시뮬레이션
    async function explorePageNaturally(page) {
      console.log('👀 페이지를 자연스럽게 탐색하는 중...')
      
      // 스크롤 다운하며 페이지 훑어보기
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, Math.random() * 300 + 200)
        await page.waitForTimeout(Math.random() * 2000 + 1000)
        
        // 랜덤한 위치에 마우스 이동
        const x = Math.random() * 1200 + 100
        const y = Math.random() * 600 + 100
        await naturalMouseMove(page, x, y)
        await page.waitForTimeout(Math.random() * 1500 + 500)
      }
      
      // 다시 위로 스크롤
      await page.mouse.wheel(0, -800)
      await page.waitForTimeout(Math.random() * 1000 + 500)
    }
    
    // 읽기 시뮬레이션 (텍스트 위에서 마우스 멈추기)
    async function simulateReading(page, selector) {
      try {
        const element = await page.$(selector)
        if (element) {
          const box = await element.boundingBox()
          if (box) {
            await naturalMouseMove(page, box.x + box.width / 2, box.y + box.height / 2)
            await page.waitForTimeout(Math.random() * 3000 + 2000) // 읽는 시간
          }
        }
      } catch (e) {
        // 요소가 없어도 괜찮음
      }
    }
    
    // 브라우저 실행 (자연스러운 설정)
    browser = await chromium.launch({
      headless: false,
      slowMo: 100,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    })
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      geolocation: { latitude: 37.5665, longitude: 126.9780 }, // 서울
      permissions: ['geolocation']
    })
    
    // 고급 봇 감지 우회
    await context.addInitScript(() => {
      // 마우스 추적 변수
      window.mouseX = Math.random() * 1920
      window.mouseY = Math.random() * 1080
      
      // navigator 속성 완전 정규화
      delete Object.getPrototypeOf(navigator).webdriver
      delete navigator.__proto__.webdriver
      delete navigator.webdriver
      
      // Chrome 환경 완벽 시뮬레이션
      window.chrome = {
        runtime: {
          onConnect: undefined,
          onMessage: undefined,
          connect: function() { return {} },
          sendMessage: function() {}
        },
        app: { isInstalled: false },
        webstore: {
          onInstallStageChanged: {},
          onDownloadProgress: {}
        }
      }
      
      // 플러그인 완전 시뮬레이션
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
        deviceMemory: { get: () => 8 }
      })
      
      // 이벤트 리스너로 사용자 활동 시뮬레이션
      document.addEventListener('mousemove', (e) => {
        window.mouseX = e.clientX
        window.mouseY = e.clientY
      })
    })
    
    page = await context.newPage()
    
    // 1. Band 홈페이지 접속
    console.log('🌐 1단계: Band 홈페이지 자연스럽게 방문...')
    await page.goto('https://www.band.us/home', { waitUntil: 'networkidle' })
    
    // 페이지가 로드되면 자연스럽게 탐색
    await explorePageNaturally(page)
    
    // Band 로고나 제목 읽기
    await simulateReading(page, 'h1, .logo, .title')
    
    // 2. 로그인 버튼을 찾기 위해 탐색
    console.log('🔍 로그인 버튼을 자연스럽게 찾는 중...')
    const loginSelector = '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn'
    
    // 로그인 버튼 근처로 마우스 이동
    const loginButton = await page.$(loginSelector)
    if (loginButton) {
      const box = await loginButton.boundingBox()
      if (box) {
        // 버튼 주변을 서성이기
        await naturalMouseMove(page, box.x - 50, box.y)
        await page.waitForTimeout(Math.random() * 2000 + 1000)
        await naturalMouseMove(page, box.x + box.width + 50, box.y)
        await page.waitForTimeout(Math.random() * 1500 + 500)
        
        // 드디어 버튼 위로
        await naturalMouseMove(page, box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(Math.random() * 2000 + 1000)
      }
    }
    
    console.log('🔐 2단계: 로그인 버튼 클릭...')
    await page.click(loginSelector)
    await page.waitForTimeout(Math.random() * 3000 + 2000)
    
    // 3. 이메일 로그인 옵션 탐색
    console.log('📧 로그인 옵션들을 살펴보는 중...')
    
    // 다른 로그인 옵션들 구경하기
    const otherButtons = await page.$$('button, a')
    if (otherButtons.length > 0) {
      const randomButton = otherButtons[Math.floor(Math.random() * Math.min(3, otherButtons.length))]
      try {
        const box = await randomButton.boundingBox()
        if (box) {
          await naturalMouseMove(page, box.x + box.width / 2, box.y + box.height / 2)
          await page.waitForTimeout(Math.random() * 1000 + 500)
        }
      } catch (e) {
        // 무시
      }
    }
    
    console.log('📧 3단계: 이메일로 로그인 선택...')
    await naturalMouseMove(page, 0, 0) // 임의 위치로 이동
    await page.waitForTimeout(Math.random() * 1000 + 500)
    
    const emailLoginButton = await page.$('#email_login_a')
    if (emailLoginButton) {
      const box = await emailLoginButton.boundingBox()
      if (box) {
        await naturalMouseMove(page, box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(Math.random() * 1500 + 1000)
      }
    }
    
    await page.click('#email_login_a')
    await page.waitForTimeout(Math.random() * 3000 + 2000)
    
    // 4. 이메일 입력 (매우 자연스럽게)
    console.log('✏️ 이메일 입력 필드 찾는 중...')
    
    const emailField = await page.$('#input_email')
    if (emailField) {
      const box = await emailField.boundingBox()
      if (box) {
        // 입력 필드 주변 탐색
        await naturalMouseMove(page, box.x - 20, box.y)
        await page.waitForTimeout(Math.random() * 1000 + 500)
        await naturalMouseMove(page, box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(Math.random() * 1500 + 1000)
      }
    }
    
    console.log('📋 클립보드로 이메일 붙여넣기...')
    await page.click('#input_email')
    
    // 클립보드 준비
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
    
    await page.waitForTimeout(Math.random() * 1000 + 500)
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(Math.random() * 2000 + 1000)
    
    // 입력된 내용 확인하는 척
    await naturalMouseMove(page, 0, 0)
    await page.waitForTimeout(Math.random() * 1500 + 1000)
    
    // 5. 확인 버튼
    console.log('✅ 5단계: 이메일 확인 버튼 클릭...')
    await page.click('#email_login_form > button')
    await page.waitForTimeout(Math.random() * 4000 + 3000)
    
    // 6. 비밀번호 입력 대기
    console.log('🔑 비밀번호 입력 페이지 대기...')
    
    try {
      await page.waitForSelector('#pw', { timeout: 20000 })
      console.log('🔑 비밀번호 입력 필드 발견!')
      
      const passwordField = await page.$('#pw')
      if (passwordField) {
        const box = await passwordField.boundingBox()
        if (box) {
          await naturalMouseMove(page, box.x + box.width / 2, box.y + box.height / 2)
          await page.waitForTimeout(Math.random() * 2000 + 1000)
        }
      }
      
      await page.click('#pw')
      
      // 비밀번호 클립보드 입력
      console.log('🔐 클립보드로 비밀번호 입력...')
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
      
      await page.waitForTimeout(Math.random() * 1000 + 500)
      await page.keyboard.press('Control+v')
      await page.waitForTimeout(Math.random() * 2000 + 1500)
      
      // 7. 로그인 버튼
      console.log('🔓 7단계: 로그인 실행...')
      await page.click('#email_password_login_form > button')
      await page.waitForTimeout(Math.random() * 5000 + 5000)
      
      // 결과 확인
      const currentUrl = page.url()
      console.log(`📍 현재 URL: ${currentUrl}`)
      
      if (currentUrl.includes('band.us') && !currentUrl.includes('login')) {
        console.log('✅ 가설 2 성공: 자연스러운 행동으로 2단계 인증 우회!')
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await page.screenshot({ 
          path: `./screenshots/hypothesis-2-success-${timestamp}.png`, 
          fullPage: true 
        })
        
        return { success: true, method: '자연스러운 마우스 패턴 + 페이지 탐색' }
      } else {
        console.log('❌ 가설 2 실패')
        return { success: false, method: '자연스러운 마우스 패턴 + 페이지 탐색' }
      }
      
    } catch (error) {
      console.log('❌ 가설 2 실패: 비밀번호 단계 도달 실패 (2단계 인증 추정)')
      return { success: false, method: '자연스러운 마우스 패턴 + 페이지 탐색', error: '2단계 인증 추정' }
    }
    
  } catch (error) {
    console.error('❌ 가설 2 테스트 오류:', error.message)
    return { success: false, method: '자연스러운 마우스 패턴 + 페이지 탐색', error: error.message }
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
  testHypothesis2NaturalBehavior()
    .then((result) => {
      console.log('\n📊 가설 2 테스트 결과:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 가설 2 테스트 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { testHypothesis2NaturalBehavior }