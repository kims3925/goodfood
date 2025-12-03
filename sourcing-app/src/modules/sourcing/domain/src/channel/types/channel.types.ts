import { ChannelKind, ChannelPlatform } from '@bandauto/db'

export interface ChannelListParams {
  kind?: ChannelKind
  platform?: ChannelPlatform
  search?: string
  page?: number
  limit?: number
}

export interface ChannelCreateInput {
  userId: number
  apiConfigId: number | null
  kind: ChannelKind
  platform: ChannelPlatform
  channelKey: string
  name: string
  coverUrl?: string | null
  // Retail 전용 필드
  accountHolder?: string | null
  bankAccount?: string | null
  bankName?: string | null
}

export interface ChannelUpdateInput {
  name?: string
  isActive?: boolean
  coverUrl?: string | null
  // Retail 전용 필드
  accountHolder?: string | null
  bankAccount?: string | null
  bankName?: string | null
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
