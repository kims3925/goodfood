import prisma, { PublishStatus, PublishType } from '@bandauto/db'
import type { ProductListParams, ProductCreateInput, ProductUpdateInput } from '../types/product.types'

export class ProductRepository {
  async findMany(params: ProductListParams) {
    const {
      userId,
      postId,
      search,
      wholesaleBandId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = params

    const where: any = { userId }

    if (postId) {
      where.postId = postId
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    if (wholesaleBandId) {
      where.post = {
        wholesaleBandId,
      }
    }

    if (status) {
      where.status = status
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    const total = await prisma.product.count({ where })

    const products = await prisma.product.findMany({
      where,
      include: {
        post: {
          include: {
            wholesaleBand: {
              select: {
                id: true,
                name: true,
                coverUrl: true,
              },
            },
            images: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
          },
        },
        productPublishes: {
          where: {
            status: PublishStatus.SUCCESS,
            // RETAIL_BAND와 SHOPPING_MALL 모두 조회
          },
          include: {
            retailBand: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // 발행 상태 계산해서 추가
    const productsWithPublishStatus = products.map((product) => {
      // 발행 유형별 분류
      const retailBandPublishes = product.productPublishes.filter(
        (pp) => pp.publishType === PublishType.RETAIL_BAND
      )
      const shoppingMallPublishes = product.productPublishes.filter(
        (pp) => pp.publishType === PublishType.SHOPPING_MALL
      )

      const hasRetailBand = retailBandPublishes.length > 0
      const hasShoppingMall = shoppingMallPublishes.length > 0

      // 발행된 소매밴드 ID 목록
      const publishedRetailBandIds = retailBandPublishes
        .map((pp) => pp.retailBandId)
        .filter((id): id is number => id !== null && id !== undefined)

      // 발행 요약 계산
      let publishSummary = '미발행'
      if (hasRetailBand && hasShoppingMall) {
        publishSummary = '발행완료'
      } else if (hasRetailBand || hasShoppingMall) {
        publishSummary = '부분발행'
      }

      return {
        ...product,
        publishStatus: {
          retailBand: hasRetailBand,
          shoppingMall: hasShoppingMall,
        },
        publishedRetailBandIds, // 발행된 소매밴드 ID 목록
        publishSummary,
      }
    })

    return {
      data: productsWithPublishStatus,
      total,
      page,
      limit,
    }
  }

  async findById(id: number) {
    return prisma.product.findFirst({
      where: { id },
    })
  }

  async findByIdAndUser(id: number, userId: number) {
    return prisma.product.findFirst({
      where: { id, userId },
    })
  }

  async findByPostId(postId: number) {
    return prisma.product.findUnique({
      where: { postId },
    })
  }

  async create(data: ProductCreateInput & { thumbnailUrl?: string | null }) {
    return prisma.product.create({
      data: {
        userId: data.userId,
        postId: data.postId,
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId || null,
        currency: data.currency || 'KRW',
        price: data.price || null,
        wholesalePrice: data.wholesalePrice || null,
        thumbnailUrl: data.thumbnailUrl || null,
      },
    })
  }

  async update(id: number, data: ProductUpdateInput) {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
    if (data.price !== undefined) updateData.price = data.price
    if (data.wholesalePrice !== undefined) updateData.wholesalePrice = data.wholesalePrice
    if (data.status !== undefined) updateData.status = data.status

    return prisma.product.update({
      where: { id },
      data: updateData,
    })
  }

  async delete(id: number) {
    return prisma.product.delete({
      where: { id },
    })
  }

  async getPostWithImages(postId: number, userId: number) {
    return prisma.post.findFirst({
      where: { id: postId, userId },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
    })
  }
}

export const productRepository = new ProductRepository()
