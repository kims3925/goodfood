/**
 * Publish Module Types
 * 발행 서비스 타입 정의
 */

export interface PublishToChannelParams {
  userId: number
  productId: number
  channelId: number
}

export interface PublishToChannelResult {
  success: boolean
  productId: number
  channelId: number
  postKey?: string
  publishedProductId?: number
  error?: string
  skipped?: boolean
  skipReason?: string
}

export interface PublishBatchParams {
  userId: number
  productIds: number[]
  channelId: number
}

export interface PublishBatchResult {
  success: boolean
  channelId: number
  channelName: string
  total: number
  successCount: number
  failedCount: number
  skippedCount: number
  results: PublishToChannelResult[]
  errors: string[]
}

export interface PublishMultiChannelParams {
  userId: number
  productIds: number[]
  channelIds: number[]
  cooldownMs?: number
}

export interface PublishMultiChannelResult {
  success: boolean
  totalItems: number
  successCount: number
  failedCount: number
  skippedCount: number
  channelResults: PublishBatchResult[]
}

export interface ProductForPublish {
  id: number
  name: string
  description: string | null
  variants: Array<{
    id: number
    price: number
    wholesalePrice: number | null
  }>
  collectedProduct?: {
    post?: {
      content: string | null
    } | null
  } | null
}

export interface ChannelForPublish {
  id: number
  name: string
  channelKey: string
  platform: string
  apiConfig: {
    accessToken: string
  } | null
}
