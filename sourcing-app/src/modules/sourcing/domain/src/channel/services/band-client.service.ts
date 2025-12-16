/**
 * Naver Band API Client
 * Band Open API를 사용하여 게시물 및 댓글 작성
 */

const BAND_API_BASE_URL = process.env.BAND_API_BASE_URL || 'https://openapi.band.us'
const API_TIMEOUT_MS = 30000 // 30초 타임아웃

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

    // 타임아웃 설정
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const data: BandApiResponse<{ post_key: string }> = await response.json()

      if (data.result_code !== 1) {
        const errorData = data.result_data as any
        const errorMessage = this.getErrorMessage(
          data.result_code,
          errorData?.message || data.message
        )
        throw new Error(errorMessage)
      }

      return { postKey: data.result_data!.post_key }
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Band API 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
      }
      throw error
    }
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

    // 타임아웃 설정
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const data: BandApiResponse<{ comment_key: string }> = await response.json()

      if (data.result_code !== 1) {
        const errorData = data.result_data as any
        const errorMessage = this.getErrorMessage(
          data.result_code,
          errorData?.message || data.message
        )
        throw new Error(errorMessage)
      }

      return { commentKey: data.result_data!.comment_key }
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Band API 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
      }
      throw error
    }
  }

  /**
   * Band API 에러 코드를 사용자 친화적 메시지로 변환
   */
  private getErrorMessage(resultCode: number, defaultMessage?: string): string {
    const errorMessages: Record<number, string> = {
      // 파라미터 오류
      211: '잘못된 파라미터입니다.',
      212: '필수 파라미터를 확인하고 추가해 주세요.',

      // 쿼터 및 제한
      1001: 'Band API 쿼터가 초과되었습니다. 잠시 후 다시 시도해주세요.',
      1002: '사용자별 API 쿼터가 초과되었습니다. 잠시 후 다시 시도해주세요.',
      1003: 'API 쿨타임 제한입니다. 잠시 후 다시 시도해주세요.',

      // 권한 오류
      2142: '밴드 리더만 사용할 수 있는 기능입니다.',
      2300: '서버 응답 오류가 발생했습니다. 고객센터에 문의해 주세요.',

      // 요청 오류
      3000: '잘못된 요청입니다. 경로 및 파라미터를 확인해 주세요.',
      3001: '문자열 길이 제한을 초과했습니다. 내용을 줄여주세요.',
      3002: '이미지 파일 크기가 너무 큽니다. 파일 크기를 줄여주세요.',
      3003: '첨부 이미지 개수가 제한을 초과했습니다. 이미지 수를 줄여주세요.',

      // 인증/권한
      10401: '인증 토큰이 없거나 만료되었습니다. API 설정에서 토큰을 갱신해주세요.',
      10403: '접근 권한이 없습니다. 해당 기능 사용 권한을 확인해 주세요.',

      // 파라미터 검증
      60000: '잘못된 파라미터입니다. 필수 파라미터와 타입을 확인해 주세요.',

      // 사용자 관련
      60100: '존재하지 않는 사용자입니다.',
      60101: '사용자의 친구가 아닙니다.',
      60102: '밴드 멤버가 아닙니다. 밴드에 가입해 주세요.',
      60103: '연동되지 않은 사용자입니다.',
      60104: '이미 연동된 사용자입니다.',
      60105: '멤버가 있는 밴드는 리더가 탈퇴할 수 없습니다.',
      60106: '특정 멤버에게만 권한이 부여된 기능입니다.',

      // 밴드 관련
      60200: '존재하지 않거나 연동되지 않은 밴드입니다.',
      60201: '이미 가입한 밴드입니다.',
      60202: '가입할 수 있는 최대 밴드 수를 초과했습니다.',
      60203: '앱과 연동되지 않은 밴드입니다.',
      60204: '접근이 차단된 밴드입니다.',

      // 메시지 관련
      60300: '상대방이 메시지 수신을 거부했습니다.',
      60301: '메시지 형식이 올바르지 않습니다.',
      60302: '메시지 서비스 오류가 발생했습니다.',

      // 포스트 관련
      60400: '글쓰기 권한이 없습니다.',
      60401: '앱과 연동되지 않은 포스트입니다.',
      60402: '포스트를 수정할 수 없습니다.',

      // 기타
      60700: '유효하지 않은 초대장입니다.',
      60800: '유효하지 않은 형식의 이미지 URL입니다.',
      60801: '존재하지 않는 앨범입니다.',
    }
    return errorMessages[resultCode] || defaultMessage || `Band API 오류가 발생했습니다. (코드: ${resultCode})`
  }

  /**
   * 게시물 삭제
   */
  async removePost(bandKey: string, postKey: string): Promise<void> {
    // v2 API 사용, 파라미터는 query string으로 전송
    const url = new URL(`${BAND_API_BASE_URL}/v2/band/post/remove`)
    url.searchParams.append('access_token', this.accessToken)
    url.searchParams.append('band_key', bandKey)
    url.searchParams.append('post_key', postKey)

    // 타임아웃 설정
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const data: BandApiResponse = await response.json()

      if (data.result_code !== 1) {
        const errorData = data.result_data as any
        const errorMessage = this.getErrorMessage(
          data.result_code,
          errorData?.message || data.message
        )
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Band API 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
      }
      throw error
    }
  }

  /**
   * 밴드 목록 조회
   */
  async getBands(): Promise<Array<{ band_key: string; name: string; cover: string }>> {
    const url = new URL(`${BAND_API_BASE_URL}/v2.1/bands`)
    url.searchParams.append('access_token', this.accessToken)

    // 타임아웃 설정
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const data: BandApiResponse<{ bands: Array<{ band_key: string; name: string; cover: string }> }> =
        await response.json()

      if (data.result_code !== 1) {
        throw new Error(this.getErrorMessage(data.result_code, data.message))
      }

      return data.result_data!.bands
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Band API 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
      }
      throw error
    }
  }
}
