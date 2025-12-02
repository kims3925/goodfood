import prisma, { ChannelKind } from '@bandauto/db'
import type { ProductListParams, ProductCreateInput, ProductUpdateInput } from '../types/product.types'
import { downloadAndSaveProductImages } from '@/modules/utils/imageUtils'

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
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        publishedProducts: {
          where: {
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

  async getWithImages(id: number, userId: number) {
    return prisma.product.findFirst({
      where: { id, userId },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
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
            },
          },
        },
      },
    })
  }

  async getCollectedProductById(id: number) {
    return prisma.collectedProduct.findFirst({
      where: { id },
      include: {
        post: {
          include: {
            images: {
              orderBy: { sortOrder: 'asc' },
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

  async create(data: ProductCreateInput & { thumbnailUrl?: string | null; imageUrls?: string[] }) {
    // 1. 상품 생성
    const product = await prisma.product.create({
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

    // 2. 이미지 URL이 있으면 다운로드하여 ProductImage에 저장
    if (data.imageUrls && data.imageUrls.length > 0) {
      try {
        console.log(`[Product Create] 이미지 다운로드 시작: ${data.imageUrls.length}개`)
        const downloadedImages = await downloadAndSaveProductImages(data.imageUrls)

        if (downloadedImages.length > 0) {
          // 중복 이미지 로그
          const existingCount = downloadedImages.filter((img) => img.isExisting).length
          if (existingCount > 0) {
            console.log(`[Product Create] 중복 이미지 재사용: ${existingCount}개`)
          }

          // ProductImage 레코드 생성 (해시, 파일명, 파일크기 포함)
          await prisma.productImage.createMany({
            data: downloadedImages.map((img, index) => ({
              productId: product.id,
              url: img.url,
              fileHash: img.fileHash,
              fileName: img.fileName,
              fileSize: img.fileSize,
              sortOrder: index,
            })),
          })

          // 첫 번째 이미지를 썸네일로 설정 (thumbnailUrl이 없는 경우)
          if (!product.thumbnailUrl) {
            await prisma.product.update({
              where: { id: product.id },
              data: { thumbnailUrl: downloadedImages[0].url },
            })
          }

          console.log(`[Product Create] 이미지 저장 완료: ${downloadedImages.length}개`)
        }
      } catch (error) {
        console.error('[Product Create] 이미지 다운로드/저장 실패:', error)
        // 이미지 저장 실패해도 상품은 생성됨
      }
    }

    return product
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
