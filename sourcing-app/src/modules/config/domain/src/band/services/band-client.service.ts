/**
 * 네이버 밴드 API 클라이언트
 * 공식 문서: https://developers.naver.com/docs/login/band/
 */

export interface BandInfo {
  band_key: string
  name: string
  description?: string
  cover?: string
  member_count: number
  created_at: string
  is_public: boolean
}

export interface BandPost {
  post_key: string
  band_key: string
  author: {
    user_key: string
    name: string
    profile_image?: string
  }
  content: string
  photo?: {
    url: string
    thumbnail_url: string
  }[]
  created_at: string
  updated_at: string
  comment_count: number
  emotion_count: number
}

export interface BandApiResponse<T> {
  result_code: number
  result_message: string
  result_data?: T
}

export class NaverBandClient {
  private baseUrl = 'https://openapi.band.us/v2.1'
  private accessToken: string

  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error('Band Access Token이 필요합니다. 설정 페이지(/admin/settings/api)에서 Band API 인증 정보를 입력해주세요.')
    }

    this.accessToken = accessToken
  }

  /**
   * HTTP 요청 헬퍼 메서드 (OAuth Bearer Token 사용)
   */
  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<BandApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    
    // 추가 파라미터 추가 (access_token은 헤더로 이동)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    try {
      console.log(`🔗 Band API 요청: ${url.toString()}`)
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': 'BandAuto/1.0.0',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json() as BandApiResponse<T>
      
      console.log('📝 Band API 응답:', {
        result_code: data.result_code,
        result_message: data.result_message,
        data_keys: data.result_data ? Object.keys(data.result_data) : []
      })

      return data
    } catch (error) {
      console.error('❌ Band API 요청 실패:', error)
      throw error
    }
  }

  /**
   * 사용자가 가입한 밴드 목록 조회
   */
  async getBands(): Promise<BandInfo[]> {
    try {
      const response = await this.makeRequest<{ bands: BandInfo[] }>('/band')
      
      if (response.result_code !== 1) {
        throw new Error(`Band API Error: ${response.result_message} (Code: ${response.result_code})`)
      }

      return response.result_data?.bands || []
    } catch (error) {
      console.error('❌ 밴드 목록 조회 실패:', error)
      throw error
    }
  }

  /**
   * 특정 밴드의 게시물 목록 조회
   * 네이버 밴드 API v2.1 스펙에 맞춰 수정
   */
  async getBandPosts(bandKey: string, options?: {
    since?: string  // ISO 8601 format
    until?: string  // ISO 8601 format  
    limit?: number  // max 20
  }): Promise<BandPost[]> {
    try {
      // 네이버 밴드 API는 `/band/{band_key}/posts` 형식을 사용
      const response = await this.makeRequest<{ posts: BandPost[] }>(`/band/${bandKey}/posts`, {
        ...options
      })
      
      if (response.result_code !== 1) {
        throw new Error(`Band API Error: ${response.result_message} (Code: ${response.result_code})`)
      }

      return response.result_data?.posts || []
    } catch (error) {
      console.error(`❌ 밴드 게시물 조회 실패 (${bandKey}):`, error)
      throw error
    }
  }

  /**
   * 특정 게시물 상세 정보 조회
   */
  async getPostDetail(bandKey: string, postKey: string): Promise<BandPost | null> {
    try {
      const response = await this.makeRequest<{ post: BandPost }>(`/band/${bandKey}/post/${postKey}`, {})
      
      if (response.result_code !== 1) {
        throw new Error(`Band API Error: ${response.result_message} (Code: ${response.result_code})`)
      }

      return response.result_data?.post || null
    } catch (error) {
      console.error(`❌ 게시물 상세 조회 실패 (${bandKey}/${postKey}):`, error)
      throw error
    }
  }

  /**
   * 밴드 URL에서 band_key 추출
   */
  static parseBandUrl(url: string): string | null {
    try {
      const patterns = [
        /band\.us\/band\/(\d+)/,           // https://band.us/band/12345
        /band\.us\/page\/(\d+)/,           // https://band.us/page/12345  
        /band\.us\/#!\/band\/(\d+)/,       // https://band.us/#!/band/12345
      ]

      for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match && match[1]) {
          return match[1]
        }
      }

      return null
    } catch (error) {
      console.error('❌ 밴드 URL 파싱 실패:', error)
      return null
    }
  }

  /**
   * 액세스 토큰 유효성 검사
   */
  async validateToken(): Promise<boolean> {
    try {
      const bands = await this.getBands()
      return true
    } catch (error) {
      console.error('❌ 토큰 유효성 검사 실패:', error)
      return false
    }
  }
}