/**
 * WholesaleBand Service DTO 타입 정의
 */

import { WholesaleBand } from '@bandauto/db'
import { BaseFilter } from './common'

/**
 * 도매 밴드 생성 DTO (Band API에서 받은 데이터)
 */
export interface CreateWholesaleBandDTO {
  userId: number
  name: string
  bandKey: string
  description?: string | null
  coverUrl?: string | null
  pricingPolicy?: string | null
  isActive?: boolean
}

/**
 * 도매 밴드 업데이트 DTO
 */
export interface UpdateWholesaleBandDTO {
  name?: string
  description?: string | null
  coverUrl?: string | null
  pricingPolicy?: string | null
  isActive?: boolean
}

/**
 * 도매 밴드 필터 DTO
 */
export interface WholesaleBandFilter extends BaseFilter {
  userId: number
  isActive?: boolean
  bandKey?: string
}

/**
 * Band API에서 받은 밴드 정보
 */
export interface BandApiResponse {
  band_key: string
  name: string
  description?: string
  cover?: string
  is_public?: boolean
}

/**
 * 도매 밴드 일괄 등록 DTO
 */
export interface CreateManyWholesaleBandsDTO {
  userId: number
  bands: BandApiResponse[]
}

/**
 * 도매 밴드 일괄 삭제 결과
 */
export interface DeleteWholesaleBandsResult {
  success: boolean
  message: string
  deletedCount: number
  deletedPostsCount: number
}
