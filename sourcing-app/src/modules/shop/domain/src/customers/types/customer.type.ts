/**
 * Customer Service Types
 * 고객 서비스 관련 DTO 타입 정의
 */

/**
 * 고객 생성 DTO
 */
export interface CreateCustomerDTO {
  name: string
  phone: string
  email?: string
  address?: string
  memo?: string
}

/**
 * 고객 업데이트 DTO
 */
export interface UpdateCustomerDTO {
  name?: string
  phone?: string
  email?: string
  address?: string
  memo?: string
}

/**
 * 고객 필터
 */
export interface CustomerFilter {
  search?: string // 이름 또는 전화번호 검색
  email?: string
  phone?: string
  sortBy?: 'createdAt' | 'updatedAt' | 'name'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/**
 * 주문 정보가 포함된 고객 정보
 */
export interface CustomerWithOrders {
  id: number
  name: string
  phone: string
  email: string | null
  address: string | null
  memo: string | null
  createdAt: Date
  updatedAt: Date
  orderCount: number
  totalOrderAmount: number
  lastOrderDate: Date | null
}
