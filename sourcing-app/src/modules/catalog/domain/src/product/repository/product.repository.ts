import prisma, { PublishStatus, ChannelKind } from '@bandauto/db'
import type { ProductListParams, ProductCreateInput, ProductUpdateInput } from '../types/product.types'

export class ProductRepository {
  async findMany(params: ProductListParams) {
    const {
      userId,
      collectedProductId,
      postId,
      search,
      channelId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = params

    const where: any = { userId }

    if (collectedProductId) {
      where.collectedProductId = collectedProductId
    }

    const collectedProductWhere: any = {}

    if (postId) {
      collectedProductWhere.postId = postId
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    if (channelId) {
      collectedProductWhere.post = {
        channelId,
      }
    }

    if (Object.keys(collectedProductWhere).length > 0) {
      where.collectedProduct = collectedProductWhere
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
        collectedProduct: {
          include: {
            post: {
              include: {
                channel: {
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
          },
        },
        publishedProducts: {
          where: {
            status: PublishStatus.SUCCESS,
            channel: {
              kind: ChannelKind.RETAIL,
            },
          },
          include: {
            channel: {
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
      const channelPublishes = product.publishedProducts

      const hasChannelPublish = channelPublishes.length > 0

      // 발행된 채널 ID 목록
      const publishedChannelIds = channelPublishes
        .map((pp) => pp.channelId)
        .filter((id): id is number => id !== null && id !== undefined)

      // 발행 요약 계산
      let publishSummary = '미발행'
      if (hasChannelPublish) {
        publishSummary = '발행됨'
      }

      return {
        ...product,
        publishStatus: {
          retailBand: hasChannelPublish,
        },
        publishedChannelIds, // 발행된 채널 ID 목록
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

  async findByCollectedProductId(collectedProductId: number) {
    return prisma.product.findFirst({
      where: { collectedProductId },
    })
  }

  async findCollectedProductByPostId(postId: number) {
    return prisma.collectedProduct.findFirst({
      where: { postId },
      include: {
        products: true,
        post: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
          },
        },
      },
    })
  }

  async createCollectedProductFromPost(params: {
    userId: number
    postId: number
    name?: string
    description?: string
    currency?: string
    price?: number
  }) {
    return prisma.collectedProduct.create({
      data: {
        userId: params.userId,
        postId: params.postId,
        name: params.name || null,
        description: params.description || null,
        currency: params.currency || 'KRW',
        price: params.price || null,
      },
    })
  }

  async create(data: ProductCreateInput & { thumbnailUrl?: string | null }) {
    return prisma.product.create({
      data: {
        userId: data.userId,
        collectedProductId: data.collectedProductId || null,
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId || null,
        currency: data.currency || 'KRW',
        price: data.price || null,
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

  async getCollectedPostWithImages(postId: number, userId: number) {
    return prisma.collectedPost.findFirst({
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
