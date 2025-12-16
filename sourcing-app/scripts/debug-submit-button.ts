// @ts-nocheck
/**
 * Band 게시 버튼 상태 분석 스크립트
 * 게시 버튼이 클릭되지 않는 원인 파악
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

  const browser = await chromium.launch({ headless: false }) // headful로 실행해서 실제 동작 확인
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
    // Band 밴드 페이지로 직접 이동
    const bandUrl = `https://band.us/band/${channel.channelKey}`
    console.log(`Navigating to ${bandUrl}`)
    await page.goto(bandUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)

    // 페이지 상단으로 스크롤
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1000)

    // 글쓰기 버튼 클릭
    console.log('\n=== Opening write layer ===')
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

    // 에디터에 텍스트 입력
    console.log('\n=== Typing content ===')
    const editorSelectors = [
      '.cPostWrite [contenteditable="true"].cke_editable',
      '[data-viewname="DPostEditorView"] [contenteditable="true"]',
      '.contentEditor._richEditor[contenteditable="true"]',
    ]

    let editor = null
    for (const selector of editorSelectors) {
      editor = await page.$(selector)
      if (editor && await editor.isVisible()) {
        console.log(`Found editor: ${selector}`)
        await editor.click()
        await page.keyboard.type('테스트 게시물입니다. 자동 삭제됩니다.', { delay: 50 })
        break
      }
    }

    await page.waitForTimeout(2000)

    // 게시 버튼 상태 분석
    console.log('\n=== Analyzing submit button ===')

    const submitButtonInfo = await page.evaluate(() => {
      const btn = document.querySelector('button._btnSubmitPost') as HTMLButtonElement
      if (!btn) return { found: false }

      const rect = btn.getBoundingClientRect()
      const style = window.getComputedStyle(btn)

      return {
        found: true,
        visible: btn.offsetParent !== null,
        disabled: btn.disabled,
        className: btn.className,
        text: btn.textContent?.trim(),
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        style: {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          zIndex: style.zIndex,
        },
        // 버튼 위에 다른 요소가 있는지 확인
        elementAtPoint: (() => {
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2
          const el = document.elementFromPoint(centerX, centerY)
          return {
            tagName: el?.tagName,
            className: el?.className?.toString().substring(0, 100),
            isButton: el === btn,
          }
        })(),
      }
    })

    console.log('Submit button info:', JSON.stringify(submitButtonInfo, null, 2))

    // 게시 버튼이 활성화되어 있는지 확인
    const submitBtn = await page.$('button._btnSubmitPost')
    if (submitBtn) {
      const isEnabled = await submitBtn.isEnabled()
      const isVisible = await submitBtn.isVisible()
      console.log(`\nPlaywright check: enabled=${isEnabled}, visible=${isVisible}`)

      if (isEnabled) {
        console.log('\n=== Attempting to click submit button ===')

        // 클릭 전 스크린샷
        await page.screenshot({ path: '/tmp/band-playwright-debug/debug-before-submit.png' })

        // 방법 1: 일반 클릭
        console.log('Method 1: Normal click')
        await submitBtn.click()
        await page.waitForTimeout(2000)

        // 상태 확인
        const contentAfter1 = await page.$eval(
          '.cPostWrite [contenteditable="true"]',
          (el) => el.textContent?.trim() || ''
        ).catch(() => 'not found')
        console.log(`After method 1 - content: "${contentAfter1.substring(0, 30)}..."`)

        if (contentAfter1.length > 10) {
          // 내용이 남아있으면 다른 방법 시도
          console.log('\nMethod 2: Force click via JavaScript')
          await page.evaluate(() => {
            const btn = document.querySelector('button._btnSubmitPost') as HTMLButtonElement
            if (btn) {
              btn.click()
              // 이벤트도 직접 발생
              btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
            }
          })
          await page.waitForTimeout(2000)

          const contentAfter2 = await page.$eval(
            '.cPostWrite [contenteditable="true"]',
            (el) => el.textContent?.trim() || ''
          ).catch(() => 'not found')
          console.log(`After method 2 - content: "${contentAfter2.substring(0, 30)}..."`)

          if (contentAfter2.length > 10) {
            console.log('\nMethod 3: Focus and Enter key')
            await submitBtn.focus()
            await page.keyboard.press('Enter')
            await page.waitForTimeout(2000)

            const contentAfter3 = await page.$eval(
              '.cPostWrite [contenteditable="true"]',
              (el) => el.textContent?.trim() || ''
            ).catch(() => 'not found')
            console.log(`After method 3 - content: "${contentAfter3.substring(0, 30)}..."`)

            if (contentAfter3.length > 10) {
              console.log('\nMethod 4: Click with force option')
              await submitBtn.click({ force: true })
              await page.waitForTimeout(2000)

              const contentAfter4 = await page.$eval(
                '.cPostWrite [contenteditable="true"]',
                (el) => el.textContent?.trim() || ''
              ).catch(() => 'not found')
              console.log(`After method 4 - content: "${contentAfter4.substring(0, 30)}..."`)
            }
          }
        }

        // 클릭 후 스크린샷
        await page.screenshot({ path: '/tmp/band-playwright-debug/debug-after-submit.png' })
      }
    }

    // 잠시 대기 후 브라우저 닫기
    console.log('\n=== Waiting 10 seconds before closing ===')
    await page.waitForTimeout(10000)

  } finally {
    await browser.close()
    await prisma.$disconnect()
  }
}

main().catch(console.error)
