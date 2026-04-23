/**
 * Band Playwright Service
 * Playwright를 사용하여 Band에 이미지 포함 게시물 발행
 */

import { browserPool } from './band-browser-pool'
import { sessionManager } from './band-session-manager'
import { postAutomation } from './band-post.automation'
import {
  BandPublishParams,
  BandPublishResult,
  BandInterleavedPublishParams,
  BandAppendParams,
  BandPerPhotoCommentParams,
  BandPerPhotoCommentResult,
  BandBatchPublishParams,
  BandBatchPublishResult,
  BandDeleteParams,
  BandDeleteResult,
  BandPlaywrightError,
  BandPlaywrightErrorCode,
} from './types'

export class BandPlaywrightService {
  /**
   * Playwright를 사용하여 이미지 포함 게시물 발행
   */
  async publishWithImages(
    params: BandPublishParams,
    retryCount: number = 0
  ): Promise<BandPublishResult> {
    const { channelId, bandKey, content, imageUrls, signal } = params

    // 취소 신호 확인
    if (signal?.aborted) {
      console.log(`[BandPlaywrightService] 발행 취소됨 (시작 전)`)
      return {
        success: false,
        error: '발행이 취소되었습니다.',
      }
    }

    console.log(`[BandPlaywrightService] Publishing to band ${bandKey} with ${imageUrls.length} images`)

    try {
      // 1. 세션 확보
      const session = await sessionManager.getValidSession(channelId)

      if (!session) {
        return {
          success: false,
          error: '세션을 획득할 수 없습니다. 채널 설정에서 쿠키를 등록해주세요.',
        }
      }

      // 취소 신호 확인
      if (signal?.aborted) {
        console.log(`[BandPlaywrightService] 발행 취소됨 (세션 확보 후)`)
        return {
          success: false,
          error: '발행이 취소되었습니다.',
        }
      }

      // 2. 브라우저 컨텍스트 가져오기 (쿠키 주입)
      const context = await browserPool.getContext(channelId, session.cookies)
      const page = await context.newPage()

      try {
        // 3. 글 작성 + 이미지 업로드
        const result = await postAutomation.createPostWithImages(page, params)

        return result
      } finally {
        await page.close()
        await browserPool.releaseContext(channelId)
      }
    } catch (error: any) {
      console.error('[BandPlaywrightService] Publish failed:', error)

      // 발행 실패 시 컨텍스트 무효화 (상태 꼬임 방지)
      console.log(`[BandPlaywrightService] Closing context for channel ${channelId} due to error`)
      await browserPool.closeContext(channelId)

      // 세션 만료 에러인 경우
      if (
        error instanceof BandPlaywrightError &&
        error.code === BandPlaywrightErrorCode.SESSION_EXPIRED
      ) {
        // 1회 재시도
        if (retryCount < 1) {
          console.log('[BandPlaywrightService] Session expired, retrying with new session')
          await sessionManager.invalidateSession(channelId)
          return this.publishWithImages(params, retryCount + 1)
        }
        // 재시도 후에도 실패하면 명확한 메시지 반환
        return {
          success: false,
          error: 'Band 세션이 만료되었습니다. Chrome Extension에서 Band 세션을 다시 저장해주세요.',
        }
      }

      // POST_FAILED 에러는 새 컨텍스트로 재시도 (1회)
      if (
        error instanceof BandPlaywrightError &&
        error.code === BandPlaywrightErrorCode.POST_FAILED &&
        retryCount < 1
      ) {
        console.log('[BandPlaywrightService] Post failed, retrying with fresh context')
        return this.publishWithImages(params, retryCount + 1)
      }

      // UPLOAD_TIMEOUT 에러는 새 컨텍스트로 재시도 (1회)
      if (
        error instanceof BandPlaywrightError &&
        error.code === BandPlaywrightErrorCode.UPLOAD_TIMEOUT &&
        retryCount < 1
      ) {
        console.log('[BandPlaywrightService] Upload timeout, retrying with fresh context')
        return this.publishWithImages(params, retryCount + 1)
      }

      // CAPTCHA 에러는 재시도 불가
      if (
        error instanceof BandPlaywrightError &&
        error.code === BandPlaywrightErrorCode.CAPTCHA_REQUIRED
      ) {
        return {
          success: false,
          error: 'CAPTCHA 인증이 필요합니다. 채널 설정에서 Band 로그인을 다시 해주세요.',
        }
      }

      // 로그인 실패 에러
      if (
        error instanceof BandPlaywrightError &&
        error.code === BandPlaywrightErrorCode.LOGIN_FAILED
      ) {
        return {
          success: false,
          error: error.message || '로그인에 실패했습니다. 네이버 계정 정보를 확인해주세요.',
        }
      }

      return {
        success: false,
        error: error.message || '발행 중 오류가 발생했습니다.',
      }
    }
  }

