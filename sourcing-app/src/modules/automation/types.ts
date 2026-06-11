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
  limit?: number  // 채널당 수집 제한 (자동화: 10, 수동: 전체)
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
  createdPostIds?: number[]  // 생성된 게시물 ID 목록 (자동화 파이프라인 연계용)
  skippedByPrice?: number    // 지침서 Phase 1: 가격 범위 밖이라 수집에서 스킵한 게시글 수
}

/** @deprecated use ChannelCollectionResult instead */
export type BandCollectionResult = ChannelCollectionResult

// =============================================
// TRANSFORM PIPELINE TYPES
// =============================================

export interface TransformConfig {
  aiProvider: AiProvider
  pricingPolicyContent?: string | null
  postIds?: number[]
  transformPendingOnly?: boolean
  batchSize?: number  // 배치당 처리 항목 수 (기본값: 50)
}

export interface TransformResult extends PipelineResult {
  details: {
    transformedPosts: TransformedPost[]
    createdProducts: number      // 생성된 CollectedProduct 수
    skippedCount: number         // 스킵된 항목 수 (일시적 에러)
    retryablePostIds: number[]   // 재처리 가능한 postId 목록
    createdCollectedProductIds?: number[]  // 생성된 CollectedProduct ID 목록 (자동화 파이프라인 연계용)
    cancelled?: boolean          // 사용자 취소 여부
    rpdLimitReached?: boolean    // RPD 한도 도달 여부
  }
}

export interface TransformedPost {
  postId: number
  channelId?: number
  status: 'success' | 'failed' | 'skipped'
  error?: string
  errorType?: 'TRANSIENT' | 'PERMANENT'  // 에러 타입 (일시적/영구적)
  retryable?: boolean                     // 재시도 가능 여부
}

// =============================================
// PRODUCT CREATE PIPELINE TYPES
// =============================================

export interface ProductCreateConfig {
  channelIds?: number[]  // 특정 수집상품만 처리 (deprecated)
  collectedProductIds?: number[]  // 처리할 CollectedProduct ID 목록 (자동화 파이프라인 연계용)
  createPendingOnly?: boolean     // Product가 없는 수집상품만 처리
}

export interface ProductCreateResult extends PipelineResult {
  details: {
    createdProducts: CreatedProductResult[]
    totalCreated: number
    createdProductIds?: number[]  // 생성된 Product ID 목록 (자동화 파이프라인 연계용)
    cancelled?: boolean          // 사용자 취소 여부
  }
}

export interface CreatedProductResult {
  channelId: number
  productId?: number
  productName?: string
  status: 'success' | 'failed' | 'skipped'
  error?: string
}

// =============================================
// PUBLISH PIPELINE TYPES
// =============================================

/**
 * 발행 타깃 (B2B 공급몰 전환 STEP 1-1)
 * - SHOP_ONLY: 쇼핑몰만 발행 (밴드 발행 생략) — 도매밴드→쇼핑몰 B2B 파이프라인용
 * - BAND_ONLY: 밴드만 발행 (쇼핑몰 발행 생략)
 * - BOTH: 쇼핑몰 + 밴드 모두 발행 (기존 동작)
 */
export type PublishTarget = 'SHOP_ONLY' | 'BAND_ONLY' | 'BOTH'

export const PUBLISH_TARGETS: PublishTarget[] = ['SHOP_ONLY', 'BAND_ONLY', 'BOTH']

export function normalizePublishTarget(value: unknown): PublishTarget {
  return PUBLISH_TARGETS.includes(value as PublishTarget) ? (value as PublishTarget) : 'BOTH'
}

export interface PublishConfig {
  channelIds?: number[]
  productIds?: number[]
  publishReadyOnly?: boolean
  /** 오늘 생성된 상품만 발행 (자동화 파이프라인용) */
  todayOnly?: boolean
  /** 특정 날짜 이후 생성된 상품만 발행 */
  createdAfter?: Date
  /** 최근 N일 이내 생성된 상품만 발행 */
  daysWithin?: number
  /** 발행 타깃 — 미지정 시 BOTH (기존 동작) */
  publishTarget?: PublishTarget
}

export interface PublishResult extends PipelineResult {
  details: {
    publishedProducts: PublishedProductResult[]
    channelResults: ChannelPublishResult[]
    skippedProducts?: {
      productId: number
      reason: string
    }[]
    cancelled?: boolean          // 사용자 취소 여부
    sessionExpired?: boolean     // 세션 만료로 실패 여부
    failedChannel?: { id: number; name: string }  // 세션 만료된 채널 정보
  }
}

/**
 * 발행 대상 타입
 * - SHOP: 쇼핑몰 발행
 * - CHANNEL: Band 채널 발행
 */
export type PublishTargetType = 'SHOP' | 'CHANNEL'

export interface PublishedProductResult {
  productId: number
  targetType: PublishTargetType
  targetId: number  // shopId 또는 channelId
  targetName?: string
  postKey?: string
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED'
  error?: string
  /** @deprecated channelId 대신 targetId 사용 */
  channelId?: number
  /** @deprecated channelName 대신 targetName 사용 */
  channelName?: string
}

