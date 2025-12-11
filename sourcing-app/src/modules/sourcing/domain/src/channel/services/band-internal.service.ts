/**
 * Band Internal API Service
 *
 * 비공식 내부 API를 사용하여 이미지 업로드 + 글 작성
 * 수동으로 입력받은 세션 쿠키 기반 인증
 */

const BAND_API_KR_URL = 'https://api-kr.band.us'
const BAND_UPLOAD_URL = 'https://api-kr.band.us/v1/upload_image'

interface BandInternalApiResponse<T = any> {
  result_code: number
  result_data?: T
  message?: string
}

interface UploadedImage {
  imageKey: string
  url?: string
}

interface CreatePostResult {
  postKey: string
  bandKey: string
}

export class BandInternalClient {
  private cookies: string

  constructor(sessionCookie: string) {
    // "Cookie: " 접두사 자동 제거 및 정리
    let cleaned = sessionCookie.trim()
    if (cleaned.toLowerCase().startsWith('cookie:')) {
      cleaned = cleaned.substring(7).trim()
    }
    this.cookies = cleaned
  }

  /**
   * 세션 쿠키 유효성 테스트
   * band.us 메인 페이지 접근으로 세션 확인
   */
  async testConnection(): Promise<{ valid: boolean; message: string }> {
    try {
      console.log('[BandInternalClient] 연결 테스트 시작...')
      console.log('[BandInternalClient] 쿠키 길이:', this.cookies.length)

      // band.us 웹페이지 접근으로 세션 확인
      const response = await fetch('https://band.us/home', {
        method: 'GET',
        headers: {
          'Cookie': this.cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'manual', // 리다이렉트 수동 처리
      })

      console.log('[BandInternalClient] 응답 상태:', response.status)
      console.log('[BandInternalClient] Location:', response.headers.get('location'))

      // 로그인 안 됐으면 로그인 페이지로 리다이렉트됨
      if (response.status === 302 || response.status === 301) {
        const location = response.headers.get('location') || ''
        if (location.includes('login') || location.includes('auth')) {
          return { valid: false, message: '세션이 만료되었습니다. 다시 로그인해주세요.' }
        }
        // 다른 리다이렉트는 유효한 것으로 간주
        return { valid: true, message: '세션이 유효합니다. (리다이렉트)' }
      }

      // 200이면 로그인 상태
      if (response.status === 200) {
        return { valid: true, message: '세션이 유효합니다.' }
      }

      return { valid: false, message: `예상치 못한 응답: ${response.status}` }
    } catch (error: any) {
      // 연결 테스트 실패해도 쿠키는 저장 가능하도록
      console.error('[BandInternalClient] 연결 테스트 오류:', error)
      return { valid: false, message: `연결 테스트 실패: ${error.message}. 테스트 없이 저장을 시도해보세요.` }
    }
  }

  /**
   * 이미지 업로드 (Buffer → Band 이미지 키)
   */
  async uploadImage(imageBuffer: Buffer, filename: string): Promise<UploadedImage> {
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: this.getMimeType(filename) })
    formData.append('file', blob, filename)

    const response = await fetch(BAND_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Cookie': this.cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`이미지 업로드 실패: HTTP ${response.status}`)
    }

    const data: BandInternalApiResponse<{ photo_key?: string; key?: string; url?: string }> = await response.json()

    if (data.result_code !== 1) {
      throw new Error(`이미지 업로드 실패: ${data.message || '알 수 없는 오류'}`)
    }

    const imageKey = data.result_data?.photo_key || data.result_data?.key
    if (!imageKey) {
      throw new Error('이미지 키를 받지 못했습니다.')
    }

