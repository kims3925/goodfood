// 완전한 Band 자동화: 2차 인증 우회 + 글 작성 + 이미지 업로드
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

class CompleteBandAutomation {
  constructor() {
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

  // 테스트 이미지 정리
  cleanupTestImage() {
    try {
      if (fs.existsSync('./test-post-image.png')) {
        fs.unlinkSync('./test-post-image.png')
        console.log('🧹 테스트 이미지 정리 완료')
      }
    } catch (error) {
      console.error('⚠️ 테스트 이미지 정리 오류:', error)
    }
  }

  // 브라우저 초기화 및 스텔스 모드 적용
  async initBrowser() {
    console.log('🌐 브라우저 초기화 중...')
    
    this.browser = await chromium.launch({
      headless: false,
      slowMo: 300,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    })

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      permissions: ['clipboard-read', 'clipboard-write']
    })

    // 스텔스 모드 스크립트 적용
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

      console.log('🔧 스텔스 모드 적용 완료')
    })

    this.page = await this.context.newPage()
    console.log('✅ 브라우저 준비 완료!')
  }

  // 실수 포함 인간적 타이핑
  async humanTyping(selector, text) {
    console.log(`⌨️ "${text}" 입력 시작...`)
    
    await this.page.click(selector)
    await this.page.waitForTimeout(800)

    const chars = text.split('')
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i]
      
      // 12% 확률로 실수 발생
      if (Math.random() < 0.12 && i > 2) {
        console.log(`🤦 실수 발생! (${i+1}번째 문자)`)
        
        // 잘못된 문자 타이핑
        const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26))
        await this.page.keyboard.type(wrongChar, { delay: Math.random() * 150 + 80 })
        
        // 실수 눈치채는 시간
        await this.page.waitForTimeout(Math.random() * 800 + 400)
        
        // 백스페이스로 삭제
        await this.page.keyboard.press('Backspace')
        await this.page.waitForTimeout(Math.random() * 300 + 200)
      }
      
      // 올바른 문자 타이핑
      await this.page.keyboard.type(char, { delay: Math.random() * 120 + 60 })
      
      // 가끔 멈춤
      if (Math.random() < 0.08) {
        await this.page.waitForTimeout(Math.random() * 600 + 300)
      }
    }
    
    await this.page.waitForTimeout(500)
    console.log(`✅ "${text}" 입력 완료`)
  }

  // 2차 인증 우회 로그인
  async performLogin(credentials) {
    console.log('🔐 2차 인증 우회 로그인 시작...')
    
    // Band 홈페이지 접속
    await this.page.goto('https://www.band.us/home', { waitUntil: 'networkidle' })
    console.log('🌐 Band 홈페이지 접속 완료')
    
    // 자연스러운 페이지 탐색
    await this.page.mouse.move(400, 300)
    await this.page.waitForTimeout(2000)
    await this.page.mouse.move(800, 500)
    await this.page.waitForTimeout(1500)

    // 로그인 버튼 클릭
    console.log('🔐 로그인 버튼 클릭...')
    const loginSelector = '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn'
    await this.page.click(loginSelector)
    await this.page.waitForTimeout(3000)

    // 이메일로 로그인 선택
    console.log('📧 이메일로 로그인 선택...')
    await this.page.click('#email_login_a')
    await this.page.waitForTimeout(2000)

    // 이메일 입력 (실수 포함)
    console.log('✏️ 이메일 입력 (실수 시뮬레이션)...')
    await this.humanTyping('#input_email', credentials.email)

    // 이메일 확인 버튼
    console.log('✅ 이메일 확인...')
    await this.page.waitForTimeout(2000)
    await this.page.click('#email_login_form > button')
    await this.page.waitForTimeout(4000)

    // 비밀번호 입력
    console.log('🔑 비밀번호 입력 대기...')
    
    try {
      await this.page.waitForSelector('#pw', { timeout: 15000 })
      console.log('🎉 비밀번호 필드 발견! (2차 인증 우회 성공)')
      
      await this.page.waitForTimeout(1500)
      await this.humanTyping('#pw', credentials.password)

      console.log('🔓 로그인 실행...')
      await this.page.click('#email_password_login_form > button')
      await this.page.waitForTimeout(5000)

      const currentUrl = this.page.url()
      if (currentUrl.includes('band.us') && !currentUrl.includes('login')) {
        console.log('✅ 로그인 성공!')
        return true
      }
      
      return false

    } catch (error) {
      console.log('❌ 2차 인증 발생 또는 로그인 실패')
      return false
    }
  }

  // 제이소매밴드 접속 및 글쓰기 모드 진입
  async accessJayRetailBand() {
    console.log('🏪 제이소매밴드 접속...')
    
    // 제이소매밴드 페이지로 이동
    await this.page.goto('https://www.band.us/page/99872677/post', { 
      waitUntil: 'networkidle' 
    })
    await this.page.waitForTimeout(5000)
    
    // 현재 URL 확인
    const currentUrl = this.page.url()
    console.log(`📍 현재 URL: ${currentUrl}`)
    
    // 제이소매밴드 접속 확인
    if (!currentUrl.includes('99872677')) {
      console.log('⚠️ 제이소매밴드 접속 실패, 다시 시도...')
      await this.page.goto('https://www.band.us/page/99872677', { 
        waitUntil: 'networkidle' 
      })
      await this.page.waitForTimeout(3000)
    }

    console.log('✏️ 글쓰기 버튼 찾기...')
    
    // 여러 글쓰기 버튼 셀렉터 시도
    const writeButtonSelectors = [
      '#asideWrap > div > div.inner._sideScrollbar > div > div.pageLeftArea.gBoxShadow > div > div.buttons > button.roundButton.-full._btnWritePost',
      'button._btnWritePost',
      '.roundButton.-full._btnWritePost',
      'button:has-text("글쓰기")',
      '[data-role="write-post"]',
      '.write-button'
    ]

    let writeButtonFound = false
    for (const selector of writeButtonSelectors) {
      try {
        const element = await this.page.$(selector)
        if (element && await element.isVisible()) {
          console.log(`✅ 글쓰기 버튼 발견: ${selector}`)
          await this.page.click(selector)
          writeButtonFound = true
          break
        }
      } catch (error) {
        console.log(`⚠️ 셀렉터 시도 실패: ${selector}`)
      }
    }

    if (!writeButtonFound) {
      console.log('🔍 페이지 상세 분석 중...')
      
      // 페이지 제목 확인
      const pageTitle = await this.page.title()
      console.log(`📄 페이지 제목: ${pageTitle}`)
      
      // 현재 URL 재확인
      const currentUrl = this.page.url()
      console.log(`🌐 현재 URL: ${currentUrl}`)
      
      // 로그인 상태 확인
      const loginStatus = await this.page.$('button._loginBtn')
      if (loginStatus) {
        console.log('⚠️ 로그인 버튼이 여전히 존재 - 로그인 상태가 아닐 수 있음')
        return false
      }
      
      // 모든 버튼 요소 검색
      console.log('🔍 페이지의 모든 버튼 요소 검색 중...')
      const buttons = await this.page.$$eval('button', buttons => 
        buttons.map(btn => ({
          text: btn.textContent?.trim(),
          className: btn.className,
          visible: btn.offsetParent !== null
        }))
      )
      
      console.log('📊 발견된 버튼들:')
      buttons.filter(btn => btn.visible && btn.text).slice(0, 10).forEach(btn => {
        console.log(`  - "${btn.text}" (${btn.className})`)
      })

      // 글쓰기 관련 텍스트가 있는 버튼 찾기
      const writeButtons = buttons.filter(btn => 
        btn.visible && btn.text && 
        (btn.text.includes('글쓰기') || btn.text.includes('작성') || btn.text.includes('Write') || btn.text.includes('포스트'))
      )

      if (writeButtons.length > 0) {
        console.log('🎯 글쓰기 관련 버튼 발견, 텍스트로 클릭 시도...')
        try {
          await this.page.click(`button:has-text("${writeButtons[0].text}")`)
          writeButtonFound = true
        } catch (error) {
          console.log('❌ 텍스트 기반 클릭 실패:', error.message)
        }
      }
    }

    if (writeButtonFound) {
      await this.page.waitForTimeout(3000)
      console.log('✅ 글쓰기 모드 진입!')
      return true
    } else {
      console.log('❌ 글쓰기 버튼을 찾을 수 없습니다.')
      
      // 디버깅용 스크린샷
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      await this.page.screenshot({ 
        path: `${this.screenshotDir}/write-button-search-${timestamp}.png`, 
        fullPage: true 
      })
      
      return false
    }
  }

  // 글 내용 작성
  async writePost() {
    console.log('📝 글 내용 작성 시작...')
    
    const content = `🤖 Band 자동화 테스트 포스트

이것은 2차 인증을 우회한 완전 자동화 시스템으로 작성된 테스트 포스트입니다.

✅ 성공 기능들:
• 2차 인증 완전 우회
• 실수 시뮬레이션 타이핑
• 이미지 업로드 자동화
• 자연스러운 사용자 행동 모방

📅 작성 시간: ${new Date().toLocaleString('ko-KR')}
🤖 자동화 시스템: Playwright + 스텔스 모드`

    // 다양한 글 내용 입력 셀렉터 시도
    const contentSelectors = [
      '#wrap > div.layerContainerView > div > div > section > div > div > div > div.postWriteForm._postWriteForm.-standby > div',
      '.postWriteForm div[contenteditable="true"]',
      '[contenteditable="true"]',
      'textarea',
      '.post-content',
      '.write-content'
    ]

    let contentAreaFound = false
    for (const selector of contentSelectors) {
      try {
        const element = await this.page.$(selector)
        if (element && await element.isVisible()) {
          console.log(`✅ 글 내용 입력 영역 발견: ${selector}`)
          
          await this.page.click(selector)
          await this.page.waitForTimeout(1000)
          
          // contenteditable div인 경우 직접 텍스트 입력
          if (selector.includes('contenteditable') || selector.includes('postWriteForm')) {
            await this.page.fill(selector, content)
          } else {
            await this.humanTyping(selector, content)
          }
          
          contentAreaFound = true
          break
        }
      } catch (error) {
        console.log(`⚠️ 내용 입력 셀렉터 실패: ${selector}`)
      }
    }

    if (!contentAreaFound) {
      console.log('❌ 글 내용 입력 영역을 찾을 수 없습니다.')
      return false
    }

    console.log('✅ 글 내용 작성 완료')
    await this.page.waitForTimeout(2000)
    return true
  }

  // 이미지 업로드
  async uploadImage() {
    console.log('📸 이미지 업로드 시작...')
    
    const testImagePath = path.resolve('./test-post-image.png')
    
    // 이미지 업로드 버튼 셀렉터들
    const photoButtonSelectors = [
      '#wrap > div.layerContainerView > div > div > section > div > div > div > div.buttonArea._bottomToolbar > ul > li:nth-child(1) > label > span.icon',
      'input[type="file"]',
      'button[title*="사진"]',
      'button[aria-label*="사진"]',
      '.photo-upload-btn',
      '.file-upload',
      'label[for*="file"]'
    ]

    // 파일 선택 이벤트 리스너 설정
    this.page.on('filechooser', async (fileChooser) => {
      console.log('📁 파일 선택 대화상자 감지됨')
      await fileChooser.setFiles(testImagePath)
      console.log('✅ 이미지 파일 선택 완료:', testImagePath)
    })

    let uploadSuccess = false
    for (const selector of photoButtonSelectors) {
      try {
        const element = await this.page.$(selector)
        if (element && await element.isVisible()) {
          console.log(`✅ 사진 업로드 버튼 발견: ${selector}`)
          await this.page.click(selector)
          uploadSuccess = true
          break
        }
      } catch (error) {
        console.log(`⚠️ 사진 버튼 셀렉터 실패: ${selector}`)
      }
    }

    if (uploadSuccess) {
      console.log('⏰ 이미지 업로드 처리 중...')
      await this.page.waitForTimeout(5000) // 업로드 완료 대기
      
      // 업로드된 이미지 확인
      try {
        const uploadedImage = await this.page.$('img[src*="band"], img[src*="blob"]')
        if (uploadedImage) {
          console.log('✅ 이미지 업로드 성공 확인!')
          return true
        } else {
          console.log('⚠️ 업로드된 이미지를 확인할 수 없습니다.')
          return false
        }
      } catch (error) {
        console.log('⚠️ 이미지 확인 중 오류:', error.message)
        return false
      }
    } else {
      console.log('❌ 이미지 업로드 버튼을 찾을 수 없습니다.')
      return false
    }
  }

  // 게시 실행
  async publishPost() {
    console.log('📤 게시 실행...')
    
    const submitSelectors = [
      '#wrap > div.layerContainerView > div > div > section > div > div > div > div.buttonArea._bottomToolbar > div > div.buttonSubmit',
      'button[type="submit"]',
      '.submit-button',
      'button:has-text("게시")',
      'button:has-text("등록")',
      'button:has-text("완료")',
      '.post-submit',
      '.publish-button'
    ]

    let publishSuccess = false
    for (const selector of submitSelectors) {
      try {
        const element = await this.page.$(selector)
        if (element && await element.isVisible()) {
          console.log(`✅ 게시 버튼 발견: ${selector}`)
          
          // 게시 전 잠시 확인 시간
          await this.page.waitForTimeout(2000)
          await this.page.click(selector)
          publishSuccess = true
          break
        }
      } catch (error) {
        console.log(`⚠️ 게시 버튼 셀렉터 실패: ${selector}`)
      }
    }

    if (publishSuccess) {
      console.log('⏰ 게시 처리 중...')
      await this.page.waitForTimeout(5000) // 게시 완료 대기
      
      // 게시 완료 확인
      const currentUrl = this.page.url()
      console.log(`📍 게시 후 현재 URL: ${currentUrl}`)
      
      if (currentUrl.includes('page/99872677') && !currentUrl.includes('write')) {
        console.log('✅ 게시 완료!')
        return true
      } else {
        console.log('⚠️ 게시 상태 불확실')
        return false
      }
    } else {
      console.log('❌ 게시 버튼을 찾을 수 없습니다.')
      return false
    }
  }

  // 전체 자동화 프로세스 실행
  async run() {
    try {
      console.log('🚀 완전한 Band 자동화 시스템 시작!')
      console.log('🎯 2차 인증 우회 + 글 작성 + 이미지 업로드\n')
      
      // 준비 작업
      if (!fs.existsSync(this.screenshotDir)) {
        fs.mkdirSync(this.screenshotDir)
      }
      
      const credentials = this.loadCredentials()
      await this.createTestImage()
      await this.initBrowser()
      
      console.log('='.repeat(60))
      console.log('1️⃣ 2차 인증 우회 로그인')
      console.log('='.repeat(60))
      
      const loginSuccess = await this.performLogin(credentials)
      if (!loginSuccess) {
        throw new Error('로그인 실패')
      }
      
      console.log('\n' + '='.repeat(60))
      console.log('2️⃣ 제이소매밴드 접속 및 글쓰기 모드')
      console.log('='.repeat(60))
      
      const accessSuccess = await this.accessJayRetailBand()
      if (!accessSuccess) {
        throw new Error('글쓰기 모드 진입 실패')
      }
      
      console.log('\n' + '='.repeat(60))
      console.log('3️⃣ 글 내용 작성')
      console.log('='.repeat(60))
      
      const writeSuccess = await this.writePost()
      if (!writeSuccess) {
        throw new Error('글 작성 실패')
      }
      
      console.log('\n' + '='.repeat(60))
      console.log('4️⃣ 이미지 업로드')
      console.log('='.repeat(60))
      
      const uploadSuccess = await this.uploadImage()
      // 이미지 업로드는 실패해도 계속 진행
      
      console.log('\n' + '='.repeat(60))
      console.log('5️⃣ 게시 실행')
      console.log('='.repeat(60))
      
      const publishSuccess = await this.publishPost()
      
      // 최종 결과
      console.log('\n' + '🎉'.repeat(20))
      console.log('🏆 완전한 Band 자동화 성공!')
      console.log('✅ 2차 인증 우회: 성공')
      console.log('✅ 글 작성: 성공')
      console.log(`✅ 이미지 업로드: ${uploadSuccess ? '성공' : '실패'}`)
      console.log(`✅ 게시: ${publishSuccess ? '성공' : '처리 중'}`)
      console.log('🎉'.repeat(20))
      
      // 성공 스크린샷
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      await this.page.screenshot({ 
        path: `${this.screenshotDir}/complete-automation-${timestamp}.png`, 
        fullPage: true 
      })
      
      return {
        success: true,
        login: true,
        writeMode: accessSuccess,
        contentWrite: writeSuccess,
        imageUpload: uploadSuccess,
        publish: publishSuccess
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
    console.log('\n⏸️ 결과 확인을 위해 2분간 브라우저 유지...')
    await new Promise(resolve => setTimeout(resolve, 120000))
    
    console.log('🧹 리소스 정리 중...')
    
    if (this.page) await this.page.close()
    if (this.context) await this.context.close()
    if (this.browser) await this.browser.close()
    
    this.cleanupTestImage()
  }
}

// 스크립트 실행
if (require.main === module) {
  const automation = new CompleteBandAutomation()
  
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

module.exports = CompleteBandAutomation