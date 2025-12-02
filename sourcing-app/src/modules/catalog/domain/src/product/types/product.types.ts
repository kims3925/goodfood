export interface ProductListParams {
  userId: number
  collectedProductId?: number
  postId?: number
  search?: string
  channelId?: number
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface ProductCreateInput {
  userId: number
  postId?: number
  collectedProductId?: number
  name: string
  description?: string
  categoryId?: string
  currency?: string
  price?: number
  thumbnailUrl?: string | null
  imageUrls?: string[]
}

export interface ProductUpdateInput {
  name?: string
  description?: string
  categoryId?: string
  price?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
