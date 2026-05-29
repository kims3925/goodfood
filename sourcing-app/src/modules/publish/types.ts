/**
 * Publish Module Types
 * 발행 서비스 타입 정의
 */

export interface PublishToChannelParams {
  userId: number
  productId: number
  channelId: number
  // 다단계 발행 fan-out 묶음 ID (saga 추적). 지정 시 ChannelProduct.publishBatchId 에 스냅샷.
  publishBatchId?: string
}

export interface PublishToChannelResult {
  success: boolean
  productId: number
  channelId: number
  postKey?: string
  publishedProductId?: number
  error?: string
  skipped?: boolean
  skipReason?: string
  // 발행 방법 및 이미지 정보
  imageCount?: number
  publishMethod?: 'playwright' | 'api'
  // 다단계 발행: 적용된 가격 tier 및 도매가 폴백 여부 (진단용)
  priceTier?: 'WHOLESALE' | 'RETAIL'
  wholesaleFallback?: boolean
}

export interface PublishBatchParams {
  userId: number
  productIds: number[]
  channelId: number
  onProgress?: (current: number, total: number, result: PublishToChannelResult) => void | Promise<void>
  // 다단계 발행 fan-out 묶음 ID (saga 추적)
  publishBatchId?: string
}

export interface PublishBatchResult {
  success: boolean
  channelId: number
  channelName: string
  total: number
  successCount: number
  failedCount: number
  skippedCount: number
  results: PublishToChannelResult[]
  errors: string[]
}

export interface PublishMultiChannelParams {
  userId: number
  productIds: number[]
  channelIds: number[]
  cooldownMs?: number
}

export interface PublishMultiChannelResult {
  success: boolean
  totalItems: number
  successCount: number
  failedCount: number
  skippedCount: number
  channelResults: PublishBatchResult[]
}

export interface ProductForPublish {
  id: number
  name: string
  description: string | null
  shippingFee: number | null
  bundleShippingType: string | null
  variants: Array<{
    id: number
    optionSummary: string | null
    price: number
    wholesalePrice: number | null
  }>
  collectedProduct?: {
    post?: {
      content: string | null
    } | null
  } | null
}

export interface ChannelForPublish {
  id: number
  name: string
  channelKey: string
  platform: string
  apiConfig: {
    accessToken: string
  } | null
}

// Shop 발행 관련 타입
export interface PublishToShopParams {
  userId: number
  productId: number
  shopId: number
}

export interface PublishToShopResult {
  success: boolean
  productId: number
  shopId: number
  publishedProductId?: number
  error?: string
  skipped?: boolean
  skipReason?: string
}

export interface PublishShopBatchParams {
  userId: number
  productIds: number[]
  shopId: number
}

export interface PublishShopBatchResult {
  success: boolean
  shopId: number
  shopName: string
  total: number
  successCount: number
  failedCount: number
  skippedCount: number
  results: PublishToShopResult[]
  errors: string[]
}

// ============================================
// 실시간 진행 상태 타입 (SSE용)
// ============================================

/**
 * 발행 단계
 */
export type PublishStage =
  | 'preparing'      // 준비 중
  | 'downloading'    // 이미지 다운로드 중
  | 'uploading'      // 이미지 업로드 중
  | 'entering'       // 내용 입력 중
  | 'submitting'     // 발행 제출 중
  | 'commenting'     // 댓글 작성 중
  | 'completed'      // 완료
  | 'failed'         // 실패
  | 'skipped'        // 건너뜀
  | 'retrying'       // 재시도 중

/**
 * 상세 진행 상태
 */
export interface PublishDetailedProgress {
  productId: number
  productName: string
  stage: PublishStage
  stageLabel: string           // 사용자에게 표시할 단계 라벨
  imageProgress?: {
    current: number            // 현재 업로드된 이미지 수
    total: number              // 전체 이미지 수
  }
  uploadProgress?: {
    fileIndex: string          // "1/10" 형식
    totalPercent: string       // "10%" 형식
    currentPercent: string     // "92%" 형식
  }
  error?: string               // 실패 시 에러 메시지
  publishMethod?: 'playwright' | 'api'
}

/**
 * SSE 이벤트 타입
 */
export type PublishSSEEventType =
  | 'batch_start'          // 배치 발행 시작
  | 'product_start'        // 개별 상품 발행 시작
  | 'stage_update'         // 단계 변경
  | 'image_progress'       // 이미지 업로드 진행률
  | 'product_complete'     // 개별 상품 발행 완료
  | 'batch_complete'       // 배치 발행 완료
  | 'error'                // 에러 발생
  | 'cancelled'            // 발행 취소됨

/**
 * SSE 이벤트
 */
export interface PublishSSEEvent {
  type: PublishSSEEventType
  timestamp: number
  data: {
    // 배치 정보
    channelId?: number
    channelName?: string
    totalProducts?: number
    currentIndex?: number

    // 상품별 진행 상태
    progress?: PublishDetailedProgress

    // 완료 통계
    successCount?: number
    failedCount?: number
    skippedCount?: number

    // 에러 정보
    error?: string

    // 메시지 (취소 등)
    message?: string

    // 취소 시 처리 정보
    processedCount?: number
    totalCount?: number
  }
}

/**
 * 단계별 콜백 함수 타입
 */
export type PublishStageCallback = (progress: PublishDetailedProgress) => void | Promise<void>
