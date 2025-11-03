// 가설 1: 초느린 속도 + 완전 불규칙 딜레이로 2단계 인증 우회
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

async function testHypothesis1UltraSlow() {
  let browser = null
  let context = null
  let page = null
  
  try {
    console.log('🐌 가설 1: 초느린 속도 + 완전 불규칙 딜레이 테스트 시작...')
    console.log('⏰ 이 테스트는 약 10-15분 소요됩니다 (극도로 느린 속도)')
    
    // 인증 정보 로드
    const credentials = JSON.parse(fs.readFileSync('./band-credentials.json', 'utf8'))
    console.log(`📧 테스트 이메일: ${credentials.email}`)
    
    // 극도로 느린 딜레이 함수 (10초-30초)
    function ultraSlowDelay() {
      const delay = Math.floor(Math.random() * 20000) + 10000 // 10-30초
      console.log(`⏰ ${Math.round(delay/1000)}초 대기 중... (인간적 사고시간 시뮬레이션)`)
      return delay
    }
    
    // 랜덤한 짧은 딜레이 (1-5초)
    function randomShortDelay() {
      return Math.floor(Math.random() * 4000) + 1000
    }
    
    // 브라우저 실행 (극도로 느린 설정)
    browser = await chromium.launch({
      headless: false,
      slowMo: 2000, // 2초 slowMo
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    })
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul'
    })
    
    // 기본 봇 감지 우회
    await context.addInitScript(() => {
      delete Object.getPrototypeOf(navigator).webdriver
      delete navigator.__proto__.webdriver
      delete navigator.webdriver
      
      window.chrome = {
        runtime: { onConnect: undefined, onMessage: undefined }
      }
      
      Object.defineProperties(navigator, {
        webdriver: { get: () => undefined },
        plugins: { get: () => [1, 2, 3, 4, 5] },
        languages: { get: () => ['ko-KR', 'ko', 'en'] }
      })
    })
    
    page = await context.newPage()
    
    // 1. Band 홈페이지 접속
    console.log('🌐 1단계: Band 홈페이지 접속...')
    await page.goto('https://www.band.us/home', { waitUntil: 'networkidle' })
    await page.waitForTimeout(ultraSlowDelay()) // 10-30초 대기
    
    // 마우스를 여기저기 움직여보기 (탐색하는 척)
    console.log('👀 페이지 둘러보는 중...')
    await page.mouse.move(200, 200)
    await page.waitForTimeout(randomShortDelay())
    await page.mouse.move(500, 400)
    await page.waitForTimeout(randomShortDelay())
    await page.mouse.move(800, 300)
    await page.waitForTimeout(ultraSlowDelay())
    
    // 2. 로그인 버튼 클릭 (매우 신중하게)
    console.log('🤔 로그인 버튼을 찾는 중... (신중하게)')
    const loginSelector = '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn'
    
    // 로그인 버튼 위에 호버하고 생각해보기
    await page.hover(loginSelector)
    await page.waitForTimeout(ultraSlowDelay()) // 생각하는 시간
    
    console.log('🔐 2단계: 로그인 버튼 클릭...')
    await page.click(loginSelector)
    await page.waitForTimeout(ultraSlowDelay())
    
    // 3. 이메일로 로그인 버튼 (또 고민하기)
    console.log('📧 이메일 로그인을 고민하는 중...')
    await page.hover('#email_login_a')
    await page.waitForTimeout(randomShortDelay())
    
    console.log('📧 3단계: 이메일로 로그인 선택...')
    await page.click('#email_login_a')
    await page.waitForTimeout(ultraSlowDelay())
    
    // 4. 이메일 입력 (매우 신중하게)
    console.log('✏️ 이메일을 입력할 준비를 하는 중...')
    await page.click('#input_email')
    await page.waitForTimeout(randomShortDelay()) // 커서 깜빡이는 것 보기
    
    // 클립보드로 붙여넣기 (하지만 매우 천천히)
    console.log('📋 클립보드에서 이메일 붙여넣기...')
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
    
    await page.waitForTimeout(randomShortDelay())
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(ultraSlowDelay()) // 입력한 내용 확인하는 시간
    
    // 5. 이메일 확인 버튼 (한참 고민하고)
    console.log('🤔 이메일이 올바른지 다시 한번 확인하는 중...')
    await page.waitForTimeout(ultraSlowDelay())
    
    console.log('✅ 5단계: 이메일 확인 버튼 클릭...')
    await page.click('#email_login_form > button')
    await page.waitForTimeout(ultraSlowDelay())
    
    // 6. 비밀번호 입력 대기 (페이지 로딩을 기다리며)
    console.log('⏳ 페이지 로딩을 기다리는 중... (매우 인내심 있게)')
    
    try {
      await page.waitForSelector('#pw', { timeout: 30000 })
      console.log('🔑 비밀번호 입력 필드 발견!')
      
      // 비밀번호 입력 전 또 고민
      await page.click('#pw')
      await page.waitForTimeout(ultraSlowDelay()) // 비밀번호를 기억해내는 시간
      
      console.log('🔐 비밀번호를 클립보드로 입력...')
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
      
      await page.waitForTimeout(randomShortDelay())
      await page.keyboard.press('Control+v')
      await page.waitForTimeout(ultraSlowDelay())
      
      // 7. 비밀번호 확인 버튼
      console.log('🔓 7단계: 로그인 실행...')
      await page.click('#email_password_login_form > button')
      await page.waitForTimeout(ultraSlowDelay())
      
      // 로그인 결과 확인
      console.log('⏳ 로그인 결과 대기 중... (최대 1분)')
      await page.waitForTimeout(60000) // 1분 대기
      
      const currentUrl = page.url()
      console.log(`📍 현재 URL: ${currentUrl}`)
      
      if (currentUrl.includes('band.us') && !currentUrl.includes('login')) {
        console.log('✅ 가설 1 성공: 초느린 속도로 2단계 인증 우회!')
        
        // 성공 스크린샷
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await page.screenshot({ 
          path: `./screenshots/hypothesis-1-success-${timestamp}.png`, 
          fullPage: true 
        })
        
        return { success: true, method: '초느린 속도 + 불규칙 딜레이' }
      } else {
        console.log('❌ 가설 1 실패: 여전히 2단계 인증 또는 로그인 실패')
        return { success: false, method: '초느린 속도 + 불규칙 딜레이' }
      }
      
    } catch (error) {
      console.log('❌ 가설 1 실패: 비밀번호 입력 단계 도달 실패')
      console.log('   아마도 2단계 인증이 발생했을 가능성')
      return { success: false, method: '초느린 속도 + 불규칙 딜레이', error: '2단계 인증 추정' }
    }
    
  } catch (error) {
    console.error('❌ 가설 1 테스트 오류:', error.message)
    return { success: false, method: '초느린 속도 + 불규칙 딜레이', error: error.message }
  } finally {
    console.log('⏸️ 브라우저를 1분간 열어둔 후 종료...')
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
  testHypothesis1UltraSlow()
    .then((result) => {
      console.log('\n📊 가설 1 테스트 결과:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 가설 1 테스트 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { testHypothesis1UltraSlow }