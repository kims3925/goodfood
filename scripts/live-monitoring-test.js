// 실제 2차 인증 우회 모니터링 테스트
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

async function liveMonitoringTest() {
  let browser = null
  let context = null
  let page = null
  
  try {
    console.log('🔴 LIVE: 2차 인증 우회 실제 테스트 시작!')
    console.log('👁️  모니터링을 위해 브라우저를 오래 열어둡니다.')
    console.log('⏰ 전체 과정을 천천히 진행하여 관찰 가능하게 합니다.\n')
    
    // 인증 정보 로드
    const credentials = JSON.parse(fs.readFileSync('./band-credentials.json', 'utf8'))
    console.log(`📧 테스트 계정: ${credentials.email}`)
    
    // 실수 포함 인간적 타이핑 함수
    async function humanTypingWithMistakes(page, selector, text) {
      console.log(`⌨️  [TYPING] ${text} 입력 시작...`)
      
      await page.click(selector)
      await page.waitForTimeout(1000) // 클릭 후 대기
      
      const chars = text.split('')
      let typedSoFar = ''
      
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i]
        
        // 15% 확률로 실수 발생
        if (Math.random() < 0.15 && i > 2) {
          console.log(`   🤦 [MISTAKE] ${i+1}번째 문자에서 실수!`)
          
          // 잘못된 문자 타이핑
          const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26))
          await page.keyboard.type(wrongChar, { delay: Math.random() * 200 + 100 })
          typedSoFar += wrongChar
          
          // 실수 눈치채는 시간 (1-2초)
          await page.waitForTimeout(Math.random() * 1000 + 1000)
          
          // 백스페이스로 삭제
          console.log(`   ⌫  [FIX] 실수 수정 중...`)
          await page.keyboard.press('Backspace')
          typedSoFar = typedSoFar.slice(0, -1)
          await page.waitForTimeout(Math.random() * 500 + 300)
        }
        
        // 올바른 문자 타이핑
        await page.keyboard.type(char, { 
          delay: Math.random() * 200 + 100 // 100-300ms 딜레이
        })
        typedSoFar += char
        
        console.log(`   📝 [PROGRESS] "${typedSoFar}"`)
        
        // 가끔 멈춤 (생각하는 시간)
        if (Math.random() < 0.1) {
          console.log(`   💭 [PAUSE] 잠시 생각하는 시간...`)
          await page.waitForTimeout(Math.random() * 1500 + 500)
        }
      }
      
      console.log(`   ✅ [COMPLETE] "${text}" 타이핑 완료!\n`)
      await page.waitForTimeout(1500) // 완료 후 확인 시간
    }
    
    // 브라우저 실행 (모니터링용 - 느리게)
    console.log('🌐 브라우저 실행 중...')
    browser = await chromium.launch({
      headless: false,
      slowMo: 800, // 매우 느리게
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
      timezoneId: 'Asia/Seoul'
    })
    
    // 스텔스 모드 적용
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
      
      // 키보드/마우스 이벤트 추적
      let keyEvents = 0
      let mouseEvents = 0
      
      document.addEventListener('keydown', () => keyEvents++)
      document.addEventListener('keyup', () => keyEvents++)
      document.addEventListener('mousemove', () => mouseEvents++)
      document.addEventListener('click', () => mouseEvents++)
      
      window.getInputActivity = () => ({ keyEvents, mouseEvents })
      
      console.log('🔧 스텔스 모드 적용 완료')
    })
    
    page = await context.newPage()
    console.log('✅ 브라우저 준비 완료!\n')
    
    // 1단계: Band 홈페이지 접속
    console.log('🌐 [STEP 1] Band 홈페이지 접속 중...')
    await page.goto('https://www.band.us/home', { waitUntil: 'networkidle' })
    console.log('✅ 홈페이지 로드 완료')
    
    // 자연스러운 페이지 둘러보기
    console.log('👀 페이지를 자연스럽게 둘러보는 중...')
    await page.mouse.move(400, 300)
    await page.waitForTimeout(2000)
    await page.mouse.move(800, 400)
    await page.waitForTimeout(2000)
    await page.mouse.move(600, 200)
    await page.waitForTimeout(3000)
    console.log('✅ 페이지 탐색 완료\n')
    
    // 2단계: 로그인 버튼 클릭
    console.log('🔐 [STEP 2] 로그인 버튼 클릭...')
    const loginSelector = '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn'
    
    // 로그인 버튼 찾아서 호버
    console.log('🔍 로그인 버튼 찾는 중...')
    await page.hover(loginSelector)
    await page.waitForTimeout(2000)
    
    console.log('🖱️  로그인 버튼 클릭!')
    await page.click(loginSelector)
    await page.waitForTimeout(3000)
    console.log('✅ 로그인 페이지 진입\n')
    
    // 3단계: 이메일로 로그인 선택
    console.log('📧 [STEP 3] 이메일로 로그인 선택...')
    await page.hover('#email_login_a')
    await page.waitForTimeout(1500)
    await page.click('#email_login_a')
    await page.waitForTimeout(3000)
    console.log('✅ 이메일 로그인 모드 진입\n')
    
    // 4단계: 이메일 입력 (실수 포함)
    console.log('✏️  [STEP 4] 이메일 입력 (실수 시뮬레이션 포함)...')
    await humanTypingWithMistakes(page, '#input_email', credentials.email)
    
    // 5단계: 이메일 확인 버튼
    console.log('✅ [STEP 5] 이메일 확인 버튼 클릭...')
    console.log('🤔 잠시 고민하는 시간...')
    await page.waitForTimeout(3000)
    
    await page.click('#email_login_form > button')
    console.log('📤 이메일 확인 요청 전송!')
    await page.waitForTimeout(5000)
    console.log('✅ 다음 단계로 진행\n')
    
    // 6단계: 2차 인증 또는 비밀번호 확인
    console.log('🔑 [STEP 6] 비밀번호 입력 또는 2차 인증 확인 중...')
    console.log('⏰ 최대 15초 대기...')
    
    try {
      // 비밀번호 입력 필드 대기
      await page.waitForSelector('#pw', { timeout: 15000 })
      console.log('🎉 SUCCESS: 비밀번호 입력 필드 발견!')
      console.log('✅ 2차 인증이 발생하지 않았습니다!')
      
      // 비밀번호 입력 (실수 포함)
      console.log('🔐 비밀번호 입력 중 (실수 시뮬레이션 포함)...')
      await page.waitForTimeout(2000) // 비밀번호 기억하는 시간
      await humanTypingWithMistakes(page, '#pw', credentials.password)
      
      // 7단계: 로그인 실행
      console.log('🔓 [STEP 7] 로그인 실행...')
      console.log('🤔 마지막 확인 시간...')
      await page.waitForTimeout(2000)
      
      await page.click('#email_password_login_form > button')
      console.log('📤 로그인 요청 전송!')
      
      // 로그인 결과 대기
      console.log('⏰ 로그인 결과 대기 중... (10초)')
      await page.waitForTimeout(10000)
      
      // 현재 상태 확인
      const currentUrl = page.url()
      console.log(`📍 현재 URL: ${currentUrl}`)
      
      // 입력 활동 통계 확인
      const inputActivity = await page.evaluate(() => {
        return window.getInputActivity ? window.getInputActivity() : { keyEvents: 0, mouseEvents: 0 }
      })
      console.log(`📊 입력 활동: 키보드 ${inputActivity.keyEvents}, 마우스 ${inputActivity.mouseEvents}`)
      
      if (currentUrl.includes('band.us') && !currentUrl.includes('login')) {
        console.log('\n🎉🎉🎉 COMPLETE SUCCESS! 🎉🎉🎉')
        console.log('✅ 2차 인증 없이 로그인 성공!')
        console.log('✅ 실수 시뮬레이션 방식이 완벽하게 작동!')
        
        // 8단계: 제이소매밴드 접근 테스트
        console.log('\n🏪 [STEP 8] 제이소매밴드 접근 테스트...')
        await page.goto('https://www.band.us/page/99872677/post', { 
          waitUntil: 'networkidle' 
        })
        await page.waitForTimeout(5000)
        
        const finalUrl = page.url()
        console.log(`📍 제이소매밴드 URL: ${finalUrl}`)
        
        if (finalUrl.includes('99872677')) {
          console.log('🎯 제이소매밴드 접근 성공!')
        } else {
          console.log('⚠️ 제이소매밴드 접근 실패')
        }
        
        // 성공 스크린샷
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await page.screenshot({ 
          path: `./screenshots/live-test-success-${timestamp}.png`, 
          fullPage: true 
        })
        console.log('📸 성공 스크린샷 저장')
        
        return { 
          success: true, 
          method: '실수 시뮬레이션 방식',
          twoFactorAuth: false,
          inputActivity 
        }
        
      } else {
        console.log('\n❌ 로그인 실패 또는 추가 인증 필요')
        return { 
          success: false, 
          method: '실수 시뮬레이션 방식',
          twoFactorAuth: 'unknown',
          currentUrl 
        }
      }
      
    } catch (error) {
      console.log('\n🚨 2차 인증 발생 또는 비밀번호 단계 도달 실패!')
      console.log('❌ 비밀번호 입력 필드를 찾을 수 없습니다.')
      console.log('🔐 2차 인증이 발생했을 가능성이 높습니다.')
      
      // 현재 페이지 상태 확인
      const currentUrl = page.url()
      console.log(`📍 현재 URL: ${currentUrl}`)
      
      // 2차 인증 관련 요소 확인
      const authElements = await page.$$eval('*', elements => 
        elements.filter(el => {
          const text = el.textContent?.toLowerCase() || ''
          return text.includes('인증') || text.includes('verification') || text.includes('code')
        }).map(el => ({
          tag: el.tagName,
          text: el.textContent?.slice(0, 50),
          className: el.className
        }))
      )
      
      if (authElements.length > 0) {
        console.log('🔍 인증 관련 요소 발견:')
        authElements.forEach(el => console.log(`   ${el.tag}: "${el.text}"`))
      }
      
      return { 
        success: false, 
        method: '실수 시뮬레이션 방식',
        twoFactorAuth: true,
        error: '2차 인증 발생 추정'
      }
    }
    
  } catch (error) {
    console.error('\n💥 테스트 실행 오류:', error.message)
    return { 
      success: false, 
      error: error.message 
    }
  } finally {
    console.log('\n⏸️  모니터링을 위해 3분간 브라우저 유지...')
    console.log('👁️  브라우저를 직접 확인해보세요!')
    console.log('⏰ 3분 후 자동 종료됩니다.')
    
    // 3분간 대기
    await new Promise(resolve => setTimeout(resolve, 180000))
    
    console.log('🧹 브라우저 종료 중...')
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
  liveMonitoringTest()
    .then((result) => {
      console.log('\n📊 실제 테스트 결과:')
      console.log('='.repeat(50))
      if (result.success) {
        console.log('🎉 결과: 성공!')
        console.log(`✅ 방법: ${result.method}`)
        console.log(`🔐 2차 인증: ${result.twoFactorAuth ? '발생함' : '발생 안함'}`)
        if (result.inputActivity) {
          console.log(`📊 활동: 키보드 ${result.inputActivity.keyEvents}, 마우스 ${result.inputActivity.mouseEvents}`)
        }
      } else {
        console.log('❌ 결과: 실패')
        console.log(`🔐 2차 인증: ${result.twoFactorAuth ? '발생함' : '불명'}`)
        console.log(`💬 오류: ${result.error || '알 수 없음'}`)
      }
      console.log('='.repeat(50))
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { liveMonitoringTest }