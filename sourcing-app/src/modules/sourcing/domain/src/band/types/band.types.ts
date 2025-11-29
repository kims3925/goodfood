export interface BandListParams {
  search?: string
  page?: number
  limit?: number
}

export interface BandCreateInput {
  userId: number
  apiConfigId: number
  bandKey: string
  name: string
  coverUrl?: string | null
}

export interface BandUpdateInput {
  name?: string
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
