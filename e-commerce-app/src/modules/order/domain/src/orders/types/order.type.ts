/**
 * Order Service Types
 * 주문 서비스 관련 DTO 타입 정의
 */

/**
 * 배송 주소 정보
 */
export interface ShippingAddress {
  recipientName: string
  phone: string
  postalCode: string
  address: string
  detailAddress?: string
  memo?: string
}

/**
 * 고객 정보 (주문용)
 */
export interface CustomerInfo {
  name: string
  phone: string
  email?: string
  memo?: string
}

/**
 * 주문 생성 DTO
 */
export interface CreateOrderDTO {
  sessionId?: string
  userId?: number
  productId: number
  quantity: number
  customerInfo: CustomerInfo
  shippingAddress?: ShippingAddress
  paymentMethod?: string
}

/**
 * 주문 업데이트 DTO
 */
export interface UpdateOrderDTO {
  status?: string
  paymentStatus?: string
  shippingStatus?: string
  trackingNumber?: string
  customerMemo?: string
}

/**
 * 주문 필터
 */
export interface OrderFilter {
  userId?: number
  customerId?: number
  status?: string
  paymentStatus?: string
  shippingStatus?: string
  startDate?: Date
  endDate?: Date
  sortBy?: 'createdAt' | 'updatedAt' | 'totalAmount'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/**
 * 주문 응답 DTO (관계 포함)
 */
export interface OrderResponse {
  id: number
  orderNumber: string
  totalAmount: number
  status: string
  paymentStatus: string
  customer: {
    id: number
    name: string
    email: string | null
    phone: string
  }
  product: {
    id: number
    title: string
    images: string[]
    unitPrice: number
  }
  quantity: number
  subtotal: number
  shippingFee: number
  shippingAddress: ShippingAddress | null
  createdAt: Date
  updatedAt: Date
}

/**
 * 주문 생성 결과
 */
export interface CreateOrderResult {
  order: OrderResponse
  paymentRequest: {
    clientKey: string
    orderId: string
    orderName: string
    amount: number
    customerEmail?: string
    successUrl: string
    failUrl: string
  }
}

/**
 * 주문 통계
 */
export interface OrderStats {
  totalRevenue: number
  totalOrders: number
  paidOrders: number
  pendingOrders: number
  conversionRate: number
}
