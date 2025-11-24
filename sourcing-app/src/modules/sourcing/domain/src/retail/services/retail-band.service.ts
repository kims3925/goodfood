/**
 * RetailBand Service
 * 소매 밴드 비즈니스 로직 레이어
 */

import { RetailBand } from '@prisma/client'
import {
  retailBandRepository,
  RetailBandRepository
} from '@/domain/retail/repository/retail-band.repository'
import {
  CreateRetailBandDTO,
  UpdateRetailBandDTO,
  RetailBandFilter
} from '@/types/services/retail-band'
import {
  ValidationError,
  NotFoundError,
  DuplicateError
} from '@/lib/errors/handlers'

export class RetailBandService {
  constructor(
    private repository: RetailBandRepository = retailBandRepository
  ) {}

  /**
   * 사용자별 전체 소매 밴드 목록 조회
   */
  async findAllByUserId(
    userId: string,
    isActiveOnly: boolean = true
  ): Promise<RetailBand[]> {
    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    return this.repository.findAllByUserId(userId, { isActive: isActiveOnly })
  }

  /**
   * ID로 소매 밴드 조회
   */
  async findById(id: string, userId: string): Promise<RetailBand> {
    if (!id) {
      throw new ValidationError('밴드 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    const band = await this.repository.findByIdAndUserId(id, userId)

    if (!band) {
      throw new NotFoundError('소매 밴드', id)
    }

    return band
  }

  /**
   * 필터 조건으로 소매 밴드 조회
   */
  async findByFilter(filter: RetailBandFilter): Promise<RetailBand[]> {
    if (!filter.userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    return this.repository.findByFilter(filter)
  }

  /**
   * 새 소매 밴드 생성
   */
  async createBand(data: CreateRetailBandDTO): Promise<RetailBand> {
    // 필수 필드 검증
    if (!data.userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    if (!data.bandKey) {
      throw new ValidationError('밴드 키는 필수입니다')
    }

    if (!data.bandName) {
      throw new ValidationError('밴드 이름은 필수입니다')
    }

    // 중복 확인
    const existingBand = await this.repository.findByBandKeyAndUserId(
      data.bandKey,
      data.userId
    )

    if (existingBand) {
      throw new DuplicateError('이미 등록된 소매 밴드입니다', {
        bandKey: data.bandKey
      })
    }

    // 소매 밴드 생성
    const band = await this.repository.create({
      user: {
        connect: { id: data.userId }
      },
      bandKey: data.bandKey,
      bandName: data.bandName,
      description: data.description || '',
      coverUrl: data.coverUrl,
      isActive: data.isActive ?? true
    })

    return band
  }

  /**
   * 소매 밴드 업데이트
   */
  async updateBand(
    id: string,
    userId: string,
    data: UpdateRetailBandDTO
  ): Promise<RetailBand> {
    if (!id) {
      throw new ValidationError('밴드 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 밴드 존재 및 권한 확인
    const existingBand = await this.repository.findByIdAndUserId(id, userId)
    if (!existingBand) {
      throw new NotFoundError('소매 밴드', id)
    }

    // 업데이트 데이터 필터링
    const updateData: any = {}

    if (data.bandName !== undefined) updateData.bandName = data.bandName
    if (data.description !== undefined) updateData.description = data.description
    if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    updateData.updatedAt = new Date()

    return this.repository.update(id, updateData)
  }

  /**
   * 소매 밴드 삭제 (실제 삭제)
   */
  async deleteBand(id: string, userId: string): Promise<void> {
    if (!id) {
      throw new ValidationError('밴드 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 밴드 존재 및 권한 확인
    const existingBand = await this.repository.findByIdAndUserId(id, userId)
    if (!existingBand) {
      throw new NotFoundError('소매 밴드', id)
    }

    await this.repository.delete(id)
  }

  /**
   * 소매 밴드 소프트 삭제 (isActive = false)
   */
  async deactivateBand(id: string, userId: string): Promise<RetailBand> {
    if (!id) {
      throw new ValidationError('밴드 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 밴드 존재 및 권한 확인
    const existingBand = await this.repository.findByIdAndUserId(id, userId)
    if (!existingBand) {
      throw new NotFoundError('소매 밴드', id)
    }

    return this.repository.softDelete(id)
  }

  /**
   * 소매 밴드 개수 조회
   */
  async countBands(filter?: Partial<RetailBandFilter>): Promise<number> {
    return this.repository.count(filter)
  }
}

// Singleton 인스턴스
export const retailBandService = new RetailBandService()
