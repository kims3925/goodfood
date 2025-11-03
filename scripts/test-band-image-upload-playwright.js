// Band Playwright 이미지 업로드 테스트 - 정확한 셀렉터 사용
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

async function testBandImageUploadPlaywright() {
  let browser = null
  let context = null
  let page = null

  try {
    console.log('🎭 Playwright Band 이미지 업로드 테스트 시작...')
    
    // 테스트용 이미지 파일 생성
    await createTestImage()
    
    // 캡차 방지를 위한 브라우저 실행 설정
    browser = await chromium.launch({
      headless: false, // 화면을 보면서 테스트
      slowMo: 1500,    // 각 동작 사이에 1.5초 대기
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    })
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul'
    })
    
    page = await context.newPage()
    
    // 1. Band 홈페이지 접속
    console.log('📍 1단계: Band 홈페이지 접속...')
    await page.goto('https://www.band.us/home', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    
    // 2. 로그인 버튼 클릭
    console.log('🔐 2단계: 로그인 버튼 클릭...')
    const loginSelector = '#container > div > div.sloganArea > div > div._signupRegion > div > div > div.buttonBox > button.button._loginBtn'
    await page.click(loginSelector)
    await page.waitForTimeout(2000)
    
    // 3. 이메일로 로그인 버튼 클릭
    console.log('📧 3단계: 이메일로 로그인 버튼 클릭...')
    await page.click('#email_login_a')
    await page.waitForTimeout(2000)
    
    // 4. 이메일 입력
    console.log('✏️ 4단계: 이메일 입력...')
    await page.fill('#input_email', 'joshep3399@gmail.com')
    await page.waitForTimeout(1000)
    
    // 5. 이메일 확인 버튼 클릭
    console.log('✅ 5단계: 이메일 확인 버튼 클릭...')
    await page.click('#email_login_form > button')
    await page.waitForTimeout(3000)
    
    // 6. 비밀번호 입력
    console.log('🔑 6단계: 비밀번호 입력...')
    await page.fill('#pw', 'kimjin0506')
    await page.waitForTimeout(1000)
    
    // 7. 비밀번호 확인 버튼 클릭
    console.log('🔓 7단계: 비밀번호 확인 버튼 클릭...')
    await page.click('#email_password_login_form > button')
    await page.waitForTimeout(5000) // 로그인 완료 대기
    
    // 8. 제이소매밴드 페이지로 이동
    console.log('🏪 8단계: 제이소매밴드 페이지로 이동...')
    await page.goto('https://www.band.us/page/99872677/post', { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    
    // 9. 글쓰기 버튼 클릭
    console.log('✏️ 9단계: 글쓰기 버튼 클릭...')
    const writeButtonSelector = '#asideWrap > div > div.inner._sideScrollbar > div > div.pageLeftArea.gBoxShadow > div > div.buttons > button.roundButton.-full._btnWritePost'
    await page.click(writeButtonSelector)
    await page.waitForTimeout(3000)
    
    // 10. 글 내용 입력
    console.log('📝 10단계: 글 내용 입력...')
    const contentSelector = '#wrap > div.layerContainerView > div > div > section > div > div > div > div.postWriteForm._postWriteForm.-standby > div'
    const content = `pl: Playwright 이미지 업로드 테스트

이것은 Playwright를 사용한 실제 이미지 파일 업로드 테스트입니다.

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
          path: `./screenshots/band-image-uploaded-${timestamp}.png`, 
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
    
    console.log('✅ Playwright 이미지 업로드 테스트 완료!')
    
    // 최종 결과 스크린샷
    const finalTimestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await page.screenshot({ 
      path: `./screenshots/band-post-complete-${finalTimestamp}.png`, 
      fullPage: true 
    })
    
  } catch (error) {
    console.error('❌ Playwright 이미지 업로드 테스트 오류:', error)
    
    if (page) {
      // 오류 발생 시 스크린샷 저장
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const screenshotPath = `./screenshots/band-image-error-${timestamp}.png`
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`📸 오류 스크린샷 저장: ${screenshotPath}`)
    }
  } finally {
    // 정리
    if (page) await page.close()
    if (context) await context.close()
    if (browser) await browser.close()
    
    // 테스트 이미지 파일 정리
    cleanupTestImage()
  }
}

async function createTestImage() {
  try {
    console.log('🖼️ 테스트 이미지 파일 생성...')
    
    // 간단한 PNG 이미지 데이터 (100x100 빨간 사각형)
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
    
    fs.writeFileSync('./test-image.png', pngData)
    console.log('✅ 테스트 이미지 파일 생성 완료: test-image.png')
    
  } catch (error) {
    console.error('❌ 테스트 이미지 생성 오류:', error)
    throw error
  }
}

function cleanupTestImage() {
  try {
    if (fs.existsSync('./test-image.png')) {
      fs.unlinkSync('./test-image.png')
      console.log('🧹 테스트 이미지 파일 정리 완료')
    }
  } catch (error) {
    console.error('⚠️ 테스트 이미지 정리 오류:', error)
  }
}

// 스크린샷 디렉토리 생성
if (!fs.existsSync('./screenshots')) {
  fs.mkdirSync('./screenshots')
}

// 스크립트 실행
if (require.main === module) {
  testBandImageUploadPlaywright()
    .then(() => {
      console.log('\n🏁 Band Playwright 이미지 업로드 테스트 완료')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 테스트 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { testBandImageUploadPlaywright }