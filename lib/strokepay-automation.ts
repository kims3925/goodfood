import { chromium, Browser, BrowserContext, Page } from 'playwright'

export class StrokePayAutomation {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private isRecording = false
  private recordedSteps: any[] = []

  constructor() {
    this.setupEventListeners()
  }

  // 브라우저 시작 (헤드리스가 아닌 모드로 실행하여 사용자가 볼 수 있게)
  async startBrowser(options: { headless?: boolean } = {}) {
    try {
      console.log('🚀 브라우저 시작 중...')
      
      this.browser = await chromium.launch({
        headless: options.headless || false, // 기본적으로 화면을 보여줌
        slowMo: 100, // 동작을 느리게 하여 관찰 가능
        args: [
          '--start-maximized',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      })

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 }
      })

      this.page = await this.context.newPage()
      
      // 사용자 인터렉션 추적 시작
      await this.setupUserInteractionTracking()
      
      console.log('✅ 브라우저 시작 완료')
      return this.page
    } catch (error) {
      console.error('❌ 브라우저 시작 실패:', error)
      throw error
    }
  }

  // 스룩페이 로그인 페이지로 이동
  async navigateToLogin() {
    if (!this.page) {
      throw new Error('브라우저가 시작되지 않았습니다.')
    }

    try {
      console.log('🌐 스룩페이 로그인 페이지로 이동 중...')
      
      await this.page.goto('https://srookpay.com/member/login?ReturnUrl=%2fmember%2fadmin', {
        waitUntil: 'networkidle',
        timeout: 30000
      })
      
      console.log('✅ 로그인 페이지 로드 완료')
      
      // 페이지가 완전히 로드될 때까지 잠시 대기
      await this.page.waitForTimeout(2000)
      
      return true
    } catch (error) {
      console.error('❌ 로그인 페이지 이동 실패:', error)
      throw error
    }
  }

  // 사용자 인터렉션 추적 설정
  private async setupUserInteractionTracking() {
    if (!this.page) return

    console.log('🎯 사용자 인터렉션 추적 시작...')

    // 모든 클릭 이벤트 추적
    await this.page.addInitScript(() => {
      window.addEventListener('click', (event) => {
        const target = event.target as HTMLElement
        const info = {
          type: 'click',
          timestamp: Date.now(),
          selector: generateSelector(target),
          tagName: target.tagName,
          id: target.id || null,
          className: target.className || null,
          textContent: target.textContent?.trim().slice(0, 50) || null,
          coordinates: { x: event.clientX, y: event.clientY }
        }
        
        // 콘솔에 출력하여 개발자가 확인할 수 있게
        console.log('🖱️ CLICK:', info)
        
        // 전역 변수에 저장
        if (!window.recordedActions) window.recordedActions = []
        window.recordedActions.push(info)
      })

      // 입력 이벤트 추적
      window.addEventListener('input', (event) => {
        const target = event.target as HTMLElement
        const info = {
          type: 'input',
          timestamp: Date.now(),
          selector: generateSelector(target),
          tagName: target.tagName,
          id: target.id || null,
          className: target.className || null,
          value: (target as HTMLInputElement).value
        }
        
        console.log('⌨️ INPUT:', info)
        
        if (!window.recordedActions) window.recordedActions = []
        window.recordedActions.push(info)
      })

      // 키보드 이벤트 추적
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === 'Tab') {
          const info = {
            type: 'keydown',
            timestamp: Date.now(),
            key: event.key,
            selector: generateSelector(event.target as HTMLElement)
          }
          
          console.log('⌨️ KEYDOWN:', info)
          
          if (!window.recordedActions) window.recordedActions = []
          window.recordedActions.push(info)
        }
      })

      // 페이지 이동 추적
      let currentUrl = window.location.href
      const observer = new MutationObserver(() => {
        if (window.location.href !== currentUrl) {
          currentUrl = window.location.href
          const info = {
            type: 'navigation',
            timestamp: Date.now(),
            url: currentUrl
          }
          
          console.log('🌐 NAVIGATION:', info)
          
          if (!window.recordedActions) window.recordedActions = []
          window.recordedActions.push(info)
        }
      })
      observer.observe(document, { childList: true, subtree: true })

      // 셀렉터 생성 함수
      function generateSelector(element: HTMLElement): string {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
          return ''
        }

        // ID가 있으면 ID 사용
        if (element.id) {
          return `#${element.id}`
        }

        // 고유한 클래스 조합 찾기
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.trim().split(/\s+/).filter(c => c.length > 0)
          if (classes.length > 0) {
            const classSelector = `.${classes.join('.')}`
            // 고유성 체크 (같은 셀렉터가 여러 개인지 확인)
            if (document.querySelectorAll(classSelector).length === 1) {
              return classSelector
            }
          }
        }

        // name 속성 사용
        const name = element.getAttribute('name')
        if (name) {
          return `[name="${name}"]`
        }

        // data 속성 사용
        const dataAttributes = Array.from(element.attributes)
          .filter(attr => attr.name.startsWith('data-'))
          .map(attr => `[${attr.name}="${attr.value}"]`)
        
        if (dataAttributes.length > 0) {
          return dataAttributes[0]
        }

        // 부모 기준 경로 생성
        const parent = element.parentElement
        if (parent) {
          const parentSelector = generateSelector(parent)
          const tagName = element.tagName.toLowerCase()
          const siblings = Array.from(parent.children).filter(
            child => child.tagName.toLowerCase() === tagName
          )
          
          if (siblings.length === 1) {
            return `${parentSelector} > ${tagName}`
          } else {
            const index = siblings.indexOf(element) + 1
            return `${parentSelector} > ${tagName}:nth-child(${index})`
          }
        }

        return element.tagName.toLowerCase()
      }
    })

    // 전역 타입 선언 추가
    await this.page.addInitScript(() => {
      declare global {
        interface Window {
          recordedActions: any[]
        }
      }
    })
  }

  // 기록된 액션들 가져오기
  async getRecordedActions() {
    if (!this.page) return []

    try {
      const actions = await this.page.evaluate(() => {
        return window.recordedActions || []
      })
      
      console.log(`📋 기록된 액션 ${actions.length}개 가져옴`)
      return actions
    } catch (error) {
      console.error('❌ 액션 가져오기 실패:', error)
      return []
    }
  }

  // 기록된 액션들을 기반으로 자동화 스크립트 생성
  async generateAutomationScript(actions: any[]) {
    console.log('🤖 자동화 스크립트 생성 중...')
    
    let script = `// 스룩페이 자동화 스크립트 (생성일: ${new Date().toLocaleString()})\n\n`
    script += `async function runStrokePayAutomation(page) {\n`
    script += `  try {\n`
    script += `    console.log('🚀 스룩페이 자동화 시작')\n\n`
    
    // 로그인 페이지로 이동
    script += `    // 로그인 페이지로 이동\n`
    script += `    await page.goto('https://srookpay.com/member/login?ReturnUrl=%2fmember%2fadmin', {\n`
    script += `      waitUntil: 'networkidle',\n`
    script += `      timeout: 30000\n`
    script += `    })\n`
    script += `    await page.waitForTimeout(2000)\n\n`

    // 각 액션을 스크립트로 변환
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      
      switch (action.type) {
        case 'click':
          script += `    // 클릭: ${action.textContent || action.tagName}\n`
          script += `    await page.click('${action.selector}', { timeout: 10000 })\n`
          script += `    await page.waitForTimeout(1000)\n\n`
          break
          
        case 'input':
          script += `    // 입력: ${action.id || action.selector}\n`
          script += `    await page.fill('${action.selector}', '${action.value}')\n`
          script += `    await page.waitForTimeout(500)\n\n`
          break
          
        case 'keydown':
          if (action.key === 'Enter') {
            script += `    // Enter 키 입력\n`
            script += `    await page.keyboard.press('Enter')\n`
            script += `    await page.waitForTimeout(2000)\n\n`
          }
          break
          
        case 'navigation':
          script += `    // 페이지 이동 대기: ${action.url}\n`
          script += `    await page.waitForURL('${action.url}', { timeout: 30000 })\n`
          script += `    await page.waitForTimeout(2000)\n\n`
          break
      }
    }
    
    script += `    console.log('✅ 자동화 완료')\n`
    script += `  } catch (error) {\n`
    script += `    console.error('❌ 자동화 실행 중 오류:', error)\n`
    script += `    throw error\n`
    script += `  }\n`
    script += `}\n\n`
    script += `module.exports = { runStrokePayAutomation }`
    
    return script
  }

  // 자동화 스크립트 저장
  async saveAutomationScript(script: string, filename: string = 'strokepay-automation-script.js') {
    const fs = require('fs')
    const path = require('path')
    
    const filePath = path.join(process.cwd(), 'scripts', filename)
    fs.writeFileSync(filePath, script, 'utf8')
    
    console.log(`💾 자동화 스크립트 저장됨: ${filePath}`)
    return filePath
  }

  // 엑셀 파일 업로드 (파일 경로를 받아서 업로드)
  async uploadExcelFile(filePath: string, inputSelector: string) {
    if (!this.page) {
      throw new Error('브라우저가 시작되지 않았습니다.')
    }

    try {
      console.log(`📤 엑셀 파일 업로드 중: ${filePath}`)
      
      // 파일 선택 input 요소에 파일 설정
      const fileInput = await this.page.$(inputSelector)
      if (fileInput) {
        await fileInput.setInputFiles(filePath)
        console.log('✅ 파일 업로드 완료')
      } else {
        throw new Error(`파일 입력 요소를 찾을 수 없음: ${inputSelector}`)
      }
    } catch (error) {
      console.error('❌ 파일 업로드 실패:', error)
      throw error
    }
  }

  // 브라우저 종료
  async closeBrowser() {
    try {
      if (this.context) {
        await this.context.close()
      }
      if (this.browser) {
        await this.browser.close()
      }
      console.log('🔚 브라우저 종료 완료')
    } catch (error) {
      console.error('❌ 브라우저 종료 실패:', error)
    }
  }

  // 이벤트 리스너 설정
  private setupEventListeners() {
    // 프로세스 종료 시 브라우저도 종료
    process.on('SIGINT', async () => {
      console.log('🛑 프로세스 종료 신호 받음, 브라우저 종료 중...')
      await this.closeBrowser()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      console.log('🛑 프로세스 종료 신호 받음, 브라우저 종료 중...')
      await this.closeBrowser()
      process.exit(0)
    })
  }

  // 현재 페이지 스크린샷 저장
  async takeScreenshot(filename?: string) {
    if (!this.page) return null

    try {
      const screenshotPath = filename || `screenshot_${Date.now()}.png`
      await this.page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`📸 스크린샷 저장됨: ${screenshotPath}`)
      return screenshotPath
    } catch (error) {
      console.error('❌ 스크린샷 저장 실패:', error)
      return null
    }
  }
}

export default StrokePayAutomation