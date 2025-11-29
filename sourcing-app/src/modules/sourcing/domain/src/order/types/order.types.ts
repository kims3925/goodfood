export interface OrderListParams {
  userId: number
  search?: string
  page?: number
  limit?: number
}

export interface OrderCreateInput {
  userId: number
  productId?: number | null
  productName: string
  totalPrice?: number | null
  customerName: string
}

export interface PaginatedResult<T> {
  orders: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
