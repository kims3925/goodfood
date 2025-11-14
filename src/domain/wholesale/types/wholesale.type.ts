/**
 * Wholesale Service Types
 * 도매 서비스 관련 DTO 타입 정의
 */

/**
 * 소싱 확정 요청 DTO
 */
export interface ConfirmSourcingDTO {
  postIds: number[]
  userId: number
  finalContents?: Array<{
    id: number
    finalContent: string
  }>
}

/**
 * 소싱 확정 결과
 */
export interface ConfirmSourcingResult {
  createdProducts: Array<{
    id: number
    title: string
    salePrice: number
    originalPrice: number
    sourceId: number
  }>
  failedPosts: Array<{
    id: number
    reason: string
  }>
  totalCount: number
  successCount: number
  failedCount: number
}

/**
 * 가격 옵션
 */
export interface PriceOption {
  label: string
  price: number | string
  description?: string
  salePrice?: number
  originalPrice?: number
}

/**
 * 처리된 가격 정보
 */
export interface ProcessedPriceInfo {
  originalPriceOptions: PriceOption[]
  processedPriceOptions: PriceOption[]
  appliedPolicy: string
  shippingFee: number
  baseInfo: string
}

/**
 * 게시물 상품 변환 DTO
 */
export interface ConvertPostToProductDTO {
  postId: number
  userId: number
  finalContent?: string
}

/**
 * 게시물 수집 필터
 */
export interface CollectedPostFilter {
  userId: number
  wholesaleBandId?: number
  status?: string // PENDING, PROCESSED, FAILED
  isSelected?: boolean
  productCategory?: string
  startDate?: Date
  endDate?: Date
  search?: string
  sortBy?: 'createdAt' | 'updatedAt' | 'bandCreatedAt'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/**
 * 게시물 수집 통계
 */
export interface CollectedPostStats {
  totalPosts: number
  pendingPosts: number
  processedPosts: number
  failedPosts: number
  selectedPosts: number
  categoryBreakdown: Array<{
    category: string
    count: number
  }>
}
