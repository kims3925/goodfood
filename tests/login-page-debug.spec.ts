import { test, expect } from '@playwright/test'

test.describe('로그인 페이지 디버깅', () => {
  test('로그인 페이지 렌더링 상태 확인', async ({ page }) => {
    console.log('🔍 로그인 페이지 렌더링 상태 확인...')

    // 1. 로그인 페이지로 이동
    await page.goto('http://54.253.75.175:3000/login')
    await page.waitForLoadState('networkidle')

    console.log(`🔍 현재 URL: ${page.url()}`)

    // 2. 페이지 제목 확인
    const title = await page.title()
    console.log(`📄 페이지 제목: ${title}`)

    // 3. 페이지 HTML 구조 확인
    const bodyContent = await page.locator('body').innerHTML()
    console.log(`📝 페이지 길이: ${bodyContent.length} 문자`)

    // 4. 특정 요소들 존재 여부 확인
    const checks = [
      { selector: 'h1', description: 'H1 제목' },
      { selector: 'form', description: '로그인 폼' },
      { selector: 'input[type="email"]', description: '이메일 입력' },
      { selector: 'input[name="email"]', description: '이메일 입력 (name)' },
      { selector: 'input[type="password"]', description: '비밀번호 입력' },
      { selector: 'input[name="password"]', description: '비밀번호 입력 (name)' },
      { selector: 'button[type="submit"]', description: '제출 버튼' },
      { selector: 'div.bg-white', description: '배경 컨테이너' },
      { selector: 'div.min-h-screen', description: '메인 컨테이너' }
    ]

    for (const check of checks) {
      const element = page.locator(check.selector)
      const exists = await element.count() > 0
      const visible = exists ? await element.first().isVisible() : false
      console.log(`${exists ? '✅' : '❌'} ${check.description}: 존재=${exists}, 보임=${visible}`)

      if (exists && check.selector.includes('input')) {
        const placeholder = await element.first().getAttribute('placeholder')
        console.log(`   └ placeholder: ${placeholder}`)
      }
    }

    // 5. CSS 로딩 상태 확인
    const stylesheets = await page.locator('link[rel="stylesheet"]').count()
    console.log(`🎨 CSS 파일 개수: ${stylesheets}`)

    // 6. JavaScript 오류 확인
    const errors: string[] = []
    page.on('pageerror', error => {
      errors.push(error.message)
    })

    await page.waitForTimeout(2000)

    if (errors.length > 0) {
      console.log('❌ JavaScript 오류들:')
      errors.forEach(error => console.log(`   - ${error}`))
    } else {
      console.log('✅ JavaScript 오류 없음')
    }

    // 7. 네트워크 실패 확인
    const failedRequests: string[] = []
    page.on('response', response => {
      if (!response.ok()) {
        failedRequests.push(`${response.status()} ${response.url()}`)
      }
    })

    if (failedRequests.length > 0) {
      console.log('❌ 실패한 요청들:')
      failedRequests.forEach(req => console.log(`   - ${req}`))
    } else {
      console.log('✅ 모든 요청 성공')
    }

    // 8. 실제 로그인 시도
    console.log('🧪 실제 로그인 시도...')

    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.locator('button[type="submit"]')

    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      await emailInput.fill('test@bandauto.com')
      await passwordInput.fill('test123!@#')
      await submitButton.click()

      await page.waitForTimeout(3000)

      console.log(`🔍 로그인 후 URL: ${page.url()}`)

      // 로그인 후 세션 확인
      const sessionResponse = await page.request.get('http://54.253.75.175:3000/api/auth/session')
      console.log(`🔍 로그인 후 세션 API: ${sessionResponse.status()}`)

      if (sessionResponse.ok()) {
        const sessionData = await sessionResponse.json()
        console.log('✅ 로그인 성공, 세션 데이터:', JSON.stringify(sessionData, null, 2))
      }
    } else {
      console.log('❌ 로그인 폼 요소를 찾을 수 없음')
    }

    console.log('🎉 로그인 페이지 디버깅 완료!')
  })
})