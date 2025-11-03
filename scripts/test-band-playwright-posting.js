// Band Playwright 글쓰기 테스트 스크립트
const { chromium } = require('playwright')
require('dotenv').config({ path: '.env.local' })

// 테스트용 Base64 이미지 (작은 1x1 픽셀 투명 GIF)
const TEST_BASE64_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

async function testBandPlaywrightPosting() {
  let browser = null
  let context = null
  let page = null

  try {
    console.log('🎭 Playwright Band 글쓰기 테스트 시작...')
    
    // 캡차 방지를 위한 브라우저 실행 설정
    browser = await chromium.launch({
      headless: false, // 브라우저 화면을 보면서 테스트
      slowMo: 2000,    // 각 동작 사이에 2초 대기 (캡차 방지)
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    })
    
    // 캡차 방지를 위한 고급 컨텍스트 설정
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      permissions: ['geolocation'],
      geolocation: { latitude: 37.5665, longitude: 126.9780 }, // 서울 위치
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    })
    
    // 자동화 감지 방지 스크립트 주입
    await context.addInitScript(() => {
      // webdriver 속성 제거
      delete navigator.__proto__.webdriver
      
      // 플러그인 추가
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      })
      
      // 언어 설정
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en']
      })
      
      // 권한 API 모킹
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      )
    })
    
    page = await context.newPage()
    
    // 1. 킹도매방 밴드 페이지로 이동
    console.log('📍 킹도매방 밴드 페이지 이동...')
    const bandUrl = 'https://www.band.us/band/82610152'
    await page.goto(bandUrl, { waitUntil: 'networkidle' })
    
    // 2. 로그인 상태 확인 및 로그인 진행
    await handleLogin(page)
    
    // 3. 글쓰기 모드 진입
    console.log('✏️ 글쓰기 모드 진입...')
    await enterWriteMode(page)
    
    // 4. 첫 번째 게시물: 간단한 텍스트
    console.log('📝 첫 번째 게시물: 간단한 텍스트...')
    await postSimpleText(page)
    
    // 5. 잠시 대기 후 두 번째 게시물
    console.log('⏰ 15초 대기 후 다음 게시물...')
    await page.waitForTimeout(15000)
    
    // 6. 두 번째 게시물: HTML 이미지 포함
    console.log('🖼️ 두 번째 게시물: HTML 이미지 포함...')
    await postWithImage(page)
    
    console.log('✅ Playwright Band 글쓰기 테스트 완료!')
    
  } catch (error) {
    console.error('❌ Playwright 테스트 오류:', error)
    
    if (page) {
      // 오류 발생 시 스크린샷 저장
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const screenshotPath = `./screenshots/band-playwright-error-${timestamp}.png`
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`📸 오류 스크린샷 저장: ${screenshotPath}`)
    }
  } finally {
    // 정리
    if (page) await page.close()
    if (context) await context.close()
    if (browser) await browser.close()
  }
}

async function handleLogin(page) {
  try {
    console.log('🔐 로그인 상태 확인...')
    
    // 로그인 버튼이 있는지 확인 (로그인 안된 상태)
    const loginButton = await page.$('.uBandLogin, [data-viewname="login"], .login-btn')
    
    if (loginButton) {
      console.log('❌ 로그인이 필요합니다.')
      console.log('👆 브라우저에서 수동으로 로그인을 진행해주세요.')
      console.log('⏰ 30초 대기 중...')
      
      // 사용자가 수동으로 로그인할 시간 제공
      await page.waitForTimeout(30000)
      
      // 로그인 완료 확인
      const isLoggedIn = await page.$('.uBandLogin') === null
      if (!isLoggedIn) {
        throw new Error('로그인이 완료되지 않았습니다.')
      }
    }
    
    console.log('✅ 로그인 상태 확인됨')
    
  } catch (error) {
    console.error('로그인 처리 오류:', error)
    throw error
  }
}

