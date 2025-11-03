// 가설 5: 혼합 입력 방식 + 실수 시뮬레이션으로 2단계 인증 우회
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

async function testHypothesis5HumanTyping() {
  let browser = null
  let context = null
  let page = null
  
  try {
    console.log('⌨️ 가설 5: 혼합 입력 방식 + 실수 시뮬레이션 테스트 시작...')
    console.log('🎭 실제 사람의 타이핑 실수와 수정 과정을 완벽하게 시뮬레이션')
    
    // 인증 정보 로드
    const credentials = JSON.parse(fs.readFileSync('./band-credentials.json', 'utf8'))
    console.log(`📧 테스트 이메일: ${credentials.email}`)
    
    // 인간적 타이핑 시뮬레이션 함수들
    
    // 타이핑 속도 변화 (사람은 일정하지 않음)
    function getTypingDelay() {
      // 일반적인 타이핑 속도: 50-200ms, 가끔 더 빠르거나 느림
      const baseDelay = Math.random() * 150 + 50
      
      // 10% 확률로 매우 빠른 타이핑 (연속 타이핑)
      if (Math.random() < 0.1) return Math.random() * 30 + 20
      
      // 5% 확률로 매우 느린 타이핑 (생각하는 시간)
      if (Math.random() < 0.05) return Math.random() * 1000 + 500
      
      return baseDelay
    }
    
    // 실수가 포함된 자연스러운 타이핑
    async function typeWithMistakes(page, selector, text) {
      console.log(`⌨️ 실수를 포함한 자연스러운 타이핑: ${text}`)
      
      await page.click(selector)
      await page.waitForTimeout(Math.random() * 1000 + 300)
      
      const chars = text.split('')
      let typedText = ''
      
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i]
        
        // 15% 확률로 실수 발생
        if (Math.random() < 0.15 && i > 0) {
          console.log(`🤦 실수 발생! (${i+1}번째 문자에서)`)
          
          // 잘못된 문자 타이핑
          const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26)) // a-z
          await page.keyboard.type(wrongChar, { delay: getTypingDelay() })
          typedText += wrongChar
          
          // 실수를 눈치채는 시간
          await page.waitForTimeout(Math.random() * 1000 + 300)
          
          // 백스페이스로 삭제
          console.log('⌫ 실수 수정 중...')
          await page.keyboard.press('Backspace')
          typedText = typedText.slice(0, -1)
          await page.waitForTimeout(Math.random() * 500 + 200)
        }
        
        // 올바른 문자 타이핑
        await page.keyboard.type(char, { delay: getTypingDelay() })
        typedText += char
        
        // 랜덤하게 짧은 멈춤 (생각하는 시간)
        if (Math.random() < 0.1) {
          await page.waitForTimeout(Math.random() * 800 + 200)
        }
      }
      
      // 타이핑 완료 후 잠시 확인하는 시간
      await page.waitForTimeout(Math.random() * 1500 + 500)
      console.log('✅ 타이핑 완료')
    }
    
    // 클립보드와 타이핑 혼합 방식
    async function mixedInputMethod(page, selector, text) {
      console.log(`🔀 혼합 입력 방식: ${text}`)
      
      await page.click(selector)
      await page.waitForTimeout(Math.random() * 800 + 300)
      
      // 50% 확률로 클립보드 사용
      if (Math.random() < 0.5) {
        console.log('📋 클립보드 붙여넣기 선택')
        
        // 클립보드에 복사
        await page.evaluate((text) => {
          navigator.clipboard.writeText(text).catch(() => {
            const textArea = document.createElement('textarea')
            textArea.value = text
            textArea.style.position = 'fixed'
            textArea.style.left = '-9999px'
            document.body.appendChild(textArea)
            textArea.select()
            document.execCommand('copy')
            document.body.removeChild(textArea)
          })
        }, text)
        
        await page.waitForTimeout(Math.random() * 1000 + 300)
        await page.keyboard.press('Control+v')
        
        // 붙여넣기 후 확인하는 시간
        await page.waitForTimeout(Math.random() * 1500 + 800)
        
      } else {
        console.log('⌨️ 직접 타이핑 선택')
        await typeWithMistakes(page, selector, text)
      }
    }
    
    // 브라우저 실행
    browser = await chromium.launch({
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
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul'
    })
    
    // 기본 스텔스 모드
    await context.addInitScript(() => {
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
      
      // 키보드/마우스 이벤트 카운터
      let keyEvents = 0
      let mouseEvents = 0
      
      document.addEventListener('keydown', () => keyEvents++)
      document.addEventListener('keyup', () => keyEvents++)
      document.addEventListener('mousemove', () => mouseEvents++)
      document.addEventListener('click', () => mouseEvents++)
      
      window.getInputActivity = () => ({ keyEvents, mouseEvents })
    })
    
    page = await context.newPage()
    
    console.log('🌐 1단계: Band 홈페이지 접속...')
    await page.goto('https://www.band.us/home', { waitUntil: 'networkidle' })
    
    // 페이지를 둘러보는 자연스러운 행동
    await page.mouse.move(Math.random() * 800 + 200, Math.random() * 400 + 200)
    await page.waitForTimeout(Math.random() * 2000 + 1000)
    
    console.log('🔐 2단계: 로그인 버튼 클릭...')
    const loginSelector = '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn'
    
    // 로그인 버튼 근처로 마우스 이동 (조금 실수하며)
    const loginButton = await page.$(loginSelector)
    if (loginButton) {
      const box = await loginButton.boundingBox()
      if (box) {
        // 약간 빗나간 곳을 먼저 클릭 (실수)
        await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10)
        await page.waitForTimeout(Math.random() * 1000 + 500)
        
        // 올바른 위치로 이동
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(Math.random() * 800 + 300)
      }
    }
    
    await page.click(loginSelector)
    await page.waitForTimeout(Math.random() * 3000 + 2000)
    
    console.log('📧 3단계: 이메일로 로그인 선택...')
    await page.click('#email_login_a')
    await page.waitForTimeout(Math.random() * 2500 + 1500)
    
    // 이메일 입력 (혼합 방식)
    console.log('✏️ 4단계: 이메일 입력 (혼합 방식)...')
    
    // 입력 필드 클릭 전에 잠시 망설이기
    const emailField = await page.$('#input_email')
    if (emailField) {
      const box = await emailField.boundingBox()
      if (box) {
        // 필드 근처를 서성이기
        await page.mouse.move(box.x - 30, box.y)
        await page.waitForTimeout(Math.random() * 1000 + 500)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(Math.random() * 800 + 400)
      }
    }
    
    await mixedInputMethod(page, '#input_email', credentials.email)
    
    console.log('✅ 5단계: 이메일 확인 버튼 클릭...')
    
    // 버튼 클릭 전 잠시 고민하는 시간
    await page.waitForTimeout(Math.random() * 2000 + 1000)
    await page.click('#email_login_form > button')
    await page.waitForTimeout(Math.random() * 4000 + 3000)
    
    console.log('🔑 6단계: 비밀번호 입력 대기...')
    
    try {
      await page.waitForSelector('#pw', { timeout: 15000 })
      console.log('🔑 비밀번호 입력 필드 발견!')
      
      // 비밀번호 입력 전 잠시 기억해내는 시간
      await page.waitForTimeout(Math.random() * 2000 + 1000)
      
      // 비밀번호도 혼합 방식으로 입력
      await mixedInputMethod(page, '#pw', credentials.password)
      
      console.log('🔓 7단계: 로그인 실행...')
      
      // 로그인 버튼 클릭 전 마지막 확인 시간
      await page.waitForTimeout(Math.random() * 1500 + 800)
      await page.click('#email_password_login_form > button')
      await page.waitForTimeout(Math.random() * 6000 + 5000)
      
      // 입력 활동 통계 확인
      const inputActivity = await page.evaluate(() => {
        return window.getInputActivity ? window.getInputActivity() : { keyEvents: 0, mouseEvents: 0 }
      })
      console.log(`📊 입력 활동 통계: 키보드 이벤트 ${inputActivity.keyEvents}개, 마우스 이벤트 ${inputActivity.mouseEvents}개`)
      
      // 결과 확인
      const currentUrl = page.url()
      console.log(`📍 현재 URL: ${currentUrl}`)
      
      if (currentUrl.includes('band.us') && !currentUrl.includes('login')) {
        console.log('✅ 가설 5 성공: 인간적 입력 방식으로 2단계 인증 우회!')
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await page.screenshot({ 
          path: `./screenshots/hypothesis-5-success-${timestamp}.png`, 
          fullPage: true 
        })
        
        return { 
          success: true, 
          method: '혼합 입력 방식 + 실수 시뮬레이션',
          inputActivity 
        }
      } else {
        console.log('❌ 가설 5 실패')
        return { 
          success: false, 
          method: '혼합 입력 방식 + 실수 시뮬레이션',
          inputActivity 
        }
      }
      
    } catch (error) {
      console.log('❌ 가설 5 실패: 비밀번호 단계 도달 실패 (2단계 인증 추정)')
      
      // 현재까지의 입력 활동 통계
      const inputActivity = await page.evaluate(() => {
        return window.getInputActivity ? window.getInputActivity() : { keyEvents: 0, mouseEvents: 0 }
      })
      
      return { 
        success: false, 
        method: '혼합 입력 방식 + 실수 시뮬레이션', 
        error: '2단계 인증 추정',
        inputActivity 
      }
    }
    
  } catch (error) {
    console.error('❌ 가설 5 테스트 오류:', error.message)
    return { success: false, method: '혼합 입력 방식 + 실수 시뮬레이션', error: error.message }
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
  testHypothesis5HumanTyping()
    .then((result) => {
      console.log('\n📊 가설 5 테스트 결과:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 가설 5 테스트 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { testHypothesis5HumanTyping }