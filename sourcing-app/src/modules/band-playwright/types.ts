/**
 * Band Playwright 자동화 타입 정의
 */

import type { PublishDetailedProgress } from '../publish/types'

// 단계별 진행 콜백 타입
export type BandStageProgressCallback = (progress: Omit<PublishDetailedProgress, 'productId' | 'productName'>) => void | Promise<void>

export interface BandSession {
  cookies: string
  expiresAt: Date
  isValid: boolean
}

export interface BandPublishParams {
  channelId: number
  bandKey: string       // Band API의 band_key (AAC... 형식)
  bandName: string      // 밴드 이름 (Band 홈에서 채널 찾기용)
  content: string
  imageUrls: string[]   // 상품 이미지 URL 목록
  /** 단계별 진행 콜백 (실시간 상태 업데이트용) */
  onStageProgress?: BandStageProgressCallback
  /** 취소 신호 (발행 중단용) */
  signal?: AbortSignal
}

export interface BandPublishResult {
  success: boolean
  postKey?: string
  error?: string
  imageCount?: number
}

export interface BandBatchPublishParams {
  channelId: number
  bandKey: string       // Band API의 band_key (AAC... 형식)
  bandName: string      // 밴드 이름 (Band 홈에서 채널 찾기용)
  items: {
    productId: number
    content: string
    imageUrls: string[]
    shopUrl?: string    // 쇼핑몰 상품 URL (타임아웃 시 폴백용)
  }[]
  /**
   * Band API 성공 직후 즉시 호출되는 콜백
   * DB 저장 등 중요한 작업을 여기서 수행 (페이지 새로고침에 영향받지 않음)
   * @returns PublishedProduct ID (DB 저장 성공 시) 또는 undefined
   */
  onItemSuccess?: (result: BandBatchItemResult) => Promise<number | undefined>
  /**
   * 진행 상황 알림 콜백 (UI 업데이트용)
   * onItemSuccess 이후에 호출됨
   */
  onProgress?: (current: number, total: number, result: BandBatchItemResult) => Promise<void>
  /**
   * 상품별 단계 진행 콜백 (실시간 상태 업데이트용)
   * productId와 함께 현재 단계 정보를 전달
   */
  onStageProgress?: (productId: number, progress: Omit<PublishDetailedProgress, 'productId' | 'productName'>) => void | Promise<void>
}

export interface BandBatchItemResult {
  productId: number
  success: boolean
  postKey?: string
  error?: string
  imageCount?: number
}

export interface BandBatchPublishResult {
  success: boolean
  total: number
  successCount: number
  failedCount: number
  results: BandBatchItemResult[]
}

export interface BandLoginResult {
  success: boolean
  cookies?: string
  expiresAt?: Date
  error?: string
}

export enum BandPlaywrightErrorCode {
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  LOGIN_FAILED = 'LOGIN_FAILED',
  UPLOAD_TIMEOUT = 'UPLOAD_TIMEOUT',
  POST_FAILED = 'POST_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CAPTCHA_REQUIRED = 'CAPTCHA_REQUIRED',
  CREDENTIALS_MISSING = 'CREDENTIALS_MISSING',
}

export class BandPlaywrightError extends Error {
  constructor(
    message: string,
    public code: BandPlaywrightErrorCode,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'BandPlaywrightError'
  }
}

export interface BandDeleteParams {
  channelId: number
  bandKey: string
  bandName: string
  postKey: string  // post_no (숫자 형태)
}

export interface BandDeleteResult {
  success: boolean
  error?: string
}
