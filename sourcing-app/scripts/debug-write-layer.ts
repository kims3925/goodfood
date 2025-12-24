// @ts-nocheck
/**
 * Band 글쓰기 레이어 DOM 구조 분석 스크립트
 * 열린 글쓰기 레이어 내부의 실제 셀렉터를 찾기 위한 디버깅
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
    // Band 홈으로 먼저 이동
    console.log('Navigating to band.us/home...')
    await page.goto('https://band.us/home', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // 밴드 목록에서 특정 밴드 클릭
    console.log(`Looking for band: ${channel.name}`)
    const bandCards = await page.$$('a[href*="/band/"]')
    for (const card of bandCards) {
      const text = await card.textContent()
      const href = await card.getAttribute('href')
      if (text?.includes(channel.name) || href?.includes(channel.channelKey)) {
        console.log(`Found band card, clicking: ${href}`)
        await card.click()
        break
      }
    }

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    console.log('Current URL:', page.url())

    // 페이지 상단으로 스크롤
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1000)

    // 글쓰기 버튼 클릭
    console.log('\n=== Clicking write button ===')
    const writeButtonSelectors = [
      'button._btnOpenWriteLayer',
      'button._btnPostWrite',
      '.cPostWriteEventWrapper._btnOpenWriteLayer',
      '[data-viewname="DPostFakeEditorView"]',
    ]

    for (const selector of writeButtonSelectors) {
      const btn = await page.$(selector)
      if (btn && await btn.isVisible()) {
        console.log(`Found and clicking: ${selector}`)
        await btn.click()
        break
      }
    }

    // 레이어가 열릴 때까지 대기
    await page.waitForTimeout(3000)
    await page.screenshot({ path: '/tmp/band-playwright-debug/debug-layer-opened.png' })
    console.log('Screenshot saved: debug-layer-opened.png')

    // 열린 레이어 분석
    console.log('\n=== Analyzing opened write layer ===')

    // 1. 모든 레이어 관련 요소 찾기
    const layerElements = await page.$$eval('*', els => {
      return els
        .filter(el => {
          const className = el.className?.toString() || ''
          const dataView = el.getAttribute?.('data-viewname') || ''
          return (
            className.includes('layer') ||
            className.includes('Layer') ||
            className.includes('modal') ||
            className.includes('Modal') ||
            className.includes('popup') ||
            className.includes('Popup') ||
            dataView.includes('Layer') ||
            dataView.includes('Write')
          )
        })
        .slice(0, 30)
        .map(el => ({
          tag: el.tagName,
          className: el.className?.toString().substring(0, 120),
          dataView: el.getAttribute?.('data-viewname'),
          id: el.id,
          visible: (el as HTMLElement).offsetParent !== null,
        }))
    })

    console.log('\n=== Layer-related elements ===')
    layerElements.forEach((el, i) => {
      if (el.visible) {
        console.log(`${i + 1}. <${el.tag}> class="${el.className}" data-viewname="${el.dataView}" visible=${el.visible}`)
      }
    })

    // 2. contenteditable 요소 모두 찾기
    const editableElements = await page.$$eval('[contenteditable]', els => {
      return els.map(el => {
        const rect = el.getBoundingClientRect()
        return {
          tag: el.tagName,
          className: el.className?.toString().substring(0, 100),
          contenteditable: el.getAttribute('contenteditable'),
          visible: (el as HTMLElement).offsetParent !== null,
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          parentClass: el.parentElement?.className?.toString().substring(0, 80),
          grandParentClass: el.parentElement?.parentElement?.className?.toString().substring(0, 80),
          dataView: el.closest('[data-viewname]')?.getAttribute('data-viewname'),
        }
      })
    })

    console.log('\n=== contenteditable elements ===')
    editableElements.forEach((el, i) => {
      console.log(`${i + 1}. <${el.tag}> contenteditable="${el.contenteditable}" visible=${el.visible}`)
      console.log(`   class: "${el.className}"`)
      console.log(`   parent: "${el.parentClass}"`)
      console.log(`   grandParent: "${el.grandParentClass}"`)
      console.log(`   closest data-viewname: "${el.dataView}"`)
      console.log(`   rect: ${JSON.stringify(el.rect)}`)
    })

    // 3. 글쓰기 버튼 찾기
    const submitButtons = await page.$$eval('button', btns => {
      return btns
        .filter(btn => {
          const className = btn.className || ''
          const text = btn.textContent || ''
          return (
            className.includes('submit') ||
            className.includes('Submit') ||
            className.includes('_btn') ||
            text.includes('올리기') ||
            text.includes('등록') ||
            text.includes('게시')
          )
        })
        .map(btn => ({
          className: btn.className,
          text: btn.textContent?.trim().substring(0, 30),
          disabled: btn.disabled,
          visible: btn.offsetParent !== null,
        }))
    })

    console.log('\n=== Submit-related buttons ===')
    submitButtons.forEach((btn, i) => {
      console.log(`${i + 1}. class="${btn.className}" text="${btn.text}" disabled=${btn.disabled} visible=${btn.visible}`)
    })

    // 4. 특정 셀렉터 테스트
    console.log('\n=== Testing specific selectors ===')
    const testSelectors = [
      '[data-viewname="DPostWriteLayerView"]',
      '[data-viewname="DPostWriteView"]',
      '.layerContainer .cPostWrite',
      '.uLayer .cPostWrite',
      '.cPostWrite:not(.-standby)',
      '.postWriteLayer',
      '.writeLayer',
      '.layerPop .cPostWrite',
      '.dPostWriteLayer',
      '.cPostWrite[data-viewname]',
      // 에디터 관련
      '.cPostWrite [contenteditable="true"]',
      '.postText [contenteditable="true"]',
      '.editor [contenteditable="true"]',
      '.writeBody [contenteditable="true"]',
      'div[contenteditable="true"]',
    ]

    for (const selector of testSelectors) {
      const el = await page.$(selector)
      if (el) {
        const isVisible = await el.isVisible().catch(() => false)
        const className = await el.getAttribute('class')
        console.log(`✓ ${selector} - visible: ${isVisible}, class: ${className?.substring(0, 60)}`)
      } else {
        console.log(`✗ ${selector} - not found`)
      }
    }

    // 5. 전체 HTML 구조 출력 (글쓰기 레이어 부분만)
    console.log('\n=== Write layer HTML structure ===')
    const writeLayerHTML = await page.evaluate(() => {
      // 다양한 셀렉터로 글쓰기 레이어 찾기
      const selectors = [
        '[data-viewname="DPostWriteLayerView"]',
        '[data-viewname="DPostWriteView"]',
        '.layerContainer',
        '.uLayer',
      ]

      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (el && (el as HTMLElement).offsetParent !== null) {
          return {
            selector: sel,
            outerHTML: el.outerHTML.substring(0, 3000),
          }
        }
      }
      return null
    })

    if (writeLayerHTML) {
      console.log(`Found write layer with: ${writeLayerHTML.selector}`)
      console.log(writeLayerHTML.outerHTML.substring(0, 2000))
    } else {
      console.log('Write layer HTML not found')
    }

  } finally {
    await browser.close()
    await prisma.$disconnect()
  }
}

main().catch(console.error)
