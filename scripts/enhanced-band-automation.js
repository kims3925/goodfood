// 완전한 Band 자동화: 세션 재사용 + 2차 인증 우회 + 글 작성 + 이미지 업로드
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

class EnhancedBandAutomation {
  constructor() {
    this.credentialsPath = './band-credentials.json'
    this.sessionPath = './band-session.json'
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

  // 테스트 이미지 생성
  async createTestImage() {
    try {
      console.log('🖼️ 테스트 이미지 생성 중...')
      
      // 간단한 PNG 이미지 데이터 (100x100 파란 사각형)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64,
        0x08, 0x02, 0x00, 0x00, 0x00, 0xFF, 0x80, 0x02, 0x03, 0x00, 0x00, 0x00,
        0x09, 0x70, 0x48, 0x59, 0x73, 0x00, 0x00, 0x0E, 0xC3, 0x00, 0x00, 0x0E,
        0xC3, 0x01, 0xC7, 0x6F, 0xA8, 0x64, 0x00, 0x00, 0x00, 0x15, 0x49, 0x44,
        0x41, 0x54, 0x68, 0x81, 0xED, 0xC1, 0x01, 0x0D, 0x00, 0x00, 0x00, 0xC2,
        0xA0, 0xF7, 0x4F, 0x6D, 0x0E, 0x37, 0xA0, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0xBE, 0x0D, 0x21, 0x00, 0x00, 0x01, 0x9A, 0x60, 0x8D,
        0xB3, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ])
      
      fs.writeFileSync('./test-post-image.png', pngData)
      console.log('✅ 테스트 이미지 생성 완료: test-post-image.png')
      
    } catch (error) {
      console.error('❌ 테스트 이미지 생성 오류:', error)
      throw error
    }
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

  // 제이소매밴드에 글 작성
  async writePostToJayRetailBand() {
    console.log('📝 제이소매밴드 글쓰기 시작...')
    
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
      
      // 글 내용 작성
      console.log('📝 글 내용 작성...')
      const testContent = `pl: 자동화 테스트 게시글입니다.

🤖 이것은 2차 인증을 우회한 Playwright 자동화 테스트입니다.
📅 작성시간: ${new Date().toLocaleString('ko-KR')}
🎯 이미지 업로드 테스트 포함

#자동화테스트 #밴드자동화 #playwright`

      // 텍스트 입력 필드 찾기 및 입력
      const textSelectors = [
        'textarea[placeholder*="글 내용"]',
        'textarea[name="content"]',
        '.editor textarea',
        'div[contenteditable="true"]',
        '#content'
      ]

      let textInputSuccess = false
      for (const selector of textSelectors) {
        try {
          const element = await this.page.$(selector)
          if (element) {
            console.log(`✅ 텍스트 입력 필드 발견: ${selector}`)
            await this.page.fill(selector, testContent)
            textInputSuccess = true
            break
          }
        } catch (error) {
          continue
        }
      }

      if (!textInputSuccess) {
        console.log('⚠️ 텍스트 입력 필드를 찾을 수 없습니다.')
        return false
      }

      console.log('✅ 글 내용 입력 완료!')
      
      // 이미지 업로드
      console.log('🖼️ 이미지 업로드 시작...')
      const imageUploadSuccess = await this.uploadImage()
      
      if (imageUploadSuccess) {
        console.log('✅ 이미지 업로드 완료!')
        
        // 게시 버튼 클릭
        console.log('📤 게시 버튼 클릭...')
        await this.page.waitForTimeout(2000)
        
        const submitSelectors = [
          'button[type="submit"]',
          '.submit-button',
          'button:has-text("게시")',
          'button:has-text("등록")',
          '#btnSubmit',
          '.post-submit'
        ]

        let publishSuccess = false
        for (const selector of submitSelectors) {
          try {
            const element = await this.page.$(selector)
            if (element && await element.isVisible()) {
              console.log(`✅ 게시 버튼 발견: ${selector}`)
              await this.page.click(selector)
              publishSuccess = true
              break
            }
          } catch (error) {
            continue
          }
        }

        if (publishSuccess) {
          await this.page.waitForTimeout(5000)
          console.log('🎉 게시 완료!')
          return true
        } else {
          console.log('❌ 게시 버튼을 찾을 수 없습니다.')
          return false
        }
      } else {
        console.log('❌ 이미지 업로드 실패')
        return false
      }
      
    } catch (error) {
      console.log('⚠️ 글쓰기 버튼을 찾을 수 없습니다.')
      return false
    }
  }

  // 이미지 업로드
  async uploadImage() {
    try {
      console.log('📎 이미지 업로드 버튼 찾기...')
      
      const uploadSelectors = [
        'input[type="file"]',
        '.file-upload input',
        '[data-role="file-input"]',
        '.image-upload input',
        '#fileUpload'
      ]

      for (const selector of uploadSelectors) {
        try {
          const fileInput = await this.page.$(selector)
          if (fileInput) {
            console.log(`✅ 파일 업로드 입력 발견: ${selector}`)
            await fileInput.setInputFiles('./test-post-image.png')
            await this.page.waitForTimeout(3000) // 업로드 처리 대기
            console.log('✅ 이미지 파일 업로드 완료!')
            return true
          }
        } catch (error) {
          continue
        }
      }

      console.log('⚠️ 파일 업로드 입력을 찾을 수 없습니다.')
      return false
      
    } catch (error) {
      console.log('❌ 이미지 업로드 오류:', error.message)
      return false
    }
  }

  // 전체 자동화 프로세스 실행
  async run() {
    try {
      console.log('🚀 향상된 Band 자동화 시스템 시작!')
      console.log('🎯 세션 재사용 + 2차 인증 우회 + 글 작성 + 이미지 업로드\n')
      
      // 스크린샷 디렉토리 생성
      if (!fs.existsSync(this.screenshotDir)) {
        fs.mkdirSync(this.screenshotDir)
      }

      // 인증 정보 로드
      const credentials = this.loadCredentials()
      console.log(`📧 사용자: ${credentials.email}`)

      // 테스트 이미지 생성
      await this.createTestImage()

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

      // 3단계: 실제 작업 수행 (글 작성 + 이미지 업로드)
      const postSuccess = await this.writePostToJayRetailBand()
      
      if (postSuccess) {
        console.log('🎉 전체 자동화 프로세스 성공!')
        
        // 성공 스크린샷
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await this.page.screenshot({ 
          path: `${this.screenshotDir}/automation-success-${timestamp}.png`, 
          fullPage: true 
        })

        return { success: true, method: '향상된 하이브리드 접근법' }
      } else {
        throw new Error('글 작성 단계에서 실패했습니다.')
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
      console.log('\n⏸️ 결과 확인을 위해 2분간 브라우저 유지...')
      await new Promise(resolve => setTimeout(resolve, 120000))
      await this.cleanup()
    }
  }

  // 리소스 정리
  async cleanup() {
    console.log('🧹 리소스 정리 중...')
    
    if (this.page) await this.page.close()
    if (this.context) await this.context.close()
    if (this.browser) await this.browser.close()
    
    // 테스트 이미지 정리
    if (fs.existsSync('./test-post-image.png')) {
      fs.unlinkSync('./test-post-image.png')
      console.log('🧹 테스트 이미지 정리 완료')
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  const automation = new EnhancedBandAutomation()
  
  automation.run()
    .then((result) => {
      console.log('\n📊 최종 결과:', result)
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error('\n💥 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = EnhancedBandAutomation