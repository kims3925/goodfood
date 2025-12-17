export interface ProductListParams {
  userId: number
  channelId?: number
  postId?: number
  search?: string
  sourcePlatform?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface OptionGroupInput {
  groupName: string
  values: string[]
}

export interface VariantInput {
  optionSummary?: string
  options?: Record<string, string>
  wholesalePrice?: number
  price?: number
}

export interface ProductCreateInput {
  userId: number
  postId?: number
  channelId?: number
  name: string
  description?: string
  categoryId?: string
  currency?: string
  wholesalePrice?: number
  price?: number
  shippingFee?: number
  shippingInfo?: string
  thumbnailUrl?: string | null
  imageUrls?: string[]
  options?: OptionGroupInput[]
  variants?: VariantInput[]
}

export interface OptionInput {
  groupName: string
  value: string
  sortOrder?: number
}

export interface ProductUpdateInput {
  name?: string
  description?: string
  categoryId?: string
  wholesalePrice?: number
  price?: number
  shippingFee?: number
  shippingInfo?: string
  options?: OptionInput[]
  variants?: VariantInput[]
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
