/**
 * Band Playwright 모듈
 * Playwright를 사용하여 Band에 이미지 포함 게시물 발행
 */

export { bandPlaywrightService, BandPlaywrightService } from './band-playwright.service'
export { browserPool } from './band-browser-pool'
export { sessionManager } from './band-session-manager'
export { postAutomation } from './band-post.automation'

export type {
  BandSession,
  BandPublishParams,
  BandPublishResult,
  BandLoginResult,
} from './types'

export { BandPlaywrightError, BandPlaywrightErrorCode } from './types'