  /**
   * 블록 단위 교차 삽입 발행
   * - 종합발행 등에서 "이미지 → 해당 상품 링크 텍스트 → 다음 이미지 → ..." 패턴 구현
   */
  async publishInterleaved(
    params: BandInterleavedPublishParams
  ): Promise<BandPublishResult> {
    const { channelId } = params

    console.log(`[BandPlaywrightService] Interleaved publish to band ${params.bandKey} (blocks=${params.blocks.length})`)

    try {
      const session = await sessionManager.getValidSession(channelId)
      if (!session) {
        return { success: false, error: '세션을 획득할 수 없습니다.' }
      }
      const context = await browserPool.getContext(channelId, session.cookies)
      const page = await context.newPage()
      try {
        return await postAutomation.createPostInterleaved(page, params)
      } finally {
        await page.close()
        await browserPool.releaseContext(channelId)
      }
    } catch (error: any) {
      console.error('[BandPlaywrightService] Interleaved publish failed:', error)
      await browserPool.closeContext(channelId)
      if (error instanceof BandPlaywrightError && error.code === BandPlaywrightErrorCode.SESSION_EXPIRED) {
        return { success: false, error: 'Band 세션이 만료되었습니다.' }
      }
      return { success: false, error: error?.message || '발행 중 오류' }
    }
  }

  /**
   * 게시글의 각 사진별 댓글 작성 래퍼
   * 종합발행 후 "사진 N장 각각에 해당 상품 링크 댓글"을 다는 용도
   */
  async addPerPhotoComments(
    params: BandPerPhotoCommentParams
  ): Promise<BandPerPhotoCommentResult> {
    const { channelId } = params

    console.log(
      `[BandPlaywrightService] Per-photo comments band=${params.bandKey} postKey=${params.postKey} (${params.comments.length}장)`
    )

    try {
      const session = await sessionManager.getValidSession(channelId)
      if (!session) {
        return {
          success: false,
          total: params.comments.length,
          successCount: 0,
          failedCount: params.comments.length,
          error: '세션을 획득할 수 없습니다.',
        }
      }
      const context = await browserPool.getContext(channelId, session.cookies)
      const page = await context.newPage()
      try {
        return await postAutomation.addPerPhotoComments(page, params)
      } finally {
        await page.close()
        await browserPool.releaseContext(channelId)
      }
    } catch (error: any) {
      console.error('[BandPlaywrightService] addPerPhotoComments failed:', error)
      await browserPool.closeContext(channelId)
      return {
        success: false,
        total: params.comments.length,
        successCount: 0,
        failedCount: params.comments.length,
        error: error?.message || '사진별 댓글 작성 중 오류',
      }
    }
  }

  /**
   * 기존 게시글 본문 끝에 블록을 덧붙이는 수정 발행
   * - 점진발행(incremental) 모드: 첫 게시글 생성 후 상품마다 수정으로 추가
   */
  async appendToExistingPost(params: BandAppendParams): Promise<BandPublishResult> {
    const { channelId } = params

    console.log(
      `[BandPlaywrightService] Append to existing post band=${params.bandKey} postKey=${params.postKey} (blocks=${params.blocks.length})`
    )

    try {
      const session = await sessionManager.getValidSession(channelId)
      if (!session) {
        return { success: false, error: '세션을 획득할 수 없습니다.' }
      }
      const context = await browserPool.getContext(channelId, session.cookies)
      const page = await context.newPage()
      try {
        return await postAutomation.appendBlocksToExistingPost(page, params)
      } finally {
        await page.close()
        await browserPool.releaseContext(channelId)
      }
    } catch (error: any) {
      console.error('[BandPlaywrightService] Append failed:', error)
      await browserPool.closeContext(channelId)
      if (error instanceof BandPlaywrightError && error.code === BandPlaywrightErrorCode.SESSION_EXPIRED) {
        return { success: false, error: 'Band 세션이 만료되었습니다.' }
      }
      return { success: false, error: error?.message || '수정 발행 중 오류' }
    }
  }