    return {
      imageKey,
      url: data.result_data?.url,
    }
  }

  /**
   * URL에서 이미지 다운로드 후 업로드
   */
  async uploadImageFromUrl(imageUrl: string): Promise<UploadedImage> {
    // 이미지 다운로드
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패: ${imageUrl}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const filename = this.extractFilename(imageUrl)

    return this.uploadImage(buffer, filename)
  }

  /**
   * 이미지 포함 글 작성
   * api-kr.band.us 내부 API 사용
   * @param bandNo - 밴드 번호 (숫자형, 예: 100698973)
   */
  async createPostWithImages(
    bandNo: string,
    content: string,
    photoKeys: string[] = []
  ): Promise<CreatePostResult> {
    console.log('[BandInternalClient] 글 작성 시작:', { bandNo, contentLength: content.length, photoKeys })

    const ts = Date.now()
    const url = `${BAND_API_KR_URL}/v2.0.2/create_post?ts=${ts}`

    // URL encoded form data
    const formData = new URLSearchParams()
    formData.append('band_no', bandNo)
    formData.append('content', content)
    formData.append('set_band_notice', 'false')
    formData.append('set_major_band_notice', 'false')
    formData.append('set_linked_band_notice', '')
    formData.append('copiable_state', '')
    formData.append('should_disable_comment', 'false')
    formData.append('band_notice_unset_at', '')
    formData.append('purpose', 'create')

    // 이미지 키가 있으면 추가
    if (photoKeys.length > 0) {
      formData.append('photo_keys', photoKeys.join(','))
    }

    console.log('[BandInternalClient] 요청 URL:', url)
    console.log('[BandInternalClient] 요청 body:', formData.toString())

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Cookie': this.cookies,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
        'Origin': 'https://www.band.us',
        'Referer': `https://www.band.us/band/${bandNo}/post`,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
        'language': 'ko',
        'DEVICE-TIME-ZONE-ID': 'Asia/Seoul',
        'DEVICE-TIME-ZONE-MS-OFFSET': '32400000',
        'akey': 'bbc59b0b5f7a1c6efe950f6236ccda35',
        // md 헤더는 서명값 - 일단 없이 테스트
      },
      body: formData.toString(),
    })

    console.log('[BandInternalClient] 응답 상태:', response.status)

    const responseText = await response.text()
    console.log('[BandInternalClient] 응답 텍스트:', responseText.substring(0, 500))

    if (!response.ok) {
      throw new Error(`글 작성 실패: HTTP ${response.status}`)
    }

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch {
      throw new Error(`응답 파싱 실패: ${responseText.substring(0, 200)}`)
    }

    // x-band-status: 1 또는 result_code: 1 확인
    if (data.result_code !== 1 && data.result_data?.status !== 1) {
      throw new Error(`글 작성 실패: ${data.message || JSON.stringify(data)}`)
    }

    const postKey = data.result_data?.post_key || data.post_key || 'unknown'

    return {
      postKey,
      bandKey: bandNo,
    }
  }

  /**
   * 상품을 밴드에 발행 (이미지 업로드 + 글 작성)
   */
  async publishProduct(
    bandKey: string,
    content: string,
    imageUrls: string[]
  ): Promise<CreatePostResult> {
    // 1. 모든 이미지 업로드
    const uploadedImages: UploadedImage[] = []

    for (const imageUrl of imageUrls) {
      try {
        const uploaded = await this.uploadImageFromUrl(imageUrl)
        uploadedImages.push(uploaded)
      } catch (error) {
        console.error(`이미지 업로드 실패: ${imageUrl}`, error)
        // 일부 이미지 실패해도 계속 진행
      }
    }

    const imageKeys = uploadedImages.map(img => img.imageKey)

    // 2. 글 작성 (이미지 키 포함)
    return this.createPostWithImages(bandKey, content, imageKeys)
  }

  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop()
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    }
    return mimeTypes[ext || ''] || 'image/jpeg'
  }

  private extractFilename(url: string): string {
    try {
      const pathname = new URL(url).pathname
      const filename = pathname.split('/').pop() || 'image.jpg'
      // 쿼리스트링 제거
      return filename.split('?')[0]
    } catch {
      return 'image.jpg'
    }
  }
}
