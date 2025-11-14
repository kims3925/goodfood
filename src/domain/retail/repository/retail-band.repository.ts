/**
 * RetailBand Repository
 * 소매 밴드 데이터 접근 레이어
 */

import prisma from '@/lib/database/client'
import { RetailBand, Prisma } from '@prisma/client'
import { RetailBandFilter } from '@/types/services/retail-band'

export class RetailBandRepository {
  /**
   * ID로 소매 밴드 조회
   */
  async findById(id: string): Promise<RetailBand | null> {
    return prisma.retailBand.findUnique({
      where: { id }
    })
  }

  /**
   * ID와 사용자 ID로 소매 밴드 조회
   */
  async findByIdAndUserId(id: string, userId: string): Promise<RetailBand | null> {
    return prisma.retailBand.findFirst({
      where: {
        id,
        userId
      }
    })
  }

  /**
   * 사용자별 전체 소매 밴드 조회
   */
  async findAllByUserId(userId: string, options?: {
    isActive?: boolean
    orderBy?: Prisma.RetailBandOrderByWithRelationInput
  }): Promise<RetailBand[]> {
    const where: Prisma.RetailBandWhereInput = {
      userId
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive
    }

    return prisma.retailBand.findMany({
      where,
      orderBy: options?.orderBy || { createdAt: 'desc' }
    })
  }

  /**
   * bandKey와 userId로 소매 밴드 조회
   */
  async findByBandKeyAndUserId(
    bandKey: string,
    userId: string
  ): Promise<RetailBand | null> {
    return prisma.retailBand.findFirst({
      where: {
        userId,
        bandKey
      }
    })
  }

  /**
   * 필터 조건으로 소매 밴드 조회
   */
  async findByFilter(filter: RetailBandFilter): Promise<RetailBand[]> {
    const where: Prisma.RetailBandWhereInput = {
      userId: filter.userId
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive
    }

    if (filter.bandKey) {
      where.bandKey = filter.bandKey
    }

    if (filter.search) {
      where.OR = [
        { bandName: { contains: filter.search } },
        { description: { contains: filter.search } }
      ]
    }

    return prisma.retailBand.findMany({
      where,
      orderBy: filter.sortBy
        ? { [filter.sortBy]: filter.sortOrder || 'desc' }
        : { createdAt: 'desc' },
      skip: filter.offset,
      take: filter.limit
    })
  }

  /**
   * 소매 밴드 생성
   */
  async create(data: Prisma.RetailBandCreateInput): Promise<RetailBand> {
    return prisma.retailBand.create({
      data
    })
  }

  /**
   * 소매 밴드 업데이트
   */
  async update(id: string, data: Prisma.RetailBandUpdateInput): Promise<RetailBand> {
    return prisma.retailBand.update({
      where: { id },
      data
    })
  }

  /**
   * 소매 밴드 삭제
   */
  async delete(id: string): Promise<RetailBand> {
    return prisma.retailBand.delete({
      where: { id }
    })
  }

  /**
   * 소매 밴드 소프트 삭제 (isActive = false)
   */
  async softDelete(id: string): Promise<RetailBand> {
    return prisma.retailBand.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })
  }

  /**
   * 소매 밴드 개수 조회
   */
  async count(filter?: Partial<RetailBandFilter>): Promise<number> {
    const where: Prisma.RetailBandWhereInput = {}

    if (filter?.userId) {
      where.userId = filter.userId
    }

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive
    }

    return prisma.retailBand.count({ where })
  }
}

// Singleton 인스턴스
export const retailBandRepository = new RetailBandRepository()