async function enterWriteMode(page) {
  try {
    // 페이지 로딩 대기 (캡차 방지를 위해 충분히 대기)
    await page.waitForTimeout(3000)
    
    console.log('📋 페이지 구조 분석 중...')
    
    // 모든 버튼과 클릭 가능한 요소들을 찾아서 분석
    const allButtons = await page.$$('button, a, div[role="button"], span[role="button"], [onclick]')
    console.log(`🔍 발견된 클릭 가능한 요소: ${allButtons.length}개`)
    
    // 글쓰기 관련 키워드로 검색
    const writeKeywords = ['글쓰기', '글 쓰기', '포스팅', '글 올리기', '게시', 'write', 'post']
    let writeButton = null
    
    // 1차: 명확한 선택자들로 검색
    const writeSelectors = [
      '.writeButton',
      '.write-button', 
      '[data-viewname="writeButton"]',
      '.band-write-button',
      '.post-write-btn',
      '.btnWrite',
      '.write_btn',
      '.btn-write',
      '#writeButton',
      'button[class*="write"]',
      'div[class*="write"][role="button"]',
      '.floating-write-btn'
    ]
    
    for (const selector of writeSelectors) {
      try {
        const element = await page.$(selector)
        if (element) {
          const isVisible = await element.isVisible()
          if (isVisible) {
            console.log(`📝 글쓰기 버튼 발견 (선택자): ${selector}`)
            writeButton = element
            break
          }
        }
      } catch (e) {
        // 선택자 오류 무시
      }
    }
    
    // 2차: 텍스트 기반으로 검색
    if (!writeButton) {
      console.log('🔍 텍스트 기반으로 글쓰기 버튼 검색...')
      for (const keyword of writeKeywords) {
        try {
          const elements = await page.$$(`:text("${keyword}")`)
          for (const element of elements) {
            const tagName = await element.evaluate(el => el.tagName)
            const isClickable = ['BUTTON', 'A', 'DIV', 'SPAN'].includes(tagName)
            const isVisible = await element.isVisible()
            
            if (isClickable && isVisible) {
              console.log(`📝 글쓰기 버튼 발견 (텍스트): "${keyword}"`)
              writeButton = element
              break
            }
          }
          if (writeButton) break
        } catch (e) {
          // 검색 오류 무시
        }
      }
    }
    
    // 3차: 플로팅 버튼이나 고정 위치 버튼 검색
    if (!writeButton) {
      console.log('🔍 플로팅/고정 버튼 검색...')
      const floatingSelectors = [
        '[class*="float"]',
        '[class*="fixed"]',
        '[style*="position: fixed"]',
        '[style*="position: absolute"]',
        '.fab', // Floating Action Button
        '.floating-btn'
      ]
      
      for (const selector of floatingSelectors) {
        try {
          const elements = await page.$$(selector)
          for (const element of elements) {
            const text = await element.textContent()
            const hasWriteKeyword = writeKeywords.some(keyword => 
              text && text.toLowerCase().includes(keyword.toLowerCase())
            )
            
            if (hasWriteKeyword) {
              const isVisible = await element.isVisible()
              if (isVisible) {
                console.log(`📝 플로팅 글쓰기 버튼 발견: ${selector}`)
                writeButton = element
                break
              }
            }
          }
          if (writeButton) break
        } catch (e) {
          // 검색 오류 무시
        }
      }
    }
    
    if (!writeButton) {
      // 디버깅을 위한 상세 정보 수집
      console.log('🔍 페이지 상세 분석...')
      const pageInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'))
        return buttons.slice(0, 10).map(btn => ({
          tagName: btn.tagName,
          className: btn.className,
          textContent: btn.textContent?.trim().slice(0, 50),
          visible: btn.offsetParent !== null
        }))
      })
      
      console.log('상위 10개 버튼:', JSON.stringify(pageInfo, null, 2))
      
      // 페이지 스크린샷으로 디버깅
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const screenshotPath = `./screenshots/band-no-write-button-${timestamp}.png`
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`📸 디버깅 스크린샷 저장: ${screenshotPath}`)
      
      throw new Error('글쓰기 버튼을 찾을 수 없습니다.')
    }
    
    // 버튼 클릭 (자연스럽게)
    await writeButton.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000) // 스크롤 완료 대기
    
    // 마우스 호버 후 클릭 (더 자연스럽게)
    await writeButton.hover()
    await page.waitForTimeout(500)
    await writeButton.click()
    await page.waitForTimeout(3000) // 글쓰기 모드 로딩 대기
    
    console.log('✅ 글쓰기 모드 진입 완료')
    
  } catch (error) {
    console.error('글쓰기 모드 진입 오류:', error)
    throw error
  }
}

