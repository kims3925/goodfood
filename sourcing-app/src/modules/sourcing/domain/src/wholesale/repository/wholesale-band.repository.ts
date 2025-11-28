/**
 * WholesaleBand Repository
 * 도매 밴드 데이터 접근 레이어
 */

import prisma from '@bandauto/db'
import { WholesaleBand, Prisma } from '@bandauto/db'
import { WholesaleBandFilter } from '@/domain/wholesale/types/wholesale-band.type'

export class WholesaleBandRepository {
  /**
   * ID로 도매 밴드 조회
   */
  async findById(id: number): Promise<WholesaleBand | null> {
    return prisma.wholesaleBand.findUnique({
      where: { id }
    })
  }

  /**
   * ID와 사용자 ID로 도매 밴드 조회
   */
  async findByIdAndUserId(id: number, userId: number): Promise<WholesaleBand | null> {
    return prisma.wholesaleBand.findUnique({
      where: {
        id,
        userId
      }
    })
  }

  /**
   * 사용자별 전체 도매 밴드 조회
   */
  async findAllByUserId(userId: number, options?: {
    isActive?: boolean
    orderBy?: Prisma.WholesaleBandOrderByWithRelationInput
  }): Promise<WholesaleBand[]> {
    const where: Prisma.WholesaleBandWhereInput = {
      userId
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive
    }

    return prisma.wholesaleBand.findMany({
      where,
      orderBy: options?.orderBy || { createdAt: 'desc' }
    })
  }

  /**
   * bandKey와 userId로 도매 밴드 조회
   */
  async findByBandKeyAndUserId(
    bandKey: string,
    userId: number
  ): Promise<WholesaleBand | null> {
    return prisma.wholesaleBand.findFirst({
      where: {
        userId,
        bandKey
      }
    })
  }

  /**
   * 필터 조건으로 도매 밴드 조회
   */
  async findByFilter(filter: WholesaleBandFilter): Promise<WholesaleBand[]> {
    const where: Prisma.WholesaleBandWhereInput = {
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
        { name: { contains: filter.search } },
        { description: { contains: filter.search } }
      ]
    }

    return prisma.wholesaleBand.findMany({
      where,
      orderBy: filter.sortBy
        ? { [filter.sortBy]: filter.sortOrder || 'desc' }
        : { createdAt: 'desc' },
      skip: filter.offset,
      take: filter.limit
    })
  }

  /**
   * 도매 밴드 생성
   */
  async create(data: Prisma.WholesaleBandCreateInput): Promise<WholesaleBand> {
    return prisma.wholesaleBand.create({
      data
    })
  }

  /**
   * 도매 밴드 업데이트
   */
  async update(id: number, data: Prisma.WholesaleBandUpdateInput): Promise<WholesaleBand> {
    return prisma.wholesaleBand.update({
      where: { id },
      data
    })
  }

  /**
   * 도매 밴드 삭제
   */
  async delete(id: number): Promise<WholesaleBand> {
    return prisma.wholesaleBand.delete({
      where: { id }
    })
  }

  /**
   * 여러 도매 밴드 ID로 조회
   */
  async findManyByIds(ids: number[], userId: number): Promise<WholesaleBand[]> {
    return prisma.wholesaleBand.findMany({
      where: {
        id: { in: ids },
        userId
      }
    })
  }

  /**
   * 도매 밴드와 연관된 게시물 수 조회
   */
  async countRelatedPosts(bandIds: number[]): Promise<number> {
    return prisma.collectedPost.count({
      where: {
        wholesaleBandId: { in: bandIds }
      }
    })
  }

  /**
   * 도매 밴드 일괄 삭제
   */
  async deleteMany(bandIds: number[], userId: number): Promise<{
    deletedCount: number
    deletedPostsCount: number
  }> {
    // 연관된 게시물 수 확인
    const deletedPostsCount = await this.countRelatedPosts(bandIds)

    // 밴드 삭제
    const result = await prisma.wholesaleBand.deleteMany({
      where: {
        id: { in: bandIds },
        userId
      }
    })

    return {
      deletedCount: result.count,
      deletedPostsCount
    }
  }

  /**
   * 도매 밴드 개수 조회
   */
  async count(filter?: Partial<WholesaleBandFilter>): Promise<number> {
    const where: Prisma.WholesaleBandWhereInput = {}

    if (filter?.userId) {
      where.userId = filter.userId
    }

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive
    }

    return prisma.wholesaleBand.count({ where })
  }
}

// Singleton 인스턴스
export const wholesaleBandRepository = new WholesaleBandRepository()
