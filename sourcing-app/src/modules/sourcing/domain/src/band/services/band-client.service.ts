/**
 * Naver Band API Client
 * Band Open API를 사용하여 게시물 및 댓글 작성
 */

const BAND_API_BASE_URL = process.env.BAND_API_BASE_URL || 'https://openapi.band.us'

interface BandApiResponse<T = any> {
  result_code: number
  result_data?: T
  message?: string
}

interface CreatePostOptions {
  doPush?: boolean
}

export class NaverBandClient {
  private accessToken: string

  constructor(accessToken: string) {
    // 토큰에서 줄바꿈, 공백 등 불필요한 문자 제거
    this.accessToken = accessToken.trim().replace(/[\r\n]/g, '')
  }

  /**
   * 게시물 작성
   */
  async createPost(
    bandKey: string,
    content: string,
    options: CreatePostOptions = {}
  ): Promise<{ postKey: string }> {
    // v2.2 API 사용, 파라미터는 query string으로 전송 (공식 예제 방식)
    const url = new URL(`${BAND_API_BASE_URL}/v2.2/band/post/create`)
    url.searchParams.append('access_token', this.accessToken)
    url.searchParams.append('band_key', bandKey)
    url.searchParams.append('content', content)
    url.searchParams.append('do_push', options.doPush ? 'true' : 'false')

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data: BandApiResponse<{ post_key: string }> = await response.json()

    if (data.result_code !== 1) {
      const errorData = data.result_data as any
      throw new Error(errorData?.message || data.message || `Band API Error: ${data.result_code}`)
    }

    return { postKey: data.result_data!.post_key }
  }

  /**
   * 댓글 작성
   */
  async createComment(
    bandKey: string,
    postKey: string,
    content: string
  ): Promise<{ commentKey: string }> {
    // query string 방식으로 전송
    const url = new URL(`${BAND_API_BASE_URL}/v2/band/post/comment/create`)
    url.searchParams.append('access_token', this.accessToken)
    url.searchParams.append('band_key', bandKey)
    url.searchParams.append('post_key', postKey)
    url.searchParams.append('body', content)

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data: BandApiResponse<{ comment_key: string }> = await response.json()

    if (data.result_code !== 1) {
      throw new Error(data.message || `Band API Error: ${data.result_code}`)
    }

    return { commentKey: data.result_data!.comment_key }
  }

  /**
   * 밴드 목록 조회
   */
  async getBands(): Promise<Array<{ band_key: string; name: string; cover: string }>> {
    const url = new URL(`${BAND_API_BASE_URL}/v2.1/bands`)
    url.searchParams.append('access_token', this.accessToken)

    const response = await fetch(url.toString())
    const data: BandApiResponse<{ bands: Array<{ band_key: string; name: string; cover: string }> }> =
      await response.json()

    if (data.result_code !== 1) {
      throw new Error(data.message || `Band API Error: ${data.result_code}`)
    }

    return data.result_data!.bands
  }
}