async function postSimpleText(page) {
  try {
    const content = `pl: 간단한 테스트 게시물

이것은 Playwright를 사용한 자동 글쓰기 테스트입니다.

테스트 시간: ${new Date().toLocaleString('ko-KR')}`

    // 텍스트 입력 영역 찾기
    const textSelectors = [
      'textarea[name="content"]',
      '.write-textarea',
      '.post-content',
      'textarea.uio-textfield',
      '[contenteditable="true"]',
      '.contentEditable'
    ]
    
    let textArea = null
    for (const selector of textSelectors) {
      try {
        textArea = await page.$(selector)
        if (textArea) {
          console.log(`📝 텍스트 입력 영역 발견: ${selector}`)
          break
        }
      } catch (e) {
        // 선택자가 올바르지 않은 경우 무시
      }
    }
    
    if (!textArea) {
      await page.screenshot({ path: './screenshots/band-no-textarea.png', fullPage: true })
      throw new Error('텍스트 입력 영역을 찾을 수 없습니다.')
    }
    
    // 텍스트 입력
    await textArea.fill(content)
    await page.waitForTimeout(1000)
    
    // 게시 버튼 클릭
    await clickPublishButton(page)
    
    console.log('✅ 간단한 텍스트 게시물 작성 완료')
    
  } catch (error) {
    console.error('텍스트 게시물 작성 오류:', error)
    throw error
  }
}

async function postWithImage(page) {
  try {
    // 새 글쓰기 모드로 다시 진입
    await enterWriteMode(page)
    
    const content = `pl: HTML 이미지 테스트 게시물

이것은 Playwright를 사용한 이미지 포함 테스트입니다.

<img src="${TEST_BASE64_IMAGE}" alt="테스트 이미지" width="50" height="50" />

HTML 이미지 태그가 정상적으로 표시되는지 확인합니다.

테스트 시간: ${new Date().toLocaleString('ko-KR')}`

    // 텍스트 입력
    const textArea = await page.$('textarea[name="content"], .write-textarea, [contenteditable="true"]')
    if (!textArea) {
      throw new Error('두 번째 게시물용 텍스트 입력 영역을 찾을 수 없습니다.')
    }
    
    await textArea.fill(content)
    await page.waitForTimeout(1000)
    
    // 게시 버튼 클릭
    await clickPublishButton(page)
    
    console.log('✅ HTML 이미지 포함 게시물 작성 완료')
    
  } catch (error) {
    console.error('이미지 게시물 작성 오류:', error)
    throw error
  }
}

async function clickPublishButton(page) {
  try {
    // 게시 버튼 찾기
    const publishSelectors = [
      '.publish-button',
      '.post-button',
      'button:has-text("등록")',
      'button:has-text("게시")',
      'button:has-text("올리기")',
      '.btnSubmit',
      '.uio-btn-confirm',
      '[data-viewname="publishButton"]'
    ]
    
    let publishButton = null
    for (const selector of publishSelectors) {
      try {
        publishButton = await page.$(selector)
        if (publishButton) {
          console.log(`📤 게시 버튼 발견: ${selector}`)
          break
        }
      } catch (e) {
        // 선택자가 올바르지 않은 경우 무시
      }
    }
    
    if (!publishButton) {
      await page.screenshot({ path: './screenshots/band-no-publish-button.png', fullPage: true })
      throw new Error('게시 버튼을 찾을 수 없습니다.')
    }
    
    await publishButton.click()
    await page.waitForTimeout(3000) // 게시 완료 대기
    
    console.log('📤 게시물 업로드 완료')
    
  } catch (error) {
    console.error('게시 버튼 클릭 오류:', error)
    throw error
  }
}

// 스크린샷 디렉토리 생성
const fs = require('fs')
if (!fs.existsSync('./screenshots')) {
  fs.mkdirSync('./screenshots')
}

// 스크립트 실행
if (require.main === module) {
  testBandPlaywrightPosting()
    .then(() => {
      console.log('\n🏁 Band Playwright 글쓰기 테스트 완료')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 테스트 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = { testBandPlaywrightPosting }