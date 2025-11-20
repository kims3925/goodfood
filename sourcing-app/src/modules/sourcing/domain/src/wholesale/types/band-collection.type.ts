/**
 * Band Collection Service Types
 * 밴드 게시물 수집 서비스 관련 DTO 타입 정의
 */

/**
 * 게시물 수집 요청 DTO
 */
export interface CollectPostsDTO {
  bandId: number
  userId: number
  dateRange?: {
    since?: string
    until?: string
  }
  limit?: number
}

/**
 * 게시물 수집 결과
 */
export interface CollectPostsResult {
  totalFetched: number
  newPosts: number
  duplicates: number
  failed: number
  collectedPosts: Array<{
    id: number
    title: string
    bandKey: string
    postKey: string
    productCategory: string | null
  }>
  errors: Array<{
    postKey: string
    reason: string
  }>
}

/**
 * AI 분석 결과
 */
export interface AIAnalysisResult {
  hookingTitle?: string
  hookingContent?: string
  detailedContent?: string
  productCategory?: string
  priceOptions?: Array<{
    label: string
    price: string | number
    description?: string
  }>
  shippingFee?: number
  hasDeadline?: boolean
  deadlineInfo?: string
  isAvailable?: boolean
  unavailableReason?: string
  priceInfo?: string
}

/**
 * 게시물 수집 진행 상태
 */
export interface CollectionProgress {
  bandId: number
  status: 'idle' | 'fetching' | 'analyzing' | 'saving' | 'completed' | 'failed'
  progress: number // 0-100
  currentStep: string
  totalPosts: number
  processedPosts: number
  message?: string
  error?: string
}

/**
 * 중복 체크 결과
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean
  existingPostId?: number
  similarity?: number
}
