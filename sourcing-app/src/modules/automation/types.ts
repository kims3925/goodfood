/**
 * Automation Module Types
 * 자동화 워크플로우 타입 정의
 */

import { WorkflowType, WorkflowStatus, AiProvider, TriggerType } from '@bandauto/db'

export { TriggerType }

// =============================================
// CONTEXT TYPES
// =============================================

export interface BatchContext {
  userId: number
  email: string
  automationConfigId?: number
  workflowLogId?: number
  shopIds?: number[]
}

// =============================================
// PIPELINE RESULT TYPES
// =============================================

export interface PipelineResult {
  success: boolean
  totalItems: number
  successCount: number
  failedCount: number
  details: Record<string, any>
  errors: PipelineError[]
}

export interface PipelineError {
  itemId?: number | string
  message: string
  code?: string
  timestamp: Date
}

// =============================================
// COLLECTION PIPELINE TYPES
// =============================================

export interface CollectionConfig {
  channelIds?: number[]  // 필수 (비어있으면 수집 안함)
  limit?: number  // 채널당 수집 제한 (기본값: 50)
  batchSize?: number  // 배치당 처리 채널 수
}

export interface CollectionResult extends PipelineResult {
  details: {
    channelResults: ChannelCollectionResult[]
    totalNewPosts: number
    totalDuplicates: number
  }
}

export interface ChannelCollectionResult {
  channelId: number
  channelName: string
  fetched: number
  newPosts: number
  duplicates: number
  failed: number
  errors: string[]
}

/** @deprecated use ChannelCollectionResult instead */
export type BandCollectionResult = ChannelCollectionResult

// =============================================
// TRANSFORM PIPELINE TYPES
// =============================================

export interface TransformConfig {
  aiProvider: AiProvider
  pricingPolicyId?: number | null
  pricingPolicyContent?: string | null
  postIds?: number[]
  transformPendingOnly?: boolean
  batchSize?: number  // 배치당 처리 항목 수 (기본값: 50)
}

export interface TransformResult extends PipelineResult {
  details: {
    transformedPosts: TransformedPost[]
    createdProducts: number // 생성된 CollectedProduct 수
  }
}

export interface TransformedPost {
  postId: number
  collectedProductId?: number
  status: 'success' | 'failed' | 'skipped'
  error?: string
}

// =============================================
// PRODUCT CREATE PIPELINE TYPES
// =============================================

export interface ProductCreateConfig {
  collectedProductIds?: number[]  // 특정 수집상품만 처리
  createPendingOnly?: boolean     // Product가 없는 수집상품만 처리
}

export interface ProductCreateResult extends PipelineResult {
  details: {
    createdProducts: CreatedProductResult[]
    totalCreated: number
  }
}

export interface CreatedProductResult {
  collectedProductId: number
  productId?: number
  status: 'success' | 'failed' | 'skipped'
  error?: string
}

// =============================================
// PUBLISH PIPELINE TYPES
// =============================================

export interface PublishConfig {
  channelIds?: number[]
  productIds?: number[]
  publishReadyOnly?: boolean
}

export interface PublishResult extends PipelineResult {
  details: {
    publishedProducts: PublishedProductResult[]
    channelResults: ChannelPublishResult[]
  }
}

export interface PublishedProductResult {
  productId: number
  channelId: number
  postKey?: string
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED'
  error?: string
}

export interface ChannelPublishResult {
  channelId: number
  channelName: string
  attempted: number
  success: number
  failed: number
  skipped: number
  errors: string[]
}

/** @deprecated use ChannelPublishResult instead */
export type BandPublishResult = ChannelPublishResult

// =============================================
// FULL PIPELINE TYPES
// =============================================

export interface FullPipelineConfig {
  collection: CollectionConfig
  transform: TransformConfig
  productCreate: ProductCreateConfig
  publish: PublishConfig
}

export interface FullPipelineResult {
  success: boolean
  startedAt: Date
  completedAt: Date
  collection?: CollectionResult
  transform?: TransformResult
  productCreate?: ProductCreateResult
  publish?: PublishResult
  overallStatus: WorkflowStatus
}

// =============================================
// WORKFLOW LOG TYPES
// =============================================

export interface WorkflowLogInput {
  userId: number
  workflowType: WorkflowType
  triggerType?: TriggerType
}

export interface WorkflowLogUpdate {
  status?: WorkflowStatus
  completedAt?: Date
  totalItems?: number
  successCount?: number
  failedCount?: number
  details?: Record<string, any>
  errorMessage?: string
}

// =============================================
// STATS TYPES (FOR HEADER)
// =============================================

export interface AutomationStats {
  // 기존 필드
  todayCollected: number
  pendingTransform: number
  readyToPublish: number
  todayPublished: number

  // 전체 진행률 계산용 추가 필드
  totalPosts: number           // 전체 게시물 수
  totalTransformed: number     // AI 변환 완료된 게시물 수 (collectedProduct가 있는 게시물)
  totalProducts: number        // 등록된 상품 수 (Product)
  totalPublishedProducts: number  // 발행된 상품 수 (PublishedProduct의 distinct productId)

  // 오늘 통계
  todayTransformed: number     // 오늘 AI 변환 완료
  todayProducts: number        // 오늘 등록된 상품
}

// =============================================
// CRON SCHEDULE TYPES
// =============================================

export type CronInterval = '1h' | '3h' | '6h' | '12h' | '24h'

export const CRON_EXPRESSIONS: Record<CronInterval, string> = {
  '1h': '0 * * * *',
  '3h': '0 */3 * * *',
  '6h': '0 */6 * * *',
  '12h': '0 */12 * * *',
  '24h': '0 0 * * *',
}

export const INTERVAL_LABELS: Record<CronInterval, string> = {
  '1h': '1시간마다',
  '3h': '3시간마다',
  '6h': '6시간마다',
  '12h': '12시간마다',
  '24h': '24시간마다 (자정)',
}
