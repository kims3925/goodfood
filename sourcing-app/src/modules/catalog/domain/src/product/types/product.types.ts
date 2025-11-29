export interface ProductListParams {
  userId: number
  postId?: number
  search?: string
  wholesaleBandId?: number
  status?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface ProductCreateInput {
  userId: number
  postId: number
  name: string
  description?: string
  categoryId?: string
  currency?: string
  price?: number
  wholesalePrice?: number
}

export interface ProductUpdateInput {
  name?: string
  description?: string
  categoryId?: string
  price?: number
  wholesalePrice?: number
  status?: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
