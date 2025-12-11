/**
 * Band DOM 구조 분석 스크립트
 * 글쓰기 영역의 실제 셀렉터를 찾기 위한 디버깅
 */

import { chromium } from 'playwright'
import { prisma } from '@bandauto/db'

async function main() {
  // 채널 정보 가져오기
  const channel = await prisma.channel.findFirst({
    where: { bandSessionCookie: { not: null } },
  })

  if (!channel || !channel.bandSessionCookie) {
    console.error('No channel with bandSessionCookie found')
    process.exit(1)
  }

  console.log(`Using channel: ${channel.name}`)

  const browser = await chromium.launch({ headless: true })
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

  try {
    // Band 홈으로 이동
    console.log('Navigating to band home...')
    await page.goto('https://band.us/home', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // 채널로 이동
    const bandLinks = await page.$$eval('a[href*="/band/"]', links =>
      links.map(l => ({ href: l.getAttribute('href'), text: l.textContent?.trim() }))
    )
    console.log('Found band links:', bandLinks.slice(0, 5))

    const targetLink = bandLinks.find(l => l.text?.includes(channel.name) || l.text?.includes('에이비씨'))
    if (targetLink?.href) {
      await page.click(`a[href="${targetLink.href}"]`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
    }

    console.log('Current URL:', page.url())

    // 페이지 상단으로 스크롤
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1000)

    // DOM 분석 - 글쓰기 관련 요소들 찾기
    console.log('\n=== DOM Analysis ===\n')

    // 1. 가짜 에디터 영역 찾기
    const fakeEditorSelectors = [
      '[data-viewname="DPostFakeEditorView"]',
      '.dPostFakeEditor',
      '.postWriteFakeInput',
      '.cPostFakeEditor',
      '.cPostWrite.-standby',
      '.postWriteArea',
      '[class*="FakeEditor"]',
      '[class*="fakeEditor"]',
      '.writeArea',
    ]

    for (const selector of fakeEditorSelectors) {
      const el = await page.$(selector)
      if (el) {
        const isVisible = await el.isVisible()
        const text = await el.textContent().catch(() => '')
        const className = await el.getAttribute('class')
        console.log(`✓ Found: ${selector}`)
        console.log(`  visible: ${isVisible}, class: ${className}`)
        console.log(`  text: "${text?.substring(0, 50)}..."`)
      }
    }

    // 2. 글쓰기 버튼 찾기
    const writeButtonSelectors = [
      'button._btnPostWrite',
      'button._btnOpenWriteLayer',
      '.writeBtn',
      '[data-uiselector="postWriteOpenLayer"]',
    ]

    for (const selector of writeButtonSelectors) {
      const el = await page.$(selector)
      if (el) {
        const isVisible = await el.isVisible()
        console.log(`✓ Found button: ${selector}, visible: ${isVisible}`)
      }
    }

    // 3. 글쓰기 관련 클래스 검색
    const writeRelatedElements = await page.$$eval('*', els => {
      return els
        .filter(el => {
          const className = el.className?.toString() || ''
          const dataView = el.getAttribute?.('data-viewname') || ''
          return (
            className.toLowerCase().includes('write') ||
            className.toLowerCase().includes('editor') ||
            className.toLowerCase().includes('post') ||
            dataView.toLowerCase().includes('write') ||
            dataView.toLowerCase().includes('editor')
          )
        })
        .slice(0, 30)
        .map(el => ({
          tag: el.tagName,
          className: el.className?.toString().substring(0, 100),
          dataView: el.getAttribute?.('data-viewname'),
          id: el.id,
        }))
    })

    console.log('\n=== Write-related elements ===')
    writeRelatedElements.forEach((el, i) => {
      console.log(`${i + 1}. <${el.tag}> class="${el.className}" data-viewname="${el.dataView}" id="${el.id}"`)
    })

    // 4. placeholder 텍스트가 있는 요소 찾기
    const placeholderElements = await page.$$eval('*', els => {
      return els
        .filter(el => {
          const text = el.textContent || ''
          const placeholder = el.getAttribute?.('placeholder') || ''
          return (
            text.includes('글') && text.includes('작성') ||
            text.includes('사진') && text.includes('작성') ||
            placeholder.includes('글') ||
            placeholder.includes('작성')
          )
        })
        .slice(0, 10)
        .map(el => ({
          tag: el.tagName,
          className: el.className?.toString().substring(0, 80),
          text: el.textContent?.substring(0, 50),
        }))
    })

    console.log('\n=== Elements with "글 작성" text ===')
    placeholderElements.forEach((el, i) => {
      console.log(`${i + 1}. <${el.tag}> class="${el.className}" text="${el.text}"`)
    })

    // 5. 클릭 가능한 영역 찾기 (피드 상단)
    const topAreaClickables = await page.$$eval('.cPostWrite, .postWriteArea, [class*="WriteArea"]', els => {
      return els.map(el => ({
        tag: el.tagName,
        className: el.className,
        rect: el.getBoundingClientRect(),
      }))
    })

    console.log('\n=== Top clickable write areas ===')
    topAreaClickables.forEach((el, i) => {
      console.log(`${i + 1}. <${el.tag}> class="${el.className}" pos: ${JSON.stringify(el.rect)}`)
    })

    // 스크린샷
    await page.screenshot({ path: '/tmp/band-playwright-debug/dom-analysis.png', fullPage: false })
    console.log('\nScreenshot saved to /tmp/band-playwright-debug/dom-analysis.png')

  } finally {
    await browser.close()
    await prisma.$disconnect()
  }
}

main().catch(console.error)
