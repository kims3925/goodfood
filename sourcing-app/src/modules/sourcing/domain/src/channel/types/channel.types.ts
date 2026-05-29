import { ChannelKind, ChannelPlatform, PriceTier } from '@bandauto/db'

export interface ChannelListParams {
  userId?: number
  kind?: ChannelKind
  platform?: ChannelPlatform
  search?: string
  page?: number
  limit?: number
}

export interface ChannelCreateInput {
  userId: number
  kind: ChannelKind
  platform: ChannelPlatform
  channelKey: string
  name: string
  coverUrl?: string | null
}

export interface ChannelUpdateInput {
  name?: string
  isActive?: boolean
  coverUrl?: string | null
  shopId?: number | null
  deletedAt?: Date | null
  // 지침서 Phase 1: 도매방별 취급 가격 범위 (수집 단계 필터)
  minSourcingPrice?: number | null
  maxSourcingPrice?: number | null
  // 도매방 주문 마감시간 (예: "오후 3시", "14:00")
  orderDeadline?: string | null
  // 다단계 발행: 발행 대상의 가격 tier (RETAIL 기본 / WHOLESALE=가족도매방, 도매가 발행)
  publishPriceTier?: PriceTier
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
