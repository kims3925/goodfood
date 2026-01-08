/**
 * 대시보드 타입 정의
 *
 * 소싱 현황 및 자동화 대시보드에서 사용되는 타입
 */

// ============================================================
// 채널 통계 관련 타입
// ============================================================

/**
 * 채널 종류
 */
export type ChannelKind = 'WHOLESALE' | 'RETAIL'

/**
 * 연결된 쇼핑몰 정보
 */
export interface ChannelShopInfo {
  /** 쇼핑몰 ID */
  id: number
  /** 쇼핑몰 이름 */
  name: string
  /** 쇼핑몰 서브도메인 */
  subdomain: string
}

/**
 * 개별 채널 통계
 */
export interface ChannelStat {
  /** 채널 ID */
  channelId: number
  /** 채널 이름 */
  channelName: string
  /** 채널 커버 이미지 URL */
  coverUrl?: string | null
  /** 채널 종류 (도매/소매) */
  kind: ChannelKind
  /** 채널 활성화 여부 */
  isActive: boolean
  /** 수집된 상품 수 */
  collected: number
  /** 변환된 상품 수 */
  transformed: number
  /** 생성된 상품 수 */
  products: number
  /** 발행된 상품 수 */
  published: number
  /** 변환율 (%) */
  transformRate: number
  /** 발행율 (%) - 채널 */
  publishRate: number
  /** 쇼핑몰에 발행된 상품 수 */
  shopPublished?: number
  /** 쇼핑몰 발행율 (%) */
  shopPublishRate?: number
  /** 연결된 쇼핑몰 (소매채널만 해당) */
  shop?: ChannelShopInfo | null
}

/**
 * 채널 통계 요약
 */
export interface ChannelStatsSummary {
  /** 전체 채널 수 */
  totalChannels: number
  /** 활성 채널 수 */
  activeChannels: number
  /** 전체 수집 건수 */
  totalCollected: number
  /** 전체 변환 건수 */
  totalTransformed: number
  /** 전체 상품 수 */
  totalProducts: number
  /** 전체 발행 건수 */
  totalPublished: number
}

/**
 * 채널 통계 API 응답
 * GET /api/channel/stats
 */
export interface ChannelStatsResponse {
  success: boolean
  data?: {
    summary: ChannelStatsSummary
    channels: ChannelStat[]
  }
  error?: string
}

// ============================================================
// 상품 흐름 (퍼널) 관련 타입
// ============================================================

/**
 * 수집 단계 통계
 */
export interface CollectionFlowStats {
  /** 완료된 수집 수 */
  completed: number
  /** 대기 중인 수집 수 */
  pending: number
  /** 오늘 신규 수집 수 */
  todayNew: number
}

/**
 * 변환 단계 통계
 */
export interface TransformFlowStats {
  /** 완료된 변환 수 */
  completed: number
  /** 대기 중인 변환 수 */
  pending: number
  /** 실패한 변환 수 */
  failed: number
  /** 변환율 (%) */
  conversionRate: number
}

/**
 * 상품 생성 단계 통계
 */
export interface ProductCreateFlowStats {
  /** 완료된 상품 생성 수 */
  completed: number
  /** 대기 중인 상품 수 */
  pending: number
  /** 전환율 (%) */
  conversionRate: number
}

/**
 * 채널별 발행 통계
 */
export interface PublishByChannel {
  /** 채널 ID */
  channelId: number
  /** 채널 이름 */
  channelName: string
  /** 발행 수 */
  count: number
}

/**
 * 발행 단계 통계
 */
export interface PublishFlowStats {
  /** 완료된 발행 수 */
  completed: number
  /** 대기 중인 발행 수 */
  pending: number
  /** 채널별 발행 현황 */
  byChannel: PublishByChannel[]
  /** 전환율 (%) */
  conversionRate: number
}

/**
 * 상품 흐름 요약
 * GET /api/sourcing/flow-summary
 */
