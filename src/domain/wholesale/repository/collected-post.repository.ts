/**
 * CollectedPost Repository
 * 수집된 게시물 데이터 접근 레이어
 */

import prisma from '@/lib/database/client'
import { CollectedPost, Prisma } from '@prisma/client'
import { CollectedPostFilter } from '@/types/services/wholesale'

export interface CollectedPostWithRelations extends CollectedPost {
  wholesaleBand?: any
  user?: any
}

export class CollectedPostRepository {
  /**
   * ID로 게시물 조회
   */
  async findById(id: string): Promise<CollectedPostWithRelations | null> {
    return prisma.collectedPost.findUnique({
      where: { id },
      include: {
        wholesaleBand: true,
        user: true,
        images: true
      }
    })
  }

  /**
   * 여러 ID로 게시물 조회
   */
  async findManyByIds(
    ids: string[],
    userId: string
  ): Promise<CollectedPostWithRelations[]> {
    return prisma.collectedPost.findMany({
      where: {
        id: { in: ids },
        userId: parseInt(userId),
        status: 'PENDING'
      },
      include: {
        wholesaleBand: true
      }
    })
  }

  /**
   * 필터 조건으로 게시물 조회
   */
  async findByFilter(
    filter: CollectedPostFilter
  ): Promise<CollectedPostWithRelations[]> {
    const where: Prisma.CollectedPostWhereInput = {
      userId: filter.userId ? parseInt(filter.userId) : undefined
    }

    if (filter.wholesaleBandId) {
      where.wholesaleBandId = filter.wholesaleBandId
    }

    if (filter.status) {
      where.status = filter.status
    }

    if (filter.isSelected !== undefined) {
      where.isSelected = filter.isSelected
    }

    if (filter.productCategory) {
      where.productCategory = filter.productCategory
    }

    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search } },
        { content: { contains: filter.search } },
        { hookingTitle: { contains: filter.search } }
      ]
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {}
      if (filter.startDate) where.createdAt.gte = filter.startDate
      if (filter.endDate) where.createdAt.lte = filter.endDate
    }

    return prisma.collectedPost.findMany({
      where,
      include: {
        wholesaleBand: true
      },
      orderBy: filter.sortBy
        ? { [filter.sortBy]: filter.sortOrder || 'desc' }
        : { createdAt: 'desc' },
      skip: filter.offset,
      take: filter.limit
    })
  }

  /**
   * 게시물 상태 업데이트
   */
  async updateStatus(id: string, status: string): Promise<CollectedPost> {
    return prisma.collectedPost.update({
      where: { id },
      data: {
        status,
        isSelected: status === 'PROCESSED',
        updatedAt: new Date()
      }
    })
  }

  /**
   * 여러 게시물 상태 일괄 업데이트
   */
  async updateManyStatus(ids: string[], status: string): Promise<number> {
    const result = await prisma.collectedPost.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        isSelected: status === 'PROCESSED',
        updatedAt: new Date()
      }
    })
    return result.count
  }

  /**
   * 게시물 개수 조회
   */
  async count(filter?: Partial<CollectedPostFilter>): Promise<number> {
    const where: Prisma.CollectedPostWhereInput = {}

    if (filter?.userId) where.userId = parseInt(filter.userId)
    if (filter?.status) where.status = filter.status
    if (filter?.wholesaleBandId) where.wholesaleBandId = filter.wholesaleBandId
    if (filter?.isSelected !== undefined) where.isSelected = filter.isSelected

    return prisma.collectedPost.count({ where })
  }

  /**
   * 카테고리별 게시물 통계
   */
  async getStatsByCategory(userId: string) {
    const posts = await prisma.collectedPost.groupBy({
      by: ['productCategory'],
      where: { userId: parseInt(userId) },
      _count: true
    })

    return posts.map(p => ({
      category: p.productCategory || '미분류',
      count: p._count
    }))
  }

  /**
   * 게시물 삭제
   */
  async delete(id: string): Promise<CollectedPost> {
    return prisma.collectedPost.delete({
      where: { id }
    })
  }

  /**
   * 여러 게시물 삭제
   */
  async deleteMany(ids: string[]): Promise<number> {
    const result = await prisma.collectedPost.deleteMany({
      where: { id: { in: ids } }
    })
    return result.count
  }
}

// Singleton 인스턴스
export const collectedPostRepository = new CollectedPostRepository()
