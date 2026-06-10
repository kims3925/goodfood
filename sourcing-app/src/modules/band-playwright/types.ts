/**
 * Band Playwright 자동화 타입 정의
 */

import type { PublishDetailedProgress } from '../publish/types'

// 단계별 진행 콜백 타입
export type BandStageProgressCallback = (progress: Omit<PublishDetailedProgress, 'productId' | 'productName'>) => void | Promise<void>

export interface BandSession {
  cookies: string
  expiresAt: Date | null
  isValid: boolean
}

export interface BandPublishParams {
  channelId: number
  bandKey: string       // Band API의 band_key (AAC... 형식)
  bandName: string      // 밴드 이름 (Band 홈에서 채널 찾기용)
  content: string
  imageUrls: string[]   // 상품 이미지 URL 목록
  /** 발행 후 작성할 댓글 내용 (쇼핑몰 링크 등) */
  commentContent?: string
  /** 단계별 진행 콜백 (실시간 상태 업데이트용) */
  onStageProgress?: BandStageProgressCallback
  /** 취소 신호 (발행 중단용) */
  signal?: AbortSignal
  /**
   * 크로스포스트 정보 (선택). 존재하면 "다른 밴드에 올리기" 방식으로 먼저 시도하고,
   * 실패하면 기존 createPostWithImages(본문 새작성)로 자동 폴백한다.
   * 없으면(기본) 기존 동작과 100% 동일.
   */
  crossPost?: CrossPostInfo
}

/** 크로스포스트(원본 도매글 공유) 정보 */
export interface CrossPostInfo {
  sourceBandKey: string   // 원본 도매밴드 band_key (AAC...)
  sourceBandName: string  // 원본 도매밴드 이름 (navigateToBand 용)
  sourceMatchTitle: string // 원본글 매칭 키 (CollectedPost.title = 본문 첫줄)
  /** 원본 도매밴드 숫자ID. 있으면 band.us/band/{no} 로 직접 진입(도매 공급밴드는 홈 목록에 없어 이름해석 실패). */
  sourceBandNo?: number | null
  /** 도매가→판매가 매핑 (ProductVariant 기반). 편집기에서 정확 치환용. */
  priceMap: Array<{ from: number; to: number }>
  /** 공유 편집기 본문 끝에 덧붙일 텍스트 (쇼핑몰 주문 링크 등). 2026-06-10 */
  appendBodyText?: string
}

/** 크로스포스트 실행 파라미터 (BandPostAutomation.crossPostToBand) */
export interface BandCrossPostParams {
  channelId: number
  sourceBandKey: string
  sourceBandName: string
  sourceMatchTitle: string
  sourceBandNo?: number | null
  targetBandKey: string
  targetBandName: string
  priceMap: Array<{ from: number; to: number }>
  /** 본문 끝에 덧붙일 텍스트 (쇼핑몰 주문 링크 등). 댓글(commentContent)과 별개. */
  appendBodyText?: string
  commentContent?: string
  signal?: AbortSignal
}

export interface BandPublishResult {
  success: boolean
  postKey?: string
  error?: string
  imageCount?: number
}

/** 텍스트/이미지를 교차 삽입하는 블록 단위 발행 — 종합발행 카드·링크 쌍 배치에 사용 */
export type PostBlock =
  | { type: 'text'; content: string }
  | { type: 'image'; filePath: string } // 로컬 PNG/JPG 파일 절대 경로

export interface BandInterleavedPublishParams {
  channelId: number
  bandKey: string
  bandName: string
  blocks: PostBlock[]
  signal?: AbortSignal
}

/**
 * 기존 게시글 본문 끝에 블록(텍스트/이미지)을 덧붙이는 수정 발행
 * — 점진발행(incremental) 모드: 1개 게시 후 수정으로 1개씩 추가
 */
export interface BandAppendParams {
  channelId: number
  bandKey: string
  bandName: string
  postKey: string           // 수정할 기존 게시글 key
  blocks: PostBlock[]       // 본문 끝에 덧붙일 블록들
  signal?: AbortSignal
}

/**
 * 게시글의 각 사진별로 댓글을 작성 — 종합발행에서 카드 N장 각각에
 * 해당 상품의 주문 링크 댓글을 다는 용도.
 * comments 배열의 i번째 항목이 게시글의 i번째 사진에 매핑된다.
 */
export interface BandPerPhotoCommentParams {
  channelId: number
  bandKey: string
  bandName: string
  postKey: string
  comments: string[]        // 사진 순서대로 댓글 내용
  signal?: AbortSignal
}

export interface BandPerPhotoCommentResult {
  success: boolean
  total: number
  successCount: number
  failedCount: number
  error?: string
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
    commentContent?: string  // 발행 후 작성할 댓글 내용
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
