/**
 * WholesaleBand Service
 * 도매 밴드 비즈니스 로직 레이어
 */

import { WholesaleBand } from '@prisma/client'
import {
  wholesaleBandRepository,
  WholesaleBandRepository
} from '@/domain/wholesale/repository/wholesale-band.repository'
import {
  CreateWholesaleBandDTO,
  UpdateWholesaleBandDTO,
  WholesaleBandFilter,
  BandApiResponse,
  DeleteWholesaleBandsResult
} from '@/domain/wholesale/types/wholesale-band.type'
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  DuplicateError
} from '@/lib/errors/handlers'

export class WholesaleBandService {
  constructor(
    private repository: WholesaleBandRepository = wholesaleBandRepository
  ) {}

  /**
   * 사용자별 전체 도매 밴드 목록 조회
   */
  async findAllByUserId(
    userId: number,
    isActiveOnly: boolean = true
  ): Promise<WholesaleBand[]> {
    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    return this.repository.findAllByUserId(userId, { isActive: isActiveOnly })
  }

  /**
   * ID로 도매 밴드 조회
   */
  async findById(id: number, userId: number): Promise<WholesaleBand> {
    if (!id) {
      throw new ValidationError('밴드 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    const band = await this.repository.findByIdAndUserId(id, userId)

    if (!band) {
      throw new NotFoundError('도매 밴드', id.toString())
    }

    return band
  }

  /**
   * 필터 조건으로 도매 밴드 조회
   */
  async findByFilter(filter: WholesaleBandFilter): Promise<WholesaleBand[]> {
    if (!filter.userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    return this.repository.findByFilter(filter)
  }

  /**
   * 새 도매 밴드 생성
   */
  async createBand(data: CreateWholesaleBandDTO): Promise<WholesaleBand> {
    // 필수 필드 검증
    if (!data.userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    if (!data.name) {
      throw new ValidationError('밴드 이름은 필수입니다')
    }

    if (!data.bandKey) {
      throw new ValidationError('밴드 키는 필수입니다')
    }

    // 중복 확인
    const existingBand = await this.repository.findByBandKeyAndUserId(
      data.bandKey,
      data.userId
    )

    if (existingBand) {
      throw new DuplicateError('이미 등록된 밴드입니다', {
        bandKey: data.bandKey
      })
    }

    // 도매 밴드 생성
    const band = await this.repository.create({
      user: {
        connect: { id: data.userId }
      },
      name: data.name,
      bandKey: data.bandKey,
      description: data.description,
      coverUrl: data.coverUrl,
      pricingPolicy: data.pricingPolicy,
      isActive: data.isActive ?? true
    })

    return band
  }

  /**
   * 여러 도매 밴드 일괄 생성 (Band API에서 받은 데이터)
   */
  async createManyBands(
    userId: number,
    bands: BandApiResponse[]
  ): Promise<{
    savedBands: WholesaleBand[]
    skippedCount: number
  }> {
    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    if (!Array.isArray(bands) || bands.length === 0) {
      throw new ValidationError('선택된 밴드가 없습니다')
    }

    const savedBands: WholesaleBand[] = []
    let skippedCount = 0

    for (const band of bands) {
      // 이미 등록된 밴드인지 확인
      const existingBand = await this.repository.findByBandKeyAndUserId(
        band.band_key,
        userId
      )

      if (existingBand) {
        skippedCount++
        continue
      }

      // 새 밴드 등록
      const newBand = await this.repository.create({
        user: {
          connect: { id: userId }
        },
        name: band.name,
        bandKey: band.band_key,
        description: band.description || null,
        coverUrl: band.cover || null,
        isActive: true
      })

      savedBands.push(newBand)
    }

    return { savedBands, skippedCount }
  }

  /**
   * 도매 밴드 업데이트
   */
  async updateBand(
    id: number,
    userId: number,
    data: UpdateWholesaleBandDTO
  ): Promise<WholesaleBand> {
    if (!id) {
      throw new ValidationError('밴드 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 밴드 존재 및 권한 확인
    const existingBand = await this.repository.findByIdAndUserId(id, userId)
    if (!existingBand) {
      throw new NotFoundError('도매 밴드', id.toString())
    }

    // 업데이트 데이터 필터링
    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl
    if (data.pricingPolicy !== undefined)
      updateData.pricingPolicy = data.pricingPolicy
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    updateData.updatedAt = new Date()

    return this.repository.update(id, updateData)
  }

  /**
   * 가격정책 업데이트
   */
  async updatePricingPolicy(
    id: number,
    userId: number,
    pricingPolicy: string
  ): Promise<WholesaleBand> {
    if (!id) {
      throw new ValidationError('밴드 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    if (!pricingPolicy) {
      throw new ValidationError('가격정책은 필수입니다')
    }

    // 밴드 존재 및 권한 확인
    const existingBand = await this.repository.findByIdAndUserId(id, userId)
    if (!existingBand) {
      throw new NotFoundError('도매 밴드', id.toString())
    }

    return this.repository.update(id, {
      pricingPolicy,
      updatedAt: new Date()
    })
  }

  /**
   * 도매 밴드 삭제 (단일)
   */
  async deleteBand(id: number, userId: number): Promise<void> {
    if (!id) {
      throw new ValidationError('밴드 ID는 필수입니다')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 밴드 존재 및 권한 확인
    const existingBand = await this.repository.findByIdAndUserId(id, userId)
    if (!existingBand) {
      throw new NotFoundError('도매 밴드', id.toString())
    }

    await this.repository.delete(id)
  }

  /**
   * 도매 밴드 일괄 삭제
   */
  async deleteBands(
    bandIds: number[],
    userId: number
  ): Promise<DeleteWholesaleBandsResult> {
    if (!bandIds || bandIds.length === 0) {
      throw new ValidationError('삭제할 밴드를 선택해주세요')
    }

    if (!userId) {
      throw new ValidationError('사용자 ID는 필수입니다')
    }

    // 밴드 존재 및 권한 확인
    const existingBands = await this.repository.findManyByIds(bandIds, userId)

    if (existingBands.length === 0) {
      throw new NotFoundError('도매 밴드', bandIds.join(', '))
    }

    if (existingBands.length !== bandIds.length) {
      throw new UnauthorizedError('일부 밴드를 삭제할 권한이 없습니다')
    }

    // 일괄 삭제 실행
    const result = await this.repository.deleteMany(bandIds, userId)

    return {
      success: true,
      message: `${result.deletedCount}개의 밴드가 삭제되었습니다`,
      deletedCount: result.deletedCount,
      deletedPostsCount: result.deletedPostsCount
    }
  }

  /**
   * 도매 밴드 개수 조회
   */
  async countBands(filter?: Partial<WholesaleBandFilter>): Promise<number> {
    return this.repository.count(filter)
  }
}

// Singleton 인스턴스
export const wholesaleBandService = new WholesaleBandService()