  /**
   * 배치 발행: 같은 채널에 여러 상품을 효율적으로 발행
   * 페이지를 한 번만 열고 여러 글을 작성
   */
  async publishBatchWithImages(
    params: BandBatchPublishParams,
    retryCount: number = 0
  ): Promise<BandBatchPublishResult> {
    const { channelId, bandKey, bandName, items } = params

    console.log(`[BandPlaywrightService] Batch publishing ${items.length} items to band "${bandName}"`)

    try {
      // 1. 세션 확보
      const session = await sessionManager.getValidSession(channelId)

      if (!session) {
        return {
          success: false,
          total: items.length,
          successCount: 0,
          failedCount: items.length,
          results: items.map(item => ({
            productId: item.productId,
            success: false,
            error: '세션을 획득할 수 없습니다. 채널 설정에서 쿠키를 등록해주세요.',
          })),
        }
      }

      // 2. 브라우저 컨텍스트 가져오기 (쿠키 주입)
      const context = await browserPool.getContext(channelId, session.cookies)
      const page = await context.newPage()

      try {
        // 3. 배치 글 작성
        const result = await postAutomation.createBatchPosts(page, params)
        return result
      } finally {
        await page.close()
        await browserPool.releaseContext(channelId)
      }
    } catch (error: any) {
      console.error('[BandPlaywrightService] Batch publish failed:', error)

      // 발행 실패 시 컨텍스트 무효화 (상태 꼬임 방지)
      console.log(`[BandPlaywrightService] Closing context for channel ${channelId} due to batch error`)
      await browserPool.closeContext(channelId)

      // 세션 만료 에러인 경우
      if (
        error instanceof BandPlaywrightError &&
        error.code === BandPlaywrightErrorCode.SESSION_EXPIRED
      ) {
        // 1회 재시도
        if (retryCount < 1) {
          console.log('[BandPlaywrightService] Session expired, retrying with new session')
          await sessionManager.invalidateSession(channelId)
          return this.publishBatchWithImages(params, retryCount + 1)
        }
        // 재시도 후에도 실패하면 명확한 메시지 반환
        const sessionExpiredError = 'Band 세션이 만료되었습니다. Chrome Extension에서 Band 세션을 다시 저장해주세요.'
        return {
          success: false,
          total: items.length,
          successCount: 0,
          failedCount: items.length,
          results: items.map(item => ({
            productId: item.productId,
            success: false,
            error: sessionExpiredError,
          })),
        }
      }

      // POST_FAILED 에러는 새 컨텍스트로 재시도 (1회)
      if (
        error instanceof BandPlaywrightError &&
        error.code === BandPlaywrightErrorCode.POST_FAILED &&
        retryCount < 1
      ) {
        console.log('[BandPlaywrightService] Batch post failed, retrying with fresh context')
        return this.publishBatchWithImages(params, retryCount + 1)
      }

      return {
        success: false,
        total: items.length,
        successCount: 0,
        failedCount: items.length,
        results: items.map(item => ({
          productId: item.productId,
          success: false,
          error: error.message || '배치 발행 중 오류가 발생했습니다.',
        })),
      }
    }
  }

  /**
   * Playwright를 사용하여 게시물 삭제
   */
  async deletePost(params: BandDeleteParams): Promise<BandDeleteResult> {
    const { channelId, bandKey, bandName, postKey } = params

    console.log(`[BandPlaywrightService] Deleting post ${postKey} from band ${bandKey}`)

    try {
      // 1. 세션 확보
      const session = await sessionManager.getValidSession(channelId)

      if (!session) {
        return {
          success: false,
          error: '세션을 획득할 수 없습니다. 채널 설정에서 쿠키를 등록해주세요.',
        }
      }

      // 2. 브라우저 컨텍스트 가져오기 (쿠키 주입)
      const context = await browserPool.getContext(channelId, session.cookies)
      const page = await context.newPage()

      try {
        // 3. 게시물 삭제
        const result = await postAutomation.deletePost(page, bandKey, bandName, postKey)
        return result
      } finally {
        await page.close()
        await browserPool.releaseContext(channelId)
      }
    } catch (error: any) {
      console.error('[BandPlaywrightService] Delete failed:', error)

      // 세션 만료 에러인 경우
      if (
        error instanceof BandPlaywrightError &&
        error.code === BandPlaywrightErrorCode.SESSION_EXPIRED
      ) {
        return {
          success: false,
          error: 'Band 세션이 만료되었습니다. Chrome Extension에서 Band 세션을 다시 저장해주세요.',
        }
      }

      return {
        success: false,
        error: error.message || '게시물 삭제 중 오류가 발생했습니다.',
      }
    }
  }

  /**
   * 세션 테스트
   */
  async testSession(channelId: number): Promise<boolean> {
    return sessionManager.testSession(channelId)
  }

  /**
   * 세션 무효화 (재로그인 필요 시)
   */
  async invalidateSession(channelId: number): Promise<void> {
    await sessionManager.invalidateSession(channelId)
  }

  /**
   * 브라우저 풀 예열 (배치 발행 전)
   */
  async warmUp(): Promise<void> {
    await browserPool.warmUp()
  }

  /**
   * 리소스 정리 (서버 종료 시)
   */
  async cleanup(): Promise<void> {
    await browserPool.cleanup()
  }
}

// 싱글톤 인스턴스
export const bandPlaywrightService = new BandPlaywrightService()
