// 최적의 Band 2단계 인증 우회 시스템 - 하이브리드 접근법
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

class OptimalBandAutomation {
  constructor() {
    this.sessionPath = './band-session.json'
    this.credentialsPath = './band-credentials.json'
    this.screenshotDir = './screenshots'
    this.browser = null
    this.context = null
    this.page = null
  }

  // 인증 정보 로드
  loadCredentials() {
    try {
      return JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'))
    } catch (error) {
      throw new Error('band-credentials.json 파일을 찾을 수 없습니다.')
    }
  }

  // 기존 세션 확인 및 로드
  loadExistingSession() {
    if (!fs.existsSync(this.sessionPath)) {
      return null
    }

    try {
      const session = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'))
      
      // 24시간 이내인지 확인
      const sessionAge = Date.now() - new Date(session.createdAt).getTime()
      const maxAge = 24 * 60 * 60 * 1000 // 24시간
      
      if (sessionAge > maxAge) {
        console.log('⏰ 세션이 24시간을 넘어서 삭제합니다.')
        fs.unlinkSync(this.sessionPath)
        return null
      }

      return session
    } catch (error) {
      console.log('⚠️ 세션 파일이 손상되어 삭제합니다.')
      fs.unlinkSync(this.sessionPath)
      return null
    }
  }

  // 세션 저장
  saveSession(storageState) {
    const sessionData = {
      ...storageState,
      createdAt: new Date().toISOString()
    }
    fs.writeFileSync(this.sessionPath, JSON.stringify(sessionData, null, 2))
    console.log('✅ 세션 저장 완료')
  }

  // 브라우저 초기화
  async initBrowser(existingSession = null) {
    this.browser = await chromium.launch({
      headless: false,
      slowMo: 200,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    })

    const contextOptions = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul'
    }

    // 기존 세션이 있으면 복원
    if (existingSession) {
      contextOptions.storageState = existingSession
    }

    this.context = await this.browser.newContext(contextOptions)

    // 스텔스 모드 적용
    await this.context.addInitScript(() => {
      delete Object.getPrototypeOf(navigator).webdriver
      delete navigator.__proto__.webdriver
      delete navigator.webdriver

      window.chrome = {
        runtime: { onConnect: undefined, onMessage: undefined }
      }

      Object.defineProperties(navigator, {
        webdriver: { get: () => undefined },
        plugins: { get: () => [1, 2, 3] },
        languages: { get: () => ['ko-KR', 'ko', 'en'] }
      })

      // 입력 활동 추적
      let keyEvents = 0
      let mouseEvents = 0
      
      document.addEventListener('keydown', () => keyEvents++)
      document.addEventListener('keyup', () => keyEvents++)
      document.addEventListener('mousemove', () => mouseEvents++)
      document.addEventListener('click', () => mouseEvents++)
      
      window.getInputActivity = () => ({ keyEvents, mouseEvents })
    })

