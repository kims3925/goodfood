/**
 * RetailBand Service DTO 타입 정의
 */

import { RetailBand } from '@bandauto/db'
import { BaseFilter } from './common'

/**
 * 소매 밴드 생성 DTO
 */
export interface CreateRetailBandDTO {
  userId: number
  bandKey: string
  bandName: string
  description?: string
  coverUrl?: string | null
  isActive?: boolean
}

/**
 * 소매 밴드 업데이트 DTO
 */
export interface UpdateRetailBandDTO {
  bandName?: string
  description?: string
  coverUrl?: string | null
  isActive?: boolean
}

/**
 * 소매 밴드 필터 DTO
 */
export interface RetailBandFilter extends BaseFilter {
  userId: number
  isActive?: boolean
  bandKey?: string
}
