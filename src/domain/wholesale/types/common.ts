/**
 * 공통 타입 정의
 */

/**
 * 기본 필터 인터페이스
 */
export interface BaseFilter {
  skip?: number
  take?: number
  orderBy?: string
  order?: 'asc' | 'desc'
}