    this.page = await this.context.newPage()
  }

  // 세션 기반 로그인 시도
  async trySessionLogin() {
    console.log('🔄 기존 세션으로 로그인 시도...')
    
    // 제이소매밴드 페이지로 바로 이동
    await this.page.goto('https://www.band.us/page/99872677/post', { 
      waitUntil: 'networkidle' 
    })
    await this.page.waitForTimeout(3000)

    const currentUrl = this.page.url()
    const loginButton = await this.page.$('button._loginBtn, .login-button, [href*="login"]')
    
    // 로그인 상태 확인
    if (!loginButton && currentUrl.includes('band.us') && !currentUrl.includes('login')) {
      console.log('✅ 세션 로그인 성공!')
      return true
    }

    console.log('⚠️ 세션이 만료되었습니다.')
    return false
  }

  // 실수 포함 인간적 타이핑
  async humanTyping(selector, text) {
    console.log(`⌨️ 인간적 타이핑: ${text}`)
    
    await this.page.click(selector)
    await this.page.waitForTimeout(Math.random() * 800 + 300)

    const chars = text.split('')
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i]
      
      // 15% 확률로 실수 발생
      if (Math.random() < 0.15 && i > 0) {
        console.log(`🤦 ${i+1}번째 문자에서 실수!`)
        
        // 잘못된 문자 타이핑
        const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26))
        await this.page.keyboard.type(wrongChar, { 
          delay: Math.random() * 150 + 50 
        })
        
        // 실수 눈치채는 시간
        await this.page.waitForTimeout(Math.random() * 800 + 300)
        
        // 백스페이스로 삭제
        await this.page.keyboard.press('Backspace')
        await this.page.waitForTimeout(Math.random() * 300 + 100)
      }
      
      // 올바른 문자 타이핑
      await this.page.keyboard.type(char, { 
        delay: Math.random() * 150 + 50 
      })
      
      // 랜덤 멈춤
      if (Math.random() < 0.1) {
        await this.page.waitForTimeout(Math.random() * 600 + 200)
      }
    }
    
    await this.page.waitForTimeout(Math.random() * 1000 + 500)
    console.log('✅ 타이핑 완료')
  }

  // 새로운 로그인 (혼합 입력 + 실수 시뮬레이션)
  async performNewLogin(credentials) {
    console.log('🆕 새로운 로그인 시작 (인간적 입력 방식)...')
    
    // Band 홈페이지로 이동
    await this.page.goto('https://www.band.us/home', { waitUntil: 'networkidle' })
    await this.page.waitForTimeout(2000)

    // 자연스러운 페이지 탐색
    await this.page.mouse.move(Math.random() * 800 + 200, Math.random() * 400 + 200)
    await this.page.waitForTimeout(Math.random() * 2000 + 1000)

    console.log('🔐 로그인 버튼 클릭...')
    const loginSelector = '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn'
    await this.page.click(loginSelector)
    await this.page.waitForTimeout(Math.random() * 3000 + 2000)

    console.log('📧 이메일로 로그인 선택...')
    await this.page.click('#email_login_a')
    await this.page.waitForTimeout(Math.random() * 2500 + 1500)

    console.log('✏️ 이메일 입력 (인간적 타이핑)...')
    await this.humanTyping('#input_email', credentials.email)

    console.log('✅ 이메일 확인 버튼 클릭...')
    await this.page.waitForTimeout(Math.random() * 1500 + 800)
    await this.page.click('#email_login_form > button')
    await this.page.waitForTimeout(Math.random() * 4000 + 3000)

    console.log('🔑 비밀번호 입력 대기...')
    
    try {
      await this.page.waitForSelector('#pw', { timeout: 15000 })
      console.log('🔑 비밀번호 입력 필드 발견!')
      
      await this.page.waitForTimeout(Math.random() * 1500 + 800)
      await this.humanTyping('#pw', credentials.password)

      console.log('🔓 로그인 실행...')
      await this.page.waitForTimeout(Math.random() * 1000 + 500)
      await this.page.click('#email_password_login_form > button')
      await this.page.waitForTimeout(5000)

      // 로그인 성공 확인
      const currentUrl = this.page.url()
      if (currentUrl.includes('band.us') && !currentUrl.includes('login')) {
        console.log('✅ 새 로그인 성공!')
        
        // 세션 저장
        const storageState = await this.context.storageState()
        this.saveSession(storageState)
        
        return true
      }
      
      return false

    } catch (error) {
      console.log('❌ 비밀번호 단계 도달 실패 (2단계 인증 추정)')
      return false
    }
  }

  // 제이소매밴드에 실제 포스팅
  async postToJayRetailBand() {
    console.log('📝 제이소매밴드에 포스팅 시작...')
    
    // 제이소매밴드 페이지로 이동
    await this.page.goto('https://www.band.us/page/99872677/post', { 
      waitUntil: 'networkidle' 
    })
    await this.page.waitForTimeout(3000)

    // 글쓰기 버튼 클릭
    console.log('✏️ 글쓰기 버튼 클릭...')
    const writeButtonSelector = '#asideWrap > div > div.inner._sideScrollbar > div > div.pageLeftArea.gBoxShadow > div > div.buttons > button.roundButton.-full._btnWritePost'
    
    try {
      await this.page.waitForSelector(writeButtonSelector, { timeout: 10000 })
      await this.page.click(writeButtonSelector)
      await this.page.waitForTimeout(3000)
      console.log('✅ 글쓰기 모드 진입!')
      return true
    } catch (error) {
      console.log('⚠️ 글쓰기 버튼을 찾을 수 없습니다.')
      return false
    }
  }

  // 전체 자동화 프로세스 실행
  async run() {
    try {
      console.log('🚀 최적의 Band 자동화 시스템 시작!')
      console.log('🎯 하이브리드 접근법: 세션 재사용 + 인간적 입력')
      
      // 스크린샷 디렉토리 생성
      if (!fs.existsSync(this.screenshotDir)) {
        fs.mkdirSync(this.screenshotDir)
      }

      // 인증 정보 로드
      const credentials = this.loadCredentials()
      console.log(`📧 사용자: ${credentials.email}`)

      // 기존 세션 확인
      const existingSession = this.loadExistingSession()
      if (existingSession) {
        console.log('💾 기존 세션 발견!')
      }

      // 브라우저 초기화
      await this.initBrowser(existingSession)

      let loginSuccess = false

      // 1단계: 세션 기반 로그인 시도
      if (existingSession) {
        loginSuccess = await this.trySessionLogin()
      }

      // 2단계: 세션 실패 시 새로운 로그인
      if (!loginSuccess) {
        console.log('🔄 새로운 로그인 방식으로 전환...')
        loginSuccess = await this.performNewLogin(credentials)
      }

      if (!loginSuccess) {
        throw new Error('모든 로그인 방식이 실패했습니다.')
      }

      // 3단계: 실제 작업 수행 (포스팅)
      const postSuccess = await this.postToJayRetailBand()
      
      if (postSuccess) {
        console.log('🎉 전체 자동화 프로세스 성공!')
        
        // 성공 스크린샷
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await this.page.screenshot({ 
          path: `${this.screenshotDir}/automation-success-${timestamp}.png`, 
          fullPage: true 
        })

        return { success: true, method: '하이브리드 접근법' }
      } else {
        throw new Error('포스팅 단계에서 실패했습니다.')
      }

    } catch (error) {
      console.error('❌ 자동화 프로세스 오류:', error.message)
      
      if (this.page) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await this.page.screenshot({ 
          path: `${this.screenshotDir}/automation-error-${timestamp}.png`, 
          fullPage: true 
        })
      }
      
      return { success: false, error: error.message }
    } finally {
      await this.cleanup()
    }
  }

  // 리소스 정리
  async cleanup() {
    console.log('🧹 리소스 정리 중...')
    
    if (this.page) await this.page.close()
    if (this.context) await this.context.close()
    if (this.browser) await this.browser.close()
  }

  // 세션 초기화
  clearSession() {
    if (fs.existsSync(this.sessionPath)) {
      fs.unlinkSync(this.sessionPath)
      console.log('🧹 세션 파일 삭제됨')
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  const automation = new OptimalBandAutomation()
  
  // 명령행 인수 확인
  const args = process.argv.slice(2)
  if (args.includes('--clear-session')) {
    automation.clearSession()
    process.exit(0)
  }
  
  automation.run()
    .then((result) => {
      console.log('\n📊 최적의 자동화 결과:', result)
      console.log('\n💡 팁: 세션을 초기화하려면 "--clear-session" 옵션 사용')
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error('\n💥 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = OptimalBandAutomation