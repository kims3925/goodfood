/**
 * Service Layer 공통 타입 정의
 */

/**
 * 페이징 요청 파라미터
 */
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

/**
 * 정렬 파라미터
 */
export interface SortParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * 날짜 범위 필터
 */
export interface DateRangeFilter {
  startDate?: Date | string
  endDate?: Date | string
}

/**
 * 기본 필터 타입
 */
export interface BaseFilter extends PaginationParams, SortParams {
  search?: string
  userId?: number
}

/**
 * ID 기반 삭제 요청
 */
export interface DeleteManyDTO {
  ids: number[]
}

/**
 * 상태 업데이트 요청
 */
export interface UpdateStatusDTO {
  id: number
  status: string
}

/**
 * 서비스 결과 타입 (성공/실패 정보 포함)
 */
export interface ServiceResult<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
}

/**
 * 일괄 작업 결과
 */
export interface BatchResult<T = unknown> {
  success: boolean
  totalProcessed: number
  successCount: number
  failureCount: number
  results: Array<{
    id: number
    success: boolean
    data?: T
    error?: string
  }>
}
