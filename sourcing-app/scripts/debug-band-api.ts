/**
 * Band 게시 시 호출되는 API 엔드포인트 분석 스크립트
 * 실제 게시를 수행하면서 네트워크 요청을 캡처
 */

import { chromium } from 'playwright'
import { prisma } from '@bandauto/db'

async function main() {
  const channel = await prisma.channel.findFirst({
    where: { bandSessionCookie: { not: null } },
  })

  if (!channel || !channel.bandSessionCookie) {
    console.error('No channel with bandSessionCookie found')
    process.exit(1)
  }

  console.log(`Using channel: ${channel.name}`)

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  })

  // 쿠키 설정
  const cookieString = channel.bandSessionCookie
  if (cookieString.startsWith('[')) {
    const cookies = JSON.parse(cookieString)
    await context.addCookies(cookies)
  }

  const page = await context.newPage()

  // 모든 네트워크 요청 로깅
  const capturedRequests: Array<{
    url: string
    method: string
    postData?: string
    responseStatus?: number
    responseBody?: string
  }> = []

  // 게시 버튼 클릭 후에만 요청 캡처 시작
  let captureEnabled = false

  page.on('request', (request) => {
    if (!captureEnabled) return
    const url = request.url()
    const method = request.method()
    // POST 요청이거나 API 관련 요청 캡처
    if (method === 'POST' || url.includes('api') || url.includes('uapi') || url.includes('globalapi')) {
      console.log(`[Request] ${method} ${url}`)
      capturedRequests.push({
        url,
        method,
        postData: request.postData()?.substring(0, 500),
      })
    }
  })

  page.on('response', async (response) => {
    if (!captureEnabled) return
    const url = response.url()
    const status = response.status()
    // 캡처된 요청에 대한 응답만 처리
    const existing = capturedRequests.find((r) => r.url === url && !r.responseStatus)
    if (existing) {
      existing.responseStatus = status
      try {
        const contentType = response.headers()['content-type'] || ''
        if (contentType.includes('json') || contentType.includes('text')) {
          const text = await response.text()
          existing.responseBody = text.substring(0, 2000)
          console.log(`[Response] ${status} ${url.substring(0, 80)}... Body: ${text.substring(0, 100)}`)
        }
      } catch {
        existing.responseBody = '[Unable to read body]'
      }
    }
  })

  try {
    // Band 홈으로 먼저 이동
    console.log('Navigating to band.us/home...')
    await page.goto('https://band.us/home', { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)

    // 밴드 목록에서 특정 밴드 클릭
    console.log(`Looking for band: ${channel.name}`)
    const bandCards = await page.$$('a[href*="/band/"]')
    let foundBand = false
    for (const card of bandCards) {
      const text = await card.textContent()
      const href = await card.getAttribute('href')
      if (text?.includes(channel.name) || (channel.channelKey && href?.includes(channel.channelKey))) {
        console.log(`Found band card, clicking: ${href}`)
        await card.click()
        foundBand = true
        break
      }
    }

    if (!foundBand) {
      // 첫 번째 밴드 카드 클릭
      const firstBand = await page.$('a[href*="/band/"]:not([href*="/home"])')
      if (firstBand) {
        const href = await firstBand.getAttribute('href')
        console.log(`Clicking first band: ${href}`)
        await firstBand.click()
      }
    }

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    console.log('Current URL:', page.url())

    // 페이지 상단으로 스크롤
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1000)

    // 글쓰기 영역 클릭
    console.log('\n=== Opening write layer ===')
    const writeButtonSelectors = [
      'button._btnOpenWriteLayer',
      'button._btnPostWrite',
      '.cPostWriteEventWrapper._btnOpenWriteLayer',
      '[data-viewname="DPostFakeEditorView"]',
    ]

    for (const selector of writeButtonSelectors) {
      const btn = await page.$(selector)
      if (btn && (await btn.isVisible())) {
        console.log(`Found and clicking: ${selector}`)
        await btn.click()
        break
      }
    }

    await page.waitForTimeout(3000)

    // 에디터에 테스트 텍스트 입력
    console.log('\n=== Typing test content ===')
    const editorSelectors = [
      '.cPostWrite [contenteditable="true"].cke_editable',
      '[data-viewname="DPostEditorView"] [contenteditable="true"]',
      '.contentEditor._richEditor[contenteditable="true"]',
    ]

    for (const selector of editorSelectors) {
      const editor = await page.$(selector)
      if (editor && (await editor.isVisible())) {
        console.log(`Found editor: ${selector}`)
        await editor.click()
        const testText = `API 테스트 게시물 - ${new Date().toISOString()} - 자동 삭제 예정`
        await page.keyboard.type(testText, { delay: 30 })
        break
      }
    }

    await page.waitForTimeout(2000)

    // 네트워크 요청 캡처 활성화 (게시 전)
    capturedRequests.length = 0
    captureEnabled = true
    console.log('\n=== Network capture enabled ===')

    // 게시 버튼 클릭
    console.log('\n=== Clicking submit button ===')
    const submitBtn = await page.$('button._btnSubmitPost')
    if (submitBtn) {
      const isEnabled = await submitBtn.isEnabled()
      const isVisible = await submitBtn.isVisible()
      console.log(`Submit button: enabled=${isEnabled}, visible=${isVisible}`)

      if (isEnabled) {
        // 버튼 스크롤 후 클릭
        await submitBtn.scrollIntoViewIfNeeded()
        await page.waitForTimeout(500)
        await submitBtn.click({ force: true })
        console.log('Submit button clicked!')

        // 응답 대기
        console.log('Waiting for API response...')
        await page.waitForTimeout(10000)
      } else {
        console.log('Submit button is disabled - content may be empty')
        await page.screenshot({ path: '/tmp/band-playwright-debug/api-test-disabled.png' })
      }
    } else {
      console.log('Submit button not found!')
      await page.screenshot({ path: '/tmp/band-playwright-debug/api-test-no-button.png' })
    }

    captureEnabled = false

    // 캡처된 요청 출력
    console.log('\n=== Captured API Requests/Responses ===')
    capturedRequests.forEach((req, i) => {
      console.log(`\n--- Request ${i + 1} ---`)
      console.log(`URL: ${req.url}`)
      console.log(`Method: ${req.method}`)
      if (req.postData) {
        console.log(`Post Data: ${req.postData}`)
      }
      if (req.responseStatus) {
        console.log(`Response Status: ${req.responseStatus}`)
      }
      if (req.responseBody) {
        console.log(`Response Body: ${req.responseBody}`)
      }
    })

    // 스크린샷 저장
    await page.screenshot({ path: '/tmp/band-playwright-debug/api-test-result.png' })

    console.log('\n=== Waiting before close ===')
    await page.waitForTimeout(5000)
  } finally {
    await browser.close()
    await prisma.$disconnect()
  }
}

main().catch(console.error)
