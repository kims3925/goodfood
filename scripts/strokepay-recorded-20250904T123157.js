// 스룩페이 자동화 스크립트 (생성일: 2025. 9. 4. 오후 9:31:57)

async function runStrokePayAutomation(page) {
  try {
    console.log('🚀 스룩페이 자동화 시작')

    // 로그인 페이지로 이동
    await page.goto('https://srookpay.com/member/login?ReturnUrl=%2fmember%2fadmin', {
      waitUntil: 'networkidle',
      timeout: 30000
    })
    await page.waitForTimeout(2000)

    // 페이지 이동 대기: https://srookpay.com/member/login
    await page.waitForURL('https://srookpay.com/member/login', { timeout: 30000 })
    await page.waitForTimeout(2000)

    // 입력: #username
    await page.fill('#username', 'test@example.com')
    await page.waitForTimeout(500)

    // 입력: #password
    await page.fill('#password', 'password123')
    await page.waitForTimeout(500)

    // 클릭: 로그인
    await page.click('#loginBtn', { timeout: 10000 })
    await page.waitForTimeout(1000)

    // 페이지 이동 대기: https://srookpay.com/admin/product/upload
    await page.waitForURL('https://srookpay.com/admin/product/upload', { timeout: 30000 })
    await page.waitForTimeout(2000)

    // 클릭: 파일 선택
    await page.click('input[type="file"]', { timeout: 10000 })
    await page.waitForTimeout(1000)

    // 클릭: 업로드
    await page.click('#uploadBtn', { timeout: 10000 })
    await page.waitForTimeout(1000)

    console.log('✅ 자동화 완료')
  } catch (error) {
    console.error('❌ 자동화 실행 중 오류:', error)
    throw error
  }
}

module.exports = { runStrokePayAutomation }