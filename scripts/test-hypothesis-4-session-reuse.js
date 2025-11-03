// 가설 4: 세션 재사용으로 2단계 인증 우회
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

async function testHypothesis4SessionReuse() {
  let browser = null
  let context = null
  let page = null
  
  const sessionPath = './band-session.json'
  
  try {
    console.log('🔄 가설 4: 세션 재사용으로 2단계 인증 우회 테스트 시작...')
    console.log('💾 기존 세션이 있으면 재사용, 없으면 새로 생성')
    
    // 인증 정보 로드
    const credentials = JSON.parse(fs.readFileSync('./band-credentials.json', 'utf8'))
    console.log(`📧 테스트 이메일: ${credentials.email}`)
    
    // 기존 세션 확인
    let existingSession = null
    if (fs.existsSync(sessionPath)) {
      try {
        existingSession = JSON.parse(fs.readFileSync(sessionPath, 'utf8'))
        console.log('📂 기존 세션 파일 발견!')
        console.log(`💾 세션 생성일: ${new Date(existingSession.createdAt).toLocaleString()}`)
        
        // 세션이 24시간 이내인지 확인
        const sessionAge = Date.now() - new Date(existingSession.createdAt).getTime()
        const maxAge = 24 * 60 * 60 * 1000 // 24시간
        
        if (sessionAge > maxAge) {
          console.log('⏰ 세션이 24시간을 넘어서 새로 생성합니다.')
          existingSession = null
          fs.unlinkSync(sessionPath)
        }
      } catch (error) {
        console.log('⚠️ 기존 세션 파일이 손상되어 새로 생성합니다.')
        existingSession = null
        if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath)
      }
    }
    
    // 브라우저 실행
    browser = await chromium.launch({
      headless: false,
      slowMo: 300,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    })
    
    // 컨텍스트 생성 (세션 있으면 복원)
    const contextOptions = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul'
    }
    
    if (existingSession && existingSession.cookies) {
      console.log('🍪 기존 쿠키로 컨텍스트 복원 중...')
      contextOptions.storageState = existingSession
    }
    
    context = await browser.newContext(contextOptions)
    
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
    })
    
    page = await context.newPage()
    
    if (existingSession) {
      console.log('🔄 기존 세션으로 Band에 접근 시도...')
      
      // 바로 Band 페이지로 이동
      await page.goto('https://www.band.us/page/99872677/post', { waitUntil: 'networkidle' })
      await page.waitForTimeout(3000)
      
      // 로그인 상태 확인
      const currentUrl = page.url()
      console.log(`📍 현재 URL: ${currentUrl}`)
      
      // 로그인 버튼이 있는지 확인
      const loginButton = await page.$('button._loginBtn, .login-button, [href*="login"]')
      
      if (!loginButton && currentUrl.includes('band.us') && !currentUrl.includes('login')) {
        console.log('✅ 기존 세션으로 로그인 상태 확인!')
        console.log('✅ 가설 4 성공: 세션 재사용으로 2단계 인증 완전 회피!')
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await page.screenshot({ 
          path: `./screenshots/hypothesis-4-success-${timestamp}.png`, 
          fullPage: true 
        })
        
        return { success: true, method: '세션 재사용', type: '기존 세션 사용' }
      } else {
        console.log('⚠️ 기존 세션이 만료되었습니다. 새로 로그인합니다.')
      }
    }
    
    // 새로운 로그인 과정 (수동 개입 포함)
    console.log('🆕 새로운 세션 생성을 위한 로그인 과정 시작...')
    console.log('👤 이 과정에서는 사용자가 수동으로 2단계 인증을 완료해야 할 수 있습니다.')
    
    // Band 홈페이지로 이동
    await page.goto('https://www.band.us/home', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    
    console.log('🔐 로그인 과정 시작...')
    const loginSelector = '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn'
    await page.click(loginSelector)
    await page.waitForTimeout(2000)
    
    console.log('📧 이메일로 로그인...')
    await page.click('#email_login_a')
    await page.waitForTimeout(2000)
    
    console.log('✏️ 이메일 입력...')
    await page.click('#input_email')
    await page.type('#input_email', credentials.email, { delay: 100 })
    await page.waitForTimeout(1000)
    
    console.log('✅ 이메일 확인 버튼 클릭...')
    await page.click('#email_login_form > button')
    await page.waitForTimeout(3000)
    
    // 비밀번호 입력 또는 2단계 인증 대기
    console.log('🔑 비밀번호 입력 또는 2단계 인증 대기...')
    
    try {
      await page.waitForSelector('#pw', { timeout: 10000 })
      console.log('🔑 비밀번호 입력 가능!')
      
      await page.click('#pw')
      await page.type('#pw', credentials.password, { delay: 100 })
      await page.waitForTimeout(1000)
      
      console.log('🔓 로그인 실행...')
      await page.click('#email_password_login_form > button')
      await page.waitForTimeout(5000)
      
    } catch (error) {
      console.log('⚠️ 2단계 인증이 필요할 수 있습니다.')
      console.log('👤 브라우저에서 수동으로 인증을 완료하세요.')
      console.log('⏰ 2분간 대기합니다...')
      
      await page.waitForTimeout(120000) // 2분 대기
    }
    
    // 로그인 완료 여부 확인
    console.log('🔍 로그인 완료 여부 확인...')
    await page.waitForTimeout(3000)
    
    const finalUrl = page.url()
    console.log(`📍 최종 URL: ${finalUrl}`)
    
    // 로그인 성공 확인
    if (finalUrl.includes('band.us') && !finalUrl.includes('login')) {
      console.log('✅ 로그인 성공!')
      
      // 세션 저장
      console.log('💾 세션 저장 중...')
      const storageState = await context.storageState()
      const sessionData = {
        ...storageState,
        createdAt: new Date().toISOString(),
        email: credentials.email
      }
      
      fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2))
      console.log('✅ 세션 저장 완료!')
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      await page.screenshot({ 
        path: `./screenshots/hypothesis-4-new-session-${timestamp}.png`, 
        fullPage: true 
      })
      
      return { success: true, method: '세션 재사용', type: '새 세션 생성 및 저장' }
      
    } else {
      console.log('❌ 로그인 실패')
      return { success: false, method: '세션 재사용', error: '로그인 실패' }
    }
    
  } catch (error) {
    console.error('❌ 가설 4 테스트 오류:', error.message)
    return { success: false, method: '세션 재사용', error: error.message }
  } finally {
    console.log('⏸️ 결과 확인을 위해 30초간 대기...')
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    if (page) await page.close()
    if (context) await context.close()
    if (browser) await browser.close()
  }
}

// 세션 파일 정리 함수
async function clearSession() {
  const sessionPath = './band-session.json'
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath)
    console.log('🧹 기존 세션 파일 삭제됨')
  }
}

// 스크린샷 디렉토리 생성
if (!fs.existsSync('./screenshots')) {
  fs.mkdirSync('./screenshots')
}

// 스크립트 실행
if (require.main === module) {
  // 명령행 인수 확인
  const args = process.argv.slice(2)
  if (args.includes('--clear-session')) {
    clearSession().then(() => process.exit(0))
    return
  }
  
  testHypothesis4SessionReuse()
    .then((result) => {
      console.log('\n📊 가설 4 테스트 결과:', result)
      console.log('\n💡 팁: 세션을 초기화하려면 "node test-hypothesis-4-session-reuse.js --clear-session" 실행')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 가설 4 테스트 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { testHypothesis4SessionReuse, clearSession }