/**
 * 밴드 OAuth 재인증 자동화 스크립트
 * Playwright를 사용하여 OAuth 인증을 자동으로 진행하고 새로운 토큰을 획득합니다.
 */

import { chromium, Browser, Page } from 'playwright'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// .env.local 파일 로드
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

interface AuthConfig {
  clientId: string
  redirectUri: string
  naverEmail?: string  // 선택사항: 자동 로그인용
  naverPassword?: string  // 선택사항: 자동 로그인용
}

interface AuthResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  scope?: string
  error?: string
}

export class BandOAuthAutomation {
  private browser: Browser | null = null
  private page: Page | null = null
  private config: AuthConfig

  constructor(config: AuthConfig) {
    this.config = config
  }

  /**
   * OAuth 재인증 프로세스 시작
   */
  async reAuthenticate(): Promise<AuthResult> {
    try {
      console.log('🚀 밴드 OAuth 재인증 자동화 시작...')
      
      // 브라우저 시작
      await this.initBrowser()
      
      // 1단계: OAuth 인증 페이지로 이동
      const authUrl = this.generateAuthUrl()
      console.log('📍 인증 URL:', authUrl)
      
      await this.page!.goto(authUrl)
      console.log('✅ OAuth 인증 페이지 로드 완료')

      // 2단계: 네이버 로그인 감지 및 대기
      await this.waitForNaverLogin()
      
      // 3단계: 권한 허가 페이지 처리
      await this.handlePermissionGrant()
      
      // 4단계: 콜백에서 토큰 추출
      const authResult = await this.extractTokenFromCallback()
      
      await this.cleanup()
      
      if (authResult.success) {
        console.log('🎉 OAuth 재인증 성공!')
        console.log('🔑 새로운 액세스 토큰 획득:', authResult.accessToken?.substring(0, 20) + '...')
        
        // .env.local 파일 자동 업데이트
        await this.updateEnvironmentFile(authResult.accessToken!)
      }
      
      return authResult
      
    } catch (error) {
      console.error('❌ OAuth 재인증 실패:', error)
      await this.cleanup()
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 브라우저 초기화
   */
  private async initBrowser() {
    this.browser = await chromium.launch({
      headless: false,  // 사용자가 직접 로그인할 수 있도록 브라우저 표시
      slowMo: 1000,     // 느린 실행으로 디버깅 용이
    })

    this.page = await this.browser.newPage()
    
    // 한국어 설정
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
    })
  }

  /**
   * OAuth 인증 URL 생성
   */
  private generateAuthUrl(): string {
    const authUrl = new URL('https://auth.band.us/oauth2/authorize')
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('client_id', this.config.clientId)
    authUrl.searchParams.append('redirect_uri', this.config.redirectUri)
    
    return authUrl.toString()
  }

  /**
   * 네이버 로그인 대기 및 처리
   */
  private async waitForNaverLogin() {
    console.log('🔐 네이버 로그인 페이지 대기 중...')
    
    try {
      // 네이버 로그인 페이지 요소 대기
      await this.page!.waitForSelector('#id', { timeout: 10000 })
      console.log('📧 네이버 로그인 페이지 감지됨')
      
      // 자동 로그인 정보가 있으면 시도
      if (this.config.naverEmail && this.config.naverPassword) {
        console.log('🔑 자동 로그인 시도 중...')
        
        await this.page!.fill('#id', this.config.naverEmail)
        await this.page!.fill('#pw', this.config.naverPassword)
        await this.page!.click('.btn_login')
        
        // 로그인 완료 대기
        await this.page!.waitForTimeout(3000)
      } else {
        console.log('👤 수동 로그인을 위해 대기 중...')
        console.log('📌 브라우저에서 네이버 계정으로 로그인해주세요.')
        
        // 로그인 완료까지 대기 (URL 변경 감지)
        await this.page!.waitForFunction(
          () => !window.location.href.includes('nid.naver.com'),
          { timeout: 180000 } // 3분 대기
        )
      }
      
      console.log('✅ 네이버 로그인 완료')
      
    } catch (error) {
      console.log('ℹ️ 네이버 로그인 페이지가 나타나지 않음 (이미 로그인된 상태일 수 있음)')
    }
  }

  /**
   * 권한 허가 페이지 처리
   */
  private async handlePermissionGrant() {
    console.log('🔒 권한 허가 페이지 확인 중...')
    
    try {
      // 권한 허가 버튼 대기 및 클릭
      const allowButton = await this.page!.waitForSelector('button:has-text("허용"), input[value*="허용"], .btn_allow, [id*="allow"]', {
        timeout: 30000 // 30초로 증가
      })
      
      if (allowButton) {
        console.log('✅ 권한 허가 버튼 발견')
        await allowButton.click()
        console.log('🔓 권한 허가 완료')
      }
      
    } catch (error) {
      console.log('ℹ️ 권한 허가 페이지가 나타나지 않음 (이미 허가된 상태일 수 있음)')
    }
    
    // 콜백 URL로 리다이렉트 대기
    console.log('🔄 콜백 URL 리다이렉트 대기 중...')
    console.log('⏰ 1분 30초 동안 대기합니다...')
    await this.page!.waitForFunction(
      (redirectUri) => window.location.href.startsWith(redirectUri),
      this.config.redirectUri,
      { timeout: 90000 } // 1분 30초 대기
    )
  }