export interface FlowSummary {
  /** 수집 단계 */
  collection: CollectionFlowStats
  /** 변환 단계 */
  transform: TransformFlowStats
  /** 상품 생성 단계 */
  productCreate: ProductCreateFlowStats
  /** 발행 단계 */
  publish: PublishFlowStats
  /** 전체 전환율 (수집 → 발행) */
  overallConversionRate: number
}

/**
 * 상품 흐름 요약 API 응답
 */
export interface FlowSummaryResponse {
  success: boolean
  data?: FlowSummary
  error?: string
}

// ============================================================
// 헤더 통계 관련 타입
// ============================================================

/**
 * 헤더에 표시되는 소싱 통계
 */
export interface HeaderSourcingStats {
  /** 오늘 수집된 상품 수 */
  todayCollected: number
  /** 신규 상품 수 (변환 대기) */
  newProducts: number
  /** 판매 대기 상품 수 */
  pendingSale: number
  /** 활성 채널 수 */
  activeChannels: number
  /** 전체 채널 수 */
  totalChannels: number
}

/**
 * 헤더 통계 API 응답
 */
export interface HeaderStatsResponse {
  success: boolean
  data?: HeaderSourcingStats
  error?: string
}

// ============================================================
// 대시보드 탭 관련 타입
// ============================================================

/**
 * 대시보드 탭 종류
 */
export type DashboardTab = 'sourcing' | 'automation'

/**
 * 대시보드 필터
 */
export interface DashboardFilter {
  /** 선택된 탭 */
  tab: DashboardTab
  /** 기간 필터 (일 단위) */
  days?: number
  /** 채널 종류 필터 */
  channelKind?: ChannelKind | 'all'
}

// ============================================================
// KPI 카드 관련 타입
// ============================================================

/**
 * KPI 카드 데이터
 */
export interface KpiCardData {
  /** 카드 제목 */
  title: string
  /** 현재 값 */
  value: number | string
  /** 이전 값 (비교용) */
  previousValue?: number
  /** 변화율 (%) */
  changeRate?: number
  /** 변화 방향 */
  trend?: 'up' | 'down' | 'neutral'
  /** 아이콘 이름 */
  icon?: string
  /** 색상 테마 */
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}

// ============================================================
// 기존 자동화 관련 타입 (대시보드 페이지에서 이동)
// ============================================================

/**
 * 자동화 상태
 */
export interface AutomationStats {
  isRunning: boolean
  hasSchedule: boolean
  lastRun?: string | null
  lastStatus?: string | null
  runningWorkflow?: {
    id: number
    type: string
    status: string
    progress: number
    currentStep?: string
    startedAt: string
    steps?: WorkflowStepInfo[]
  } | null
}

/**
 * 워크플로우 단계 정보
 */
export interface WorkflowStepInfo {
  stepType: string
  stepOrder: number
  status: string
  startedAt?: string | null
  completedAt?: string | null
  duration?: number | null
  totalItems: number
  processedItems: number
  successCount: number
  failedCount: number
  progress: number
  errorMessage?: string | null
}

/**
 * 자동화 설정
 */
export interface AutomationConfig {
  enabled: boolean
  cronExpression?: string
  retryLimit: number
  alertOnFailure: boolean
}

/**
 * 시간대별 통계
 */
export interface HourlyStats {
  hour: number
  collected: number
  transformed: number
  published: number
  failed: number
}

/**
 * 최근 로그
 */
export interface RecentLog {
  id: number
  type: string
  status: string
  itemCount: number
  duration: number | null
  startedAt: string
  completedAt?: string | null
  errorMessage?: string | null
  currentStep?: string | null
  steps?: WorkflowStepInfo[]
}

/**
 * 일별 통계
 */
export interface DailyStat {
  date: string
  collected: number
  transformed: number
  published: number
  failed: number
}
