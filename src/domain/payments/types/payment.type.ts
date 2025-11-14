/**
 * Payment Service Types
 * 결제 서비스 관련 DTO 타입 정의
 */

/**
 * 결제 승인 요청 DTO
 */
export interface ConfirmPaymentDTO {
  paymentKey: string
  orderId: string
  amount: number
}

/**
 * 결제 취소 요청 DTO
 */
export interface CancelPaymentDTO {
  paymentKey: string
  cancelReason: string
  cancelAmount?: number
}

/**
 * 결제 필터
 */
export interface PaymentFilter {
  orderId?: number
  paymentKey?: string
  status?: string
  method?: string
  startDate?: Date
  endDate?: Date
  sortBy?: 'createdAt' | 'updatedAt' | 'amount'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/**
 * 결제 응답 DTO
 */
export interface PaymentResponse {
  id: number
  paymentKey: string
  orderId: number
  method: string
  amount: number
  status: string
  approvedAt: Date | null
  createdAt: Date
  updatedAt: Date
  refunds?: RefundResponse[]
}

/**
 * 환불 응답 DTO
 */
export interface RefundResponse {
  id: number
  paymentId: number
  amount: number
  reason: string
  status: string
  createdAt: Date
}

/**
 * 결제 승인 결과
 */
export interface ConfirmPaymentResult {
  payment: PaymentResponse
  order: {
    id: number
    orderNumber: string
    status: string
    paymentStatus: string
  }
  tossPaymentData: any
}

/**
 * 결제 취소 결과
 */
export interface CancelPaymentResult {
  refund: RefundResponse
  payment: PaymentResponse
  order: {
    id: number
    orderNumber: string
    status: string
    paymentStatus: string
  }
  tossCancelData: any
}