export interface ChannelPublishResult {
  targetType: PublishTargetType
  targetId: number  // shopId 또는 channelId
  targetName: string
  attempted: number
  success: number
  failed: number
  skipped: number
  errors: string[]
  /** @deprecated channelId 대신 targetId 사용 */
  channelId?: number
  /** @deprecated channelName 대신 targetName 사용 */
  channelName?: string
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

export type CronInterval = '1h' | '3h' | '6h' | '12h' | '24h' | 'custom'

export const CRON_EXPRESSIONS: Record<CronInterval, string> = {
  '1h': '0 * * * *',
  '3h': '0 */3 * * *',
  '6h': '0 */6 * * *',
  '12h': '0 */12 * * *',
  '24h': '0 0 * * *',
  'custom': '', // selectedHours로 처리
}

export const INTERVAL_LABELS: Record<CronInterval, string> = {
  '1h': '1시간마다',
  '3h': '3시간마다',
  '6h': '6시간마다',
  '12h': '12시간마다',
  '24h': '24시간마다 (자정)',
  'custom': '지정 시간',
}

// 선택된 시간들을 cron expression으로 변환 (하위 호환)
export function selectedHoursToCron(hours: number[]): string {
  if (hours.length === 0) return '0 * * * *'
  if (hours.length === 24) return '0 * * * *'

  const sortedHours = [...hours].sort((a, b) => a - b)
  return `0 ${sortedHours.join(',')} * * *`
}

// cron expression에서 선택된 시간들 추출 (하위 호환)
export function cronToSelectedHours(cron: string | null): number[] {
  if (!cron) return []

  // 파이프 구분 다중 cron인 경우 scheduleTimes에서 시간만 추출
  if (cron.includes('|')) {
    const times = cronsToScheduleTimes(cron)
    return [...new Set(times.map(t => parseInt(t.split(':')[0])))].sort((a, b) => a - b)
  }

  const parts = cron.split(' ')
  if (parts.length !== 5) return []

  const hourPart = parts[1]

  if (hourPart === '*') {
    return Array.from({ length: 24 }, (_, i) => i)
  }

  if (hourPart.startsWith('*/')) {
    const interval = parseInt(hourPart.substring(2))
    const hours: number[] = []
    for (let h = 0; h < 24; h += interval) {
      hours.push(h)
    }
    return hours
  }

  if (hourPart.includes(',')) {
    return hourPart.split(',').map(h => parseInt(h)).filter(h => !isNaN(h))
  }

  const singleHour = parseInt(hourPart)
  if (!isNaN(singleHour)) {
    return [singleHour]
  }

  return []
}

/**
 * "HH:MM" 시간 배열을 파이프 구분 다중 cron expression으로 변환
 * 같은 분 그룹끼리 묶어 cron 수를 최소화
 *
 * @example
 * scheduleTimesToCrons(["11:00", "14:00", "16:30"])
 * // → "0 11,14 * * *|30 16 * * *"
 */
export function scheduleTimesToCrons(times: string[]): string {
  if (times.length === 0) return '0 * * * *'

  // 분 기준으로 그룹핑
  const minuteGroups: Record<number, number[]> = {}
  for (const time of times) {
    const [h, m] = time.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) continue
    if (!minuteGroups[m]) {
      minuteGroups[m] = []
    }
    minuteGroups[m].push(h)
  }

  // 각 분 그룹별 cron expression 생성
  const crons = Object.entries(minuteGroups)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([minute, hours]) => {
      const sortedHours = [...hours].sort((a, b) => a - b)
      return `${minute} ${sortedHours.join(',')} * * *`
    })

  return crons.join('|')
}

/**
 * 파이프 구분 다중 cron expression에서 "HH:MM" 시간 배열 추출
 *
 * @example
 * cronsToScheduleTimes("0 11,14 * * *|30 16 * * *")
 * // → ["11:00", "14:00", "16:30"]
 */
export function cronsToScheduleTimes(cronExpr: string | null): string[] {
  if (!cronExpr) return []

  const cronParts = cronExpr.split('|')
  const times: string[] = []

  for (const singleCron of cronParts) {
    const parts = singleCron.trim().split(' ')
    if (parts.length !== 5) continue

    const minutePart = parts[0]
    const hourPart = parts[1]

    // 분 파싱
    const minute = minutePart === '*' ? -1 : parseInt(minutePart)

    // 매 시간인 경우 스킵 (전체 선택으로 간주하지 않음)
    if (hourPart === '*' || hourPart.startsWith('*/')) continue

    // 시간 파싱
    const hours = hourPart.includes(',')
      ? hourPart.split(',').map(h => parseInt(h)).filter(h => !isNaN(h))
      : [parseInt(hourPart)].filter(h => !isNaN(h))

    for (const h of hours) {
      const m = minute === -1 ? 0 : minute
      times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
    }
  }

  // 시간순 정렬
  return times.sort((a, b) => {
    const [ah, am] = a.split(':').map(Number)
    const [bh, bm] = b.split(':').map(Number)
    return ah !== bh ? ah - bh : am - bm
  })
}
