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
      sourcePlatform,
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
    const postWhere: any = {}

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
      postWhere.channelId = channelId
    }

    // sourcePlatform 필터: 수집 출처 플랫폼
    if (sourcePlatform) {
      postWhere.channel = {
        platform: sourcePlatform,
      }
    }

    // post 필터가 있으면 적용
    if (Object.keys(postWhere).length > 0) {
      collectedProductWhere.post = postWhere
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
  }) {
    return prisma.collectedProduct.create({
      data: {
        userId: params.userId,
        postId: params.postId,
        name: params.name || null,
        description: params.description || null,
        currency: params.currency || 'KRW',
      },
    })
  }

  async create(data: ProductCreateInput & { thumbnailUrl?: string | null; imageUrls?: string[] }) {
    // 상품 생성 (options와 variants 포함)
    const product = await prisma.product.create({
      data: {
        userId: data.userId,
        collectedProductId: data.collectedProductId || null,
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId || null,
        currency: data.currency || 'KRW',
        shippingFee: data.shippingFee || null,
        shippingInfo: data.shippingInfo || null,
        thumbnailUrl: data.thumbnailUrl || null,
        // ProductOption 생성: 두 가지 형태 지원
        // 1. 그룹 형태: [{ groupName: '사이즈', values: ['S', 'M'] }]
        // 2. 개별 형태: [{ groupName: '사이즈', value: 'S' }, { groupName: '사이즈', value: 'M' }]
        options: data.options?.length
          ? {
              create: data.options.flatMap((opt: any, groupIndex: number) => {
                // 개별 형태 (value 필드가 있는 경우)
                if ('value' in opt && typeof opt.value === 'string') {
                  return [{
                    groupName: opt.groupName,
                    value: opt.value,
                    sortOrder: groupIndex,
                  }]
                }
                // 그룹 형태 (values 배열이 있는 경우)
                if (Array.isArray(opt.values)) {
                  return opt.values.map((value: string, valueIndex: number) => ({
                    groupName: opt.groupName,
                    value,
                    sortOrder: groupIndex * 100 + valueIndex,
                  }))
                }
                return []
              }),
            }
          : undefined,
        // ProductVariant 생성
        variants: data.variants?.length
          ? {
              create: data.variants.map((v) => ({
                optionSummary: v.optionSummary ?? null,
                wholesalePrice: v.wholesalePrice ?? null,  // ?? 사용하여 0도 유지
                price: v.price ?? 0,
              })),
            }
          : undefined,
      },
    })

    // 이미지 URL이 있으면 다운로드하여 ProductImage에 저장
    if (data.imageUrls && data.imageUrls.length > 0) {
      try {
        const downloadedImages = await downloadAndSaveProductImages(data.imageUrls)

        if (downloadedImages.length > 0) {
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
        }
      } catch {
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
    if (data.shippingFee !== undefined) updateData.shippingFee = data.shippingFee
    if (data.shippingInfo !== undefined) updateData.shippingInfo = data.shippingInfo

    // 옵션 업데이트: 기존 삭제 후 새로 생성
    if (data.options !== undefined) {
      await prisma.productOption.deleteMany({ where: { productId: id } })
      if (data.options.length > 0) {
        await prisma.productOption.createMany({
          data: data.options.map((opt: any, idx: number) => ({
            productId: id,
            groupName: opt.groupName,
            value: opt.value,
            sortOrder: opt.sortOrder ?? idx,
          })),
        })
      }
    }

    // 변형상품 업데이트: 기존 삭제 후 새로 생성
    if (data.variants !== undefined) {
      await prisma.productVariant.deleteMany({ where: { productId: id } })
      if (data.variants.length > 0) {
        await prisma.productVariant.createMany({
          data: data.variants.map((v: any) => ({
            productId: id,
            optionSummary: v.optionSummary ?? null,
            wholesalePrice: v.wholesalePrice ?? null,  // ?? 사용하여 0도 유지
            price: v.price ?? 0,
          })),
        })
      }
    }

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
