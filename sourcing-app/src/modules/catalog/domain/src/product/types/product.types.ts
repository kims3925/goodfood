export interface ProductListParams {
  userId: number
  channelId?: number
  postId?: number
  search?: string
  sourcePlatform?: string
  startDate?: string
  endDate?: string
  publishStatus?: 'all' | 'unpublished' | 'published'
  /** 카테고리 코드 필터 (예: 'SEA', 'UNCLASSIFIED'=분류 대기) */
  categoryId?: string
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
  bundleUnit?: number  // 합배송 단위 수 (예: 2박스 옵션이면 2)
}

export interface ProductCreateInput {
  userId: number
  postId?: number
  channelId?: number
  name: string
  sourceProductName?: string
  collectedPostId?: number
  description?: string
  categoryId?: string
  currency?: string
  wholesalePrice?: number
  price?: number
  shippingFee?: number
  shippingInfo?: string
  bundleMaxQty?: number  // 합배송 최대 수량
  // 가격정책의 "배송비:" 항목 — 'separate' / 'included' / undefined.
  // 지정되면 본문 키워드 추론을 무시하고 정책 값으로 bundleShippingType 결정.
  policyShippingType?: 'separate' | 'included'
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
  bundleMaxQty?: number  // 합배송 최대 수량
  bundleUnit?: string  // 합배송 단위
  options?: OptionInput[]
  variants?: VariantInput[]
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
