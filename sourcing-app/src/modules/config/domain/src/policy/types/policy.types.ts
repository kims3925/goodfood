export interface PolicyListParams {
  userId: number
  channelId?: number
  search?: string
  page?: number
  limit?: number
}

// 경영밴드 이원화 정책 (2026-05-28)
export type PolicyApplyMode = 'INHERIT' | 'ZERO_MARGIN' | 'CUSTOM'

export interface PolicyTargetInput {
  retailChannelId: number
  applyMode: PolicyApplyMode
  customContent?: string | null
}

export interface PolicyCreateInput {
  userId: number
  channelId: number
  name: string
  description?: string
  content: string
  isActive?: boolean
  // GBand SaaS Phase 3 — postType별 차등 마진 (JSON 또는 stringified). null/undefined 면 옛 로직 fallthrough.
  tierRules?: unknown
  // 경영밴드 이원화 정책 — 소매채널별 적용 모드. 없거나 빈 배열이면 모든 소매채널 INHERIT.
  targets?: PolicyTargetInput[]
}

export interface PolicyUpdateInput {
  channelId?: number
  name?: string
  description?: string
  content?: string
  isActive?: boolean
  tierRules?: unknown
  // 전달되면 기존 targets 를 모두 삭제하고 새 배열로 대체 (트랜잭션). undefined 면 targets 변경 안 함.
  targets?: PolicyTargetInput[]
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
