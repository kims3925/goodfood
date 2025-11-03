// 제이소매밴드 페이지 분석 및 글쓰기 버튼 찾기
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

class JayRetailBandDebugger {
  constructor() {
    this.sessionPath = './band-session.json'
    this.browser = null
    this.context = null
    this.page = null
  }

  // 기존 세션 로드
  loadExistingSession() {
    if (!fs.existsSync(this.sessionPath)) {
      console.log('❌ 세션 파일이 없습니다. 먼저 enhanced-band-automation.js를 실행하세요.')
      return null
    }

    try {
      const session = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'))
      console.log('✅ 기존 세션 로드 완료')
      return session
    } catch (error) {
      console.log('❌ 세션 파일 로드 실패:', error.message)
      return null
    }
  }

  // 브라우저 초기화 (세션 포함)
  async initBrowser(session) {
    this.browser = await chromium.launch({
      headless: false,
      slowMo: 500,
      args: ['--start-maximized']
    })

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      storageState: session // 세션 복원
    })

    this.page = await this.context.newPage()
  }

  // 제이소매밴드 페이지 상세 분석
  async analyzeJayRetailBand() {
    console.log('🔍 제이소매밴드 페이지 상세 분석 시작...')
    
    // 제이소매밴드 페이지로 이동
    console.log('🌐 제이소매밴드 접속 중...')
    await this.page.goto('https://www.band.us/page/99872677/post', { 
      waitUntil: 'networkidle',
      timeout: 30000
    })
    await this.page.waitForTimeout(5000)

    // 현재 URL 확인
    const currentUrl = this.page.url()
    console.log(`📍 현재 URL: ${currentUrl}`)

    // 페이지 제목 확인
    const pageTitle = await this.page.title()
    console.log(`📄 페이지 제목: ${pageTitle}`)

    // 로그인 상태 확인
    const loginButton = await this.page.$('button._loginBtn')
    if (loginButton) {
      console.log('❌ 로그인 버튼이 발견됨 - 로그인 상태가 아닐 수 있음')
      return false
    } else {
      console.log('✅ 로그인 상태 확인됨')
    }

    // 페이지 권한 확인 (밴드 멤버인지)
    const memberCheck = await this.page.$eval('body', () => {
      const text = document.body.textContent || ''
      return {
        isMember: !text.includes('가입하기') && !text.includes('비공개') && !text.includes('접근할 수 없습니다'),
        hasText: text.slice(0, 200)
      }
    }).catch(() => ({ isMember: false, hasText: '분석 실패' }))
    
    console.log('👥 멤버 상태:', memberCheck.isMember ? '멤버임' : '멤버가 아닐 수 있음')
    console.log('📝 페이지 텍스트 샘플:', memberCheck.hasText)

    // 모든 버튼 요소 분석
    console.log('\n🔍 모든 버튼 요소 분석...')
    const allButtons = await this.page.$$eval('button', buttons => 
      buttons.map((btn, index) => ({
        index: index,
        text: btn.textContent?.trim() || '',
        className: btn.className || '',
        id: btn.id || '',
        visible: btn.offsetParent !== null,
        disabled: btn.disabled,
        style: btn.style.display,
        dataRole: btn.getAttribute('data-role') || ''
      }))
    )

    console.log(`📊 총 ${allButtons.length}개 버튼 발견`)
    
    // 보이는 버튼만 필터링
    const visibleButtons = allButtons.filter(btn => btn.visible && btn.style !== 'none')
    console.log(`👁️ 보이는 버튼: ${visibleButtons.length}개`)

    // 글쓰기 관련 버튼 찾기
    const writeRelatedButtons = visibleButtons.filter(btn => {
      const text = btn.text.toLowerCase()
      const className = btn.className.toLowerCase()
      const dataRole = btn.dataRole.toLowerCase()
      
      return text.includes('글쓰기') || text.includes('작성') || text.includes('write') || text.includes('post') ||
             className.includes('write') || className.includes('post') || className.includes('create') ||
             dataRole.includes('write') || dataRole.includes('post')
    })

    console.log(`✏️ 글쓰기 관련 버튼: ${writeRelatedButtons.length}개`)
    
    if (writeRelatedButtons.length > 0) {
      console.log('\n📝 글쓰기 관련 버튼 상세:')
      writeRelatedButtons.forEach((btn, index) => {
        console.log(`${index + 1}. "${btn.text}" (클래스: ${btn.className})`)
        console.log(`   ID: ${btn.id}, 데이터 역할: ${btn.dataRole}`)
        console.log(`   비활성화: ${btn.disabled}`)
      })
    }

    // 상위 10개 보이는 버튼 정보
    console.log('\n📋 상위 10개 보이는 버튼:')
    visibleButtons.slice(0, 10).forEach((btn, index) => {
      console.log(`${index + 1}. "${btn.text}" (${btn.className})`)
    })

    // 모든 링크(a 태그) 분석
    console.log('\n🔗 링크 요소 분석...')
    const allLinks = await this.page.$$eval('a', links => 
      links.map(link => ({
        text: link.textContent?.trim() || '',
        href: link.href || '',
        className: link.className || '',
        visible: link.offsetParent !== null
      }))
    )

    const writeRelatedLinks = allLinks.filter(link => {
      const text = link.text.toLowerCase()
      const className = link.className.toLowerCase()
      const href = link.href.toLowerCase()
      
      return link.visible && (
        text.includes('글쓰기') || text.includes('작성') || text.includes('write') || text.includes('post') ||
        className.includes('write') || className.includes('post') ||
        href.includes('write') || href.includes('post')
      )
    })

    if (writeRelatedLinks.length > 0) {
      console.log(`🔗 글쓰기 관련 링크: ${writeRelatedLinks.length}개`)
      writeRelatedLinks.forEach((link, index) => {
        console.log(`${index + 1}. "${link.text}" (${link.href})`)
      })
    }

    // CSS 셀렉터로 특정 요소들 확인
    console.log('\n🎯 특정 셀렉터 확인...')
    const specificSelectors = [
      '#asideWrap > div > div.inner._sideScrollbar > div > div.pageLeftArea.gBoxShadow > div > div.buttons > button.roundButton.-full._btnWritePost',
      'button._btnWritePost',
      '.roundButton.-full._btnWritePost',
      'button[data-role="write-post"]',
      '.write-button',
      '#writePostBtn',
      '.post-write-btn'
    ]

    for (const selector of specificSelectors) {
      try {
        const element = await this.page.$(selector)
        if (element) {
          const isVisible = await element.isVisible()
          const text = await element.textContent()
          console.log(`✅ 발견: ${selector} - 텍스트: "${text}", 보임: ${isVisible}`)
        } else {
          console.log(`❌ 없음: ${selector}`)
        }
      } catch (error) {
        console.log(`⚠️ 오류: ${selector} - ${error.message}`)
      }
    }

    // 스크린샷 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await this.page.screenshot({ 
      path: `./screenshots/jay-retail-band-analysis-${timestamp}.png`, 
      fullPage: true 
    })
    console.log(`📸 분석 결과 스크린샷 저장됨`)

    return {
      url: currentUrl,
      title: pageTitle,
      loginStatus: !loginButton,
      memberStatus: memberCheck.isMember,
      totalButtons: allButtons.length,
      visibleButtons: visibleButtons.length,
      writeButtons: writeRelatedButtons,
      writeLinks: writeRelatedLinks
    }
  }

  // 리소스 정리
  async cleanup() {
    if (this.page) await this.page.close()
    if (this.context) await this.context.close()
    if (this.browser) await this.browser.close()
  }

  // 메인 실행 함수
  async run() {
    try {
      // 기존 세션 로드
      const session = this.loadExistingSession()
      if (!session) {
        return { success: false, error: '세션을 로드할 수 없습니다.' }
      }

      // 브라우저 초기화
      await this.initBrowser(session)

      // 제이소매밴드 분석
      const result = await this.analyzeJayRetailBand()

      console.log('\n📊 분석 결과 요약:')
      console.log('='.repeat(50))
      console.log(`🌐 URL: ${result.url}`)
      console.log(`📄 제목: ${result.title}`)
      console.log(`🔐 로그인 상태: ${result.loginStatus ? '로그인됨' : '로그인 필요'}`)
      console.log(`👥 멤버 상태: ${result.memberStatus ? '멤버임' : '멤버 아님'}`)
      console.log(`🔘 총 버튼: ${result.totalButtons}개`)
      console.log(`👁️ 보이는 버튼: ${result.visibleButtons}개`)
      console.log(`✏️ 글쓰기 버튼: ${result.writeButtons.length}개`)
      console.log(`🔗 글쓰기 링크: ${result.writeLinks.length}개`)

      if (result.writeButtons.length === 0 && result.writeLinks.length === 0) {
        console.log('\n⚠️ 글쓰기 버튼이나 링크를 찾을 수 없습니다.')
        console.log('🤔 가능한 원인:')
        console.log('   1. 밴드 멤버가 아닐 수 있음')
        console.log('   2. 글쓰기 권한이 없을 수 있음')
        console.log('   3. 페이지 구조가 변경되었을 수 있음')
        console.log('   4. 자바스크립트가 완전히 로드되지 않았을 수 있음')
      }

      // 5분간 브라우저 유지 (수동 확인용)
      console.log('\n⏰ 5분간 브라우저를 유지합니다. 수동으로 확인해보세요.')
      await new Promise(resolve => setTimeout(resolve, 300000))

      return { success: true, result }

    } catch (error) {
      console.error('❌ 분석 중 오류 발생:', error.message)
      return { success: false, error: error.message }
    } finally {
      await this.cleanup()
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  // 스크린샷 디렉토리 생성
  if (!fs.existsSync('./screenshots')) {
    fs.mkdirSync('./screenshots')
  }

  const analyzer = new JayRetailBandDebugger()
  
  analyzer.run()
    .then((result) => {
      console.log('\n🏁 분석 완료:', result.success ? '성공' : '실패')
      if (!result.success) {
        console.log('❌ 오류:', result.error)
      }
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error('\n💥 실행 오류:', error)
      process.exit(1)
    })
}

module.exports = JayRetailBandDebugger