  /**
   * 콜백에서 토큰 추출
   */
  private async extractTokenFromCallback(): Promise<AuthResult> {
    console.log('🔍 콜백 응답에서 토큰 추출 중...')
    
    const currentUrl = this.page!.url()
    console.log('📍 현재 URL:', currentUrl)
    
    // URL에서 인증 코드 추출
    const urlParams = new URLSearchParams(new URL(currentUrl).search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')
    
    if (error) {
      return {
        success: false,
        error: `OAuth 에러: ${error} - ${urlParams.get('error_description')}`
      }
    }
    
    if (!code) {
      return {
        success: false,
        error: '인증 코드를 찾을 수 없습니다.'
      }
    }
    
    console.log('🔑 인증 코드 추출 성공:', code.substring(0, 10) + '...')
    
    // 페이지에서 JSON 응답 확인 (콜백 API가 JSON 응답을 했을 경우)
    try {
      const pageContent = await this.page!.content()
      
      // JSON 응답 파싱 시도
      if (pageContent.includes('access_token')) {
        const jsonMatch = pageContent.match(/\{[^}]*"access_token"[^}]*\}/g)
        if (jsonMatch) {
          const tokenData = JSON.parse(jsonMatch[0])
          return {
            success: true,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
            scope: tokenData.scope
          }
        }
      }
    } catch (error) {
      console.log('ℹ️ 페이지에서 직접 토큰을 추출할 수 없음, API 호출로 토큰 교환 시도')
    }
    
    // API를 통한 토큰 교환
    return await this.exchangeCodeForToken(code)
  }

  /**
   * 인증 코드를 액세스 토큰으로 교환
   */
  private async exchangeCodeForToken(code: string): Promise<AuthResult> {
    console.log('🔄 인증 코드를 액세스 토큰으로 교환 중...')
    
    try {
      const clientSecret = process.env.BAND_CLIENT_SECRET
      if (!clientSecret) {
        throw new Error('BAND_CLIENT_SECRET가 설정되지 않았습니다.')
      }
      
      const basicAuth = Buffer.from(`${this.config.clientId}:${clientSecret}`).toString('base64')
      
      const response = await fetch('https://auth.band.us/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`토큰 교환 실패: HTTP ${response.status} - ${errorText}`)
      }
      
      const tokenData = await response.json()
      
      if (tokenData.error) {
        throw new Error(`토큰 교환 에러: ${tokenData.error} - ${tokenData.error_description}`)
      }
      
      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * .env.local 파일 업데이트
   */
  private async updateEnvironmentFile(accessToken: string) {
    try {
      const envPath = path.join(process.cwd(), '.env.local')
      const envContent = await fs.readFile(envPath, 'utf-8')
      
      // BAND_ACCESS_TOKEN 줄 찾기 및 교체
      const updatedContent = envContent.replace(
        /BAND_ACCESS_TOKEN="[^"]*"/,
        `BAND_ACCESS_TOKEN="${accessToken}"`
      )
      
      await fs.writeFile(envPath, updatedContent, 'utf-8')
      console.log('💾 .env.local 파일이 새로운 토큰으로 업데이트되었습니다.')
      
    } catch (error) {
      console.error('❌ .env.local 파일 업데이트 실패:', error)
    }
  }

  /**
   * 리소스 정리
   */
  private async cleanup() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }
}

/**
 * 스크립트 실행부
 */
async function main() {
  const config: AuthConfig = {
    clientId: process.env.BAND_CLIENT_ID || '',
    redirectUri: process.env.BAND_REDIRECT_URI || 'http://localhost:3000/api/auth/band/callback',
    // 자동 로그인을 원한다면 여기에 네이버 계정 정보 추가
    // naverEmail: 'your-naver-email@naver.com',
    // naverPassword: 'your-password'
  }

  if (!config.clientId) {
    console.error('❌ BAND_CLIENT_ID가 설정되지 않았습니다.')
    process.exit(1)
  }

  const oauth = new BandOAuthAutomation(config)
  const result = await oauth.reAuthenticate()

  if (result.success) {
    console.log('\n🎉 OAuth 재인증 완료!')
    console.log('✅ 새로운 액세스 토큰이 .env.local에 저장되었습니다.')
    console.log('🚀 이제 밴드 API를 사용할 수 있습니다.')
    process.exit(0)
  } else {
    console.error('\n❌ OAuth 재인증 실패:', result.error)
    process.exit(1)
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main().catch(console.error)
}