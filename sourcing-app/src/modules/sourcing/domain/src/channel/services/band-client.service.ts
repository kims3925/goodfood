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
   * Band API 에러 코드를 사용자 친화적 메시지로 변환
   */
  private getErrorMessage(resultCode: number, defaultMessage?: string): string {
    const errorMessages: Record<number, string> = {
      1001: 'Band API 액세스 토큰이 만료되었습니다. API 설정에서 토큰을 갱신해주세요.',
      1002: 'Band API 액세스 토큰이 유효하지 않습니다. API 설정을 확인해주세요.',
      1003: 'Band API 권한이 부족합니다.',
      1004: '요청 파라미터가 올바르지 않습니다.',
      1005: '해당 밴드를 찾을 수 없습니다.',
      1006: '해당 게시물을 찾을 수 없습니다.',
      1007: 'API 호출 횟수 제한을 초과했습니다. 잠시 후 다시 시도해주세요.',
    }
    return errorMessages[resultCode] || defaultMessage || `Band API 오류가 발생했습니다. (코드: ${resultCode})`
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
      throw new Error(this.getErrorMessage(data.result_code, data.message))
    }

    return data.result_data!.bands
  }
}
