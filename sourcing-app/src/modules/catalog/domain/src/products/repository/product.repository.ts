/**
 * Product Repository
 * 상품 데이터 접근 레이어
 */

import { Product, Prisma } from '@bandauto/db'
import { ProductFilter } from '@/types/services/product'

export class ProductRepository {
  /**
   * ID로 상품 조회
   */
  async findById(id: number): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id }
    })
  }

  /**
   * ID와 사용자 ID로 상품 조회
   */
  async findByIdAndUserId(id: number, userId: number): Promise<Product | null> {
    return prisma.product.findUnique({
      where: {
        id,
        userId
      }
    })
  }

  /**
   * 사용자별 전체 상품 조회
   */
  async findAllByUserId(userId: number, options?: {
    orderBy?: Prisma.ProductOrderByWithRelationInput
  }): Promise<Product[]> {
    return prisma.product.findMany({
      where: { userId },
      orderBy: options?.orderBy || { createdAt: 'desc' }
    })
  }

  /**
   * 필터 조건으로 상품 조회
   */
  async findByFilter(filter: ProductFilter): Promise<Product[]> {
    const where: Prisma.ProductWhereInput = {
      userId: filter.userId
    }

    if (filter.status) {
      where.status = filter.status
    }

    if (filter.category) {
      where.productCategory = filter.category
    }

    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      where.salePrice = {}
      if (filter.minPrice !== undefined) {
        where.salePrice.gte = filter.minPrice
      }
      if (filter.maxPrice !== undefined) {
        where.salePrice.lte = filter.maxPrice
      }
    }

    if (filter.wholesaleBandId) {
      where.wholesaleBandId = filter.wholesaleBandId
    }

    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search } },
        { description: { contains: filter.search } }
      ]
    }

    return prisma.product.findMany({
      where,
      orderBy: filter.sortBy
        ? { [filter.sortBy]: filter.sortOrder || 'desc' }
        : { createdAt: 'desc' },
      skip: filter.offset,
      take: filter.limit
    })
  }

  /**
   * 상품 생성
   */
  async create(data: Prisma.ProductCreateInput): Promise<Product> {
    return prisma.product.create({
      data
    })
  }

  /**
   * 상품 업데이트
   */
  async update(id: number, data: Prisma.ProductUpdateInput): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data
    })
  }

  /**
   * 상품 삭제
   */
  async delete(id: number): Promise<Product> {
    return prisma.product.delete({
      where: { id }
    })
  }

  /**
   * 여러 상품 ID로 조회
   */
  async findManyByIds(ids: number[]): Promise<Product[]> {
    return prisma.product.findMany({
      where: {
        id: { in: ids }
      },
      select: {
        id: true,
        title: true,
        status: true,
        userId: true
      } as Prisma.ProductSelect
    }) as Promise<Product[]>
  }

  /**
   * 상품과 연결된 주문 확인
   */
  async findOrderedProductIds(productIds: number[]): Promise<number[]> {
    const orders = await prisma.order.findMany({
      where: {
        productId: { in: productIds }
      },
      select: {
        productId: true
      }
    })

    return [...new Set(orders.map(order => order.productId).filter(Boolean))] as number[]
  }

  /**
   * 트랜잭션을 사용한 일괄 삭제
   */
  async deleteMany(
    productIds: number[]
  ): Promise<{
    deletedCount: number
    deactivatedCount: number
  }> {
    // 주문이 있는 상품들 확인
    const orderedProductIds = await this.findOrderedProductIds(productIds)

    return prisma.$transaction(async (tx) => {
      // 1. 관련 데이터 삭제
      await tx.retailPost.deleteMany({
        where: { productId: { in: productIds } }
      })

      await tx.cartItem.deleteMany({
        where: { productId: { in: productIds } }
      })

      await tx.productPage.deleteMany({
        where: { productId: { in: productIds } }
      })

      // 2. 주문이 있는 상품은 상태만 변경
      let deactivatedCount = 0
      if (orderedProductIds.length > 0) {
        const result = await tx.product.updateMany({
          where: { id: { in: orderedProductIds } },
          data: {
            status: 'DELETED',
            updatedAt: new Date()
          }
        })
        deactivatedCount = result.count
      }

      // 3. 주문이 없는 상품은 실제 삭제
      const productsToDelete = productIds.filter(
        (id) => !orderedProductIds.includes(id)
      )

      let deletedCount = 0
      if (productsToDelete.length > 0) {
        const result = await tx.product.deleteMany({
          where: { id: { in: productsToDelete } }
        })
        deletedCount = result.count
      }

      return { deletedCount, deactivatedCount }
    })
  }

  /**
   * 상품 상태 변경
   */
  async updateStatus(id: number, status: string): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date()
      }
    })
  }

  /**
   * 상품 개수 조회
   */
  async count(filter?: Partial<ProductFilter>): Promise<number> {
    const where: Prisma.ProductWhereInput = {}

    if (filter?.userId) {
      where.userId = filter.userId
    }

    if (filter?.status) {
      where.status = filter.status
    }

    return prisma.product.count({ where })
  }
}

// Singleton 인스턴스
export const productRepository = new ProductRepository()
