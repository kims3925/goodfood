export interface PolicyListParams {
  userId: number
  search?: string
  page?: number
  limit?: number
}

export interface PolicyCreateInput {
  userId: number
  name: string
  description?: string
  content: string
  isActive?: boolean
}

export interface PolicyUpdateInput {
  name?: string
  description?: string
  content?: string
  isActive?: boolean
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
