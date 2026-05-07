/**
 * 카페24 OAuth 2.0 토큰 관리 (작업지시서 §5-2).
 *
 * Flow:
 * 1. 사용자가 카페24 앱 설치 페이지로 이동 → 인증 코드 발급
 * 2. 인증 코드 → access_token + refresh_token 교환
 * 3. access_token 만료 시 refresh_token 으로 갱신
 *
 * 환경변수:
 * - CAFE24_CLIENT_ID
 * - CAFE24_CLIENT_SECRET
 */

const SCOPES = [
  'mall.read_product',
  'mall.read_category',
  'mall.read_order',
  'mall.write_product',
].join(',')

export interface Cafe24Token {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt: Date
  scopes?: string[]
}

export class Cafe24AuthService {
  private clientId: string
  private clientSecret: string

  constructor() {
    this.clientId = process.env.CAFE24_CLIENT_ID || ''
    this.clientSecret = process.env.CAFE24_CLIENT_SECRET || ''
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret)
  }

  /** 사용자를 카페24 인증 페이지로 보낼 URL 생성 */
  getAuthorizationUrl(mallId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      state,
      redirect_uri: redirectUri,
      scope: SCOPES,
    })
    return `https://${mallId}.cafe24api.com/api/v2/oauth/authorize?${params.toString()}`
  }

  /** 인증 코드 → access_token 교환 */
  async exchangeToken(
    mallId: string,
    code: string,
    redirectUri: string
  ): Promise<Cafe24Token> {
    if (!this.isConfigured()) {
      throw new Error(
        'CAFE24_CLIENT_ID / CAFE24_CLIENT_SECRET 환경변수가 필요합니다. 운영 .env 에 등록하세요.'
      )
    }
    const res = await fetch(`https://${mallId}.cafe24api.com/api/v2/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`카페24 토큰 교환 실패 HTTP ${res.status} ${txt.slice(0, 200)}`)
    }
    const data = (await res.json()) as any
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: Number(data.expires_in) || 7200,
      expiresAt: new Date(Date.now() + (Number(data.expires_in) || 7200) * 1000),
      scopes: data.scopes,
    }
  }

  /** refresh_token 으로 access_token 갱신 */
  async refreshAccessToken(
    mallId: string,
    refreshToken: string
  ): Promise<Cafe24Token> {
    if (!this.isConfigured()) {
      throw new Error('CAFE24_CLIENT_ID/SECRET 미설정')
    }
    const res = await fetch(`https://${mallId}.cafe24api.com/api/v2/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`카페24 토큰 갱신 실패 HTTP ${res.status} ${txt.slice(0, 200)}`)
    }
    const data = (await res.json()) as any
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: Number(data.expires_in) || 7200,
      expiresAt: new Date(Date.now() + (Number(data.expires_in) || 7200) * 1000),
    }
  }
}
