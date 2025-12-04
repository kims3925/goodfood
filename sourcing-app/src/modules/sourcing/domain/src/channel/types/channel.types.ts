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
  // SHOP 플랫폼 전용 필드
  subdomain?: string | null
}

export interface ChannelThemeInput {
  primaryColor?: string | null
  secondaryColor?: string | null
  logoUrl?: string | null
  faviconUrl?: string | null
  bannerUrl?: string | null
  footerText?: string | null
}

export interface ChannelUpdateInput {
  name?: string
  isActive?: boolean
  coverUrl?: string | null
  // Retail 전용 필드
  accountHolder?: string | null
  bankAccount?: string | null
  bankName?: string | null
  // 서브도메인 쇼핑몰 필드
  subdomain?: string | null
  displayName?: string | null
  enableToss?: boolean
  enableBankTransfer?: boolean
  freeShippingAmount?: number | null
  defaultShippingFee?: number | null
  contactPhone?: string | null
  contactEmail?: string | null
  theme?: ChannelThemeInput
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
