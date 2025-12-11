import { ChannelKind, ChannelPlatform } from '@bandauto/db'

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
  // BAND 플랫폼 전용 필드
  naverId?: string | null
  naverPassword?: string | null
}

export interface ChannelUpdateInput {
  name?: string
  isActive?: boolean
  coverUrl?: string | null
  shopId?: number | null
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